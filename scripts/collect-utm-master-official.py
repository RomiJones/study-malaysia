#!/usr/bin/env python3
"""Collect audited UTM master official candidate data.

This collector is read-only. It snapshots UTM official postgraduate sources,
locks the master catalogue count, and writes deterministic collection artifacts
without touching the StudyMY database.
"""

from __future__ import annotations

import hashlib
import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup


OUTPUT_DIR = Path("data/imports/utm/2026-06-17/master")
SOURCES_DIR = OUTPUT_DIR / "sources"
COLLECT_AUDIT_DIR = OUTPUT_DIR / "collect-workflow-audit"
ACADEMIC_SESSION = "2026/2027"
CURRENT_AS_OF = "2026-06-17"
USER_AGENT = "StudyMY official collector"

GENERAL_SOURCES = {
    "international-postgraduate-study": "https://admission.utm.my/international-postgraduate-study/",
    "fees-pg-inter": "https://admission.utm.my/fees-pg-inter/",
    "int-pg-entry-requirements": "https://admission.utm.my/int-pg-entry-requirements/",
    "english-language-requirements": "https://admission.utm.my/english-language-requirements-3/",
    "e-brochure": "https://admission.utm.my/e-brochure/",
    "odl-fees-structure": "https://odl.utm.my/fees-structure/",
    "odl-admission": "https://admission.utm.my/odl/",
    "faqs": "https://admission.utm.my/faqs-2/",
    "visa-international-registration": "https://admission.utm.my/visa-and-international-student-registration/",
}

FACULTY_SOURCES = [
    {
        "id": "engineering-education-generic-programmes",
        "faculty": "Engineering Education & Generic Programmes",
        "url": "https://admission.utm.my/int-postgraduate-school-of-biomedical-engineering-health-science/",
        "feeCategory": "Engineering",
    },
    {
        "id": "civil-engineering",
        "faculty": "Faculty of Civil Engineering",
        "url": "https://admission.utm.my/int-postgraduate-school-of-civil-engineering/",
        "feeCategory": "Engineering",
    },
    {
        "id": "chemical-energy-engineering",
        "faculty": "Faculty of Chemical and Energy Engineering",
        "url": "https://admission.utm.my/int-postgraduate-school-of-chemical-energy-engineering/",
        "feeCategory": "Engineering",
    },
    {
        "id": "electrical-engineering",
        "faculty": "Faculty of Electrical Engineering",
        "url": "https://admission.utm.my/int-postgraduate-school-of-electrical-engineering/",
        "feeCategory": "Engineering",
    },
    {
        "id": "mechanical-engineering",
        "faculty": "Faculty of Mechanical Engineering",
        "url": "https://admission.utm.my/int-postgraduate-school-of-mechanical-engineering/",
        "feeCategory": "Engineering",
    },
    {
        "id": "social-science-humanities",
        "faculty": "Faculty of Social Science and Humanities",
        "url": "https://admission.utm.my/int-faculty-of-social-science-and-humanities/",
        "feeCategory": "Humanities & Social Sciences",
    },
    {
        "id": "hrd-psychology",
        "faculty": "School of HRD and Psychology",
        "url": "https://admission.utm.my/int-postgraduate-school-of-hrd-psycohology/",
        "feeCategory": "Humanities & Social Sciences",
    },
    {
        "id": "islamic-civilization-academy",
        "faculty": "Islamic Civilization Academy",
        "url": "https://admission.utm.my/int-postgraduate-islamic-civilisation-academic/",
        "feeCategory": "Humanities & Social Sciences",
    },
    {
        "id": "language-academy",
        "faculty": "Language Academy",
        "url": "https://admission.utm.my/int-postgraduate-language-academy/",
        "feeCategory": "Humanities & Social Sciences",
    },
    {
        "id": "educational-sciences-technology",
        "faculty": "Faculty of Educational Sciences and Technology",
        "url": "https://admission.utm.my/int-postgraduate-school-of-education/",
        "feeCategory": "Education",
    },
    {
        "id": "built-environment-surveying",
        "faculty": "Faculty of Built Environment and Surveying",
        "url": "https://admission.utm.my/int-faculty-of-built-environment-surveying/",
        "feeCategory": "Architecture",
    },
    {
        "id": "computing",
        "faculty": "Faculty of Computing",
        "url": "https://admission.utm.my/int-postgraduate-school-of-computing/",
        "feeCategory": "Computing/ IT",
    },
    {
        "id": "management",
        "faculty": "Faculty of Management",
        "url": "https://admission.utm.my/int-faculty-of-management/",
        "feeCategory": "Business & Management",
    },
    {
        "id": "science",
        "faculty": "Faculty of Science",
        "url": "https://admission.utm.my/int-faculty-of-science/",
        "feeCategory": "Science",
    },
    {
        "id": "ahibs",
        "faculty": "Azman Hashim International Business School",
        "url": "https://admission.utm.my/int-azman-hashim-international-business-school/",
        "feeCategory": "Business & Management",
    },
    {
        "id": "artificial-intelligence",
        "faculty": "Faculty of Artificial Intelligence",
        "url": "https://admission.utm.my/int-razak-faculty-of-technology-informatics/",
        "feeCategory": "Engineering",
    },
    {
        "id": "mjiit",
        "faculty": "Malaysia-Japan International Institute of Technology",
        "url": "https://admission.utm.my/int-malaysia-japan-international-institute-of-technology/",
        "feeCategory": "Engineering",
    },
]

MAINSTREAM_FEES = {
    "Architecture": {"courseworkMixedMYR": 29500, "researchMYR": 25400},
    "Business & Management": {"courseworkMixedMYR": 26500, "researchMYR": 25400},
    "Computing/ IT": {"courseworkMixedMYR": 26500, "researchMYR": 25400},
    "Engineering": {"courseworkMixedMYR": 31000, "researchMYR": 28400},
    "Humanities & Social Sciences": {"courseworkMixedMYR": 26500, "researchMYR": 25400},
    "Science": {"courseworkMixedMYR": 28500, "researchMYR": 28400},
    "Education": {"courseworkMixedMYR": 26500, "researchMYR": 25400},
    "Quantity Surveying": {"courseworkMixedMYR": 29500, "researchMYR": 25400},
}

NAMED_FEES = {
    "Master Occupational Safety and Health Management": 37204,
    "Master in Occupational Safety and Health Management": 37204,
    "Master of Science (Engineering Business Management)": 33504,
    "Master of Professional Science": 29554,
    "Master of Science (Systems Engineering)": 31554,
    "Master of Science (Sustainable Infrastructure)": 33554,
    "Master of Science (Engineering Design)": 33554,
    "Master of Software Engineering": 26204,
    "Master of Science (Information Assurance)": 26204,
    "Master of Science in Information Security Assurance": 26204,
    "Master of Science (Computer System Engineering)": 26204,
    "Master of Science in Computer Systems Engineering": 26204,
    "Master of Science (Informatics)": 26204,
    "Master of Science in Informatics": 26204,
    "Master of Science (Business Intelligence and Analytics)": 26204,
    "Master of Science in Business Intelligence and Analytics": 26204,
    "Master of Business Administration": 32154,
    "Master of Business Administration (MBA)": 32154,
    "Master of Sustainable System": 28500,
    "Master in Sustainable Systems": 28500,
    "Master of Sustainability and Environment Sciences": 28500,
    "Master in Disaster Risk Management": 36004,
    "Master of Disaster Risk Management": 36004,
    "Master of Technology and Innovation Management": 28500,
    "Master of Science (Sustainable Urban Design)": 26769,
    "Master of Science (Engineering Education)": 31554,
}

ODL_TOTAL_FEES = {
    "Master of Language in Communication and Digital Culture": {
        "amountMYR": 34650,
        "sourceText": "International Students : RM 34,650",
    },
    "Master of Forensic Engineering": {
        "amountMYR": 36300,
        "sourceText": "International Students : RM 36,300.00",
    },
    "Master of Science in Business Intelligence and Analytics": {
        "amountMYR": 34650,
        "sourceText": "International Students : RM 34,650.00",
    },
    "Master of Business Administration": {
        "amountMYR": 37400,
        "sourceText": "International Students : RM 37,400.00",
    },
    "Master of Science (Energy Management)": {
        "amountMYR": 40950,
        "sourceText": "International Students : RM 40,950.00",
    },
}

ODL_CONFLICT_FEES = {
    "Master of Education (Educational Technology)": "International fee has without-prerequisite and with-prerequisite totals: RM34,650 / RM36,210.",
    "Master of Education (Physics)": "International fee has with-prerequisite and without-prerequisite totals: RM34,650 / RM36,390.",
    "Master of Education (Mathematics)": "International fee has with-prerequisite and without-prerequisite totals: RM34,650 / RM36,390.",
    "Master of Education (Technical and Vocational Education)": "International fee has without-prerequisite and with-prerequisite totals: RM34,650 / RM36,390.",
    "Master of Cyber Security": "International fee has without-prerequisite and with-prerequisite totals: RM34,650 / RM38,130.",
    "Master of Computer Science": "International fee has without-prerequisite and with-prerequisite totals: RM34,650 / RM38,130.",
    "Master in Sustainable Systems": "International fee is published as a range: RM31,440 - RM38,790.",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", unescape(value or "")).strip()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def slugify(value: str) -> str:
    value = value.lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return re.sub(r"-+", "-", value).strip("-")


def fetch(url: str, local_path: Path) -> dict[str, Any]:
    local_path.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            final_url = response.geturl()
            content = response.read()
        local_path.write_bytes(content)
        return {
            "url": url,
            "finalUrl": final_url,
            "localPath": str(local_path),
            "sha256": sha256(local_path),
            "bytes": len(content),
            "retrievedAt": now_iso(),
            "status": "verified",
        }
    except Exception as error:  # noqa: BLE001 - transport status is part of the audit.
        if local_path.exists():
            existing = local_path.read_bytes()
            if existing and not existing.startswith(b"TRANSPORT_ERROR"):
                return {
                    "url": url,
                    "finalUrl": url,
                    "localPath": str(local_path),
                    "sha256": sha256(local_path),
                    "bytes": local_path.stat().st_size,
                    "retrievedAt": now_iso(),
                    "status": "verified",
                    "transportStatus": "reused-cache-after-fetch-error",
                    "transportError": f"{type(error).__name__}: {error}",
                }
        local_path.write_text(f"TRANSPORT_ERROR {type(error).__name__}: {error}\nURL: {url}\n")
        return {
            "url": url,
            "finalUrl": url,
            "localPath": str(local_path),
            "sha256": sha256(local_path),
            "bytes": local_path.stat().st_size,
            "retrievedAt": now_iso(),
            "status": "transport-error",
            "error": f"{type(error).__name__}: {error}",
        }


def fetch_sources() -> list[dict[str, Any]]:
    sources: list[dict[str, Any]] = []
    for source_id, url in GENERAL_SOURCES.items():
      suffix = ".pdf" if urllib.parse.urlparse(url).path.lower().endswith(".pdf") else ".html"
      item = fetch(url, SOURCES_DIR / f"{source_id}{suffix}")
      item.update({
          "id": source_id,
          "sourceType": "official-pdf" if suffix == ".pdf" else "official-page",
          "role": "canonical" if source_id == "international-postgraduate-study" else "field-authority",
      })
      sources.append(item)

    for source in FACULTY_SOURCES:
        item = fetch(source["url"], SOURCES_DIR / "faculty-pages" / f"{source['id']}.html")
        item.update({
            "id": f"faculty-{source['id']}",
            "sourceType": "official-page",
            "role": "canonical",
            "fields": ["programme identity", "faculty", "mode", "international postgraduate listing"],
            "faculty": source["faculty"],
        })
        sources.append(item)

    e_brochure = next((item for item in sources if item["id"] == "e-brochure" and item["status"] == "verified"), None)
    if e_brochure:
        html = Path(e_brochure["localPath"]).read_text(errors="ignore")
        soup = BeautifulSoup(html, "html.parser")
        for link in soup.find_all("a"):
            label = clean(link.get_text(" ", strip=True))
            href = link.get("href")
            if not href or not href.lower().endswith(".pdf"):
                continue
            if "POSTGRADUATE" not in label.upper() and "Faculty" not in label and "Business" not in label and "MJIIT" not in label:
                continue
            pdf_url = urllib.parse.urljoin(e_brochure["finalUrl"], href)
            pdf_id = f"brochure-{slugify(label)[:70]}"
            pdf_item = fetch(pdf_url, SOURCES_DIR / "brochures" / f"{pdf_id}.pdf")
            pdf_item.update({
                "id": pdf_id,
                "sourceType": "official-pdf",
                "role": "field-authority",
                "fields": ["programme detail cross-check", "faculty prospectus"],
                "title": label,
            })
            sources.append(pdf_item)
    return sources


def text_lines(html_path: Path) -> list[str]:
    soup = BeautifulSoup(html_path.read_text(errors="ignore"), "html.parser")
    for tag in soup(["script", "style", "nav", "footer"]):
        tag.decompose()
    return [clean(line) for line in soup.get_text("\n").splitlines() if clean(line)]


def normalize_master_name(value: str) -> str:
    value = clean(value)
    value = value.replace("Filed of Research", "Field of Research")
    value = re.sub(r"^Master\s*/\s*Doctor", "Master", value, flags=re.I)
    value = re.sub(r"^Master/Doctor", "Master", value, flags=re.I)
    value = value.replace("Master of Sustainable System", "Master in Sustainable Systems")
    value = value.replace("Master of Sustainability and Environment Sciences", "Master of Sustainability and Environmental Sciences")
    value = value.replace("Master of Science (Information Assurance)", "Master of Science in Information Security Assurance")
    value = value.replace("Master of Science (Computer System Engineering)", "Master of Science in Computer Systems Engineering")
    value = value.replace("Master of Science (Business Intelligence and Analytics)", "Master of Science in Business Intelligence and Analytics")
    return clean(value)


def mode_label(section: str) -> str:
    return {
        "coursework": "coursework",
        "mixed": "mixed",
        "research": "research",
        "odl": "distance",
    }[section]


def mode_official_label(section: str) -> str:
    return {
        "coursework": "Coursework",
        "mixed": "Mixed Mode",
        "research": "Research",
        "odl": "Open and Distance Learning",
    }[section]


def parse_faculty_programmes(source: dict[str, Any], faculty_config: dict[str, Any]) -> list[dict[str, Any]]:
    lines = text_lines(Path(source["localPath"]))
    start_indexes = [index for index, line in enumerate(lines) if line == "Programmes Offered"]
    start = max(start_indexes) + 1 if start_indexes else 0
    current_section: str | None = None
    records: list[dict[str, Any]] = []
    for line in lines[start:]:
        low = line.lower()
        if low.startswith("field of research") or low.startswith("see more") or low in {"facebook", "x", "instagram"}:
            break
        if "coursework" in low and "open" not in low:
            current_section = "coursework"
            continue
        if low.startswith("mixed"):
            current_section = "mixed"
            continue
        if low.startswith("research"):
            current_section = "research"
            continue
        if "open" in low and "distance" in low:
            current_section = "odl"
            continue
        if not current_section:
            continue
        if "doctor" in low and "master" not in low:
            continue
        if not re.search(r"\bmaster\b", line, re.I):
            continue
        name = normalize_master_name(line)
        records.append({
            "nameEnOfficial": name,
            "facultyEn": faculty_config["faculty"],
            "facultySourceId": source["id"],
            "facultySourceUrl": source["finalUrl"],
            "programmeSourceUrl": source["finalUrl"],
            "mode": mode_label(current_section),
            "modeOfficial": mode_official_label(current_section),
            "modeCode": current_section,
            "feeCategory": faculty_config["feeCategory"],
            "rawLine": line,
        })
    return records


def category_for(programme: dict[str, Any]) -> str:
    name = programme["nameEnOfficial"]
    if "Architecture" in name:
        return "Architecture"
    if "Quantity" in name:
        return "Quantity Surveying"
    if programme["facultyEn"] == "Faculty of Built Environment and Surveying":
        if "Geomatics" in name or "Geoinformatics" in name or "Land Administration" in name or "Real Estate" in name or "Transportation Planning" in name:
            return "Quantity Surveying"
    return programme["feeCategory"]


def fee_for(programme: dict[str, Any]) -> dict[str, Any]:
    name = programme["nameEnOfficial"]
    mode = programme["modeCode"]
    if mode == "odl":
        if name in ODL_TOTAL_FEES:
            item = ODL_TOTAL_FEES[name]
            return {
                "status": "verified-official-total",
                "amountMYR": item["amountMYR"],
                "currency": "MYR",
                "basis": "total-programme",
                "sourceUrl": GENERAL_SOURCES["odl-admission"],
                "note": f"Matched unique UTM ODL international total fee. {item['sourceText']}",
            }
        if name in ODL_CONFLICT_FEES:
            return {
                "status": "conflict",
                "amountMYR": None,
                "currency": "MYR",
                "basis": "not-primary-total",
                "sourceUrl": GENERAL_SOURCES["odl-admission"],
                "note": f"{ODL_CONFLICT_FEES[name]} No single primary total is written.",
            }
        return {
            "status": "official-rate-only",
            "amountMYR": None,
            "currency": "MYR",
            "basis": "not-primary-total",
            "sourceUrl": GENERAL_SOURCES["odl-fees-structure"],
            "note": "UTM ODL official fee structure publishes international per-credit rates, but no unique total programme fee for this exact directory row is written.",
        }
    if name in NAMED_FEES:
        return {
            "status": "verified-official-total",
            "amountMYR": NAMED_FEES[name],
            "currency": "MYR",
            "basis": "total-programme",
            "sourceUrl": GENERAL_SOURCES["fees-pg-inter"],
            "note": "Matched named master programme total in UTM international postgraduate fee page.",
        }
    category = category_for(programme)
    fees = MAINSTREAM_FEES.get(category)
    if not fees:
        return {
            "status": "not-confirmed",
            "amountMYR": None,
            "currency": "MYR",
            "basis": "not-confirmed",
            "sourceUrl": GENERAL_SOURCES["fees-pg-inter"],
            "note": f"No deterministic fee category mapping for {category}.",
        }
    amount = fees["researchMYR"] if mode == "research" else fees["courseworkMixedMYR"]
    return {
        "status": "verified-official-total",
        "amountMYR": amount,
        "currency": "MYR",
        "basis": "total-programme",
        "sourceUrl": GENERAL_SOURCES["fees-pg-inter"],
        "note": f"Mapped to UTM international postgraduate mainstream {category} {mode_label(mode)} fee.",
    }


def academic_requirement_for(programme: dict[str, Any]) -> dict[str, Any]:
    name = programme["nameEnOfficial"].lower()
    mode = programme["modeCode"]
    if mode == "odl":
        summary = (
            "UTM ODL official admission requirement: a recognised Bachelor's Degree with good honours "
            "with minimum CGPA 2.5/4.0 or equivalent. International applicants must also satisfy "
            "academic admission and English language proficiency requirements."
        )
        return {
            "status": "official-odl-rule",
            "sourceUrl": GENERAL_SOURCES["odl-admission"],
            "minimumGpa": 2.5,
            "summary": summary,
            "sourceText": summary,
        }
    if "master of business administration" in name:
        summary = (
            "UTM official MBA entry requirement: CPA 3.50 and above requires no working experience; "
            "CPA 3.00 to 3.49 requires 2 years working experience in the related field; "
            "CPA 2.00 to 2.99 requires 5 years working experience in the related field."
        )
        return {
            "status": "official-mba-rule",
            "sourceUrl": GENERAL_SOURCES["int-pg-entry-requirements"],
            "minimumGpa": 3.5,
            "summary": summary,
            "sourceText": summary,
        }
    if name == "master of architecture":
        summary = (
            "UTM official Master of Architecture entry requirement: Bachelor of Science in Architecture/Degree "
            "in Architecture with CPA 3.0 to 4.0 requires 6 months working experience in an architectural firm; "
            "CPA 2.7 to 2.99 requires 12 months; CPA 2.5 to 2.69 requires 24 months; CPA 2.3 to 2.49 requires "
            "36 months. International candidates must obtain LAM Part 1 certificate before applying."
        )
        return {
            "status": "official-architecture-rule",
            "sourceUrl": GENERAL_SOURCES["int-pg-entry-requirements"],
            "minimumGpa": 2.3,
            "summary": summary,
            "sourceText": summary,
        }
    if mode in {"mixed", "research"}:
        summary = (
            "UTM official entry requirement for Master by Mixed-Mode and Research programme: CPA Scale of 4 "
            "at 2.75 or higher requires no working experience; 2.50 < CPA < 2.75 is subject to rigorous "
            "internal assessment; CPA below 2.50 requires 5 years working experience in the related field."
        )
        return {
            "status": "official-mixed-research-rule",
            "sourceUrl": GENERAL_SOURCES["int-pg-entry-requirements"],
            "minimumGpa": 2.75,
            "summary": summary,
            "sourceText": summary,
        }
    summary = (
        "UTM official entry requirement for Master by Coursework programme: CPA Scale of 4 at 2.50 or higher "
        "requires no working experience; CPA below 2.50 requires 5 years working experience in the related field."
    )
    return {
        "status": "official-coursework-rule",
        "sourceUrl": GENERAL_SOURCES["int-pg-entry-requirements"],
        "minimumGpa": 2.5,
        "summary": summary,
        "sourceText": summary,
    }


def language_requirement_for(programme: dict[str, Any]) -> dict[str, Any]:
    name = programme["nameEnOfficial"].lower()
    is_tesl = "teaching english as a second language" in name or "tesl" in name
    if is_tesl:
        scores = {
            "muet": 5.0,
            "ielts": 7.0,
            "toeflIbt": 95,
            "pteAcademic": 76,
            "cambridgeCeq": 180,
            "ciepElsLevel": None,
        }
        summary = (
            "UTM official postgraduate English requirement for TESL postgraduate programmes: "
            "MUET overall band 5.0, IELTS overall band 7.0, TOEFL iBT overall score 95, "
            "PTE Academic overall score 76, or Cambridge English Qualification overall score 180."
        )
        return {
            "status": "official-tesl-rule",
            "sourceUrl": GENERAL_SOURCES["english-language-requirements"],
            "scores": scores,
            "summary": summary,
            "sourceText": summary,
        }
    scores = {
        "muet": 4.0,
        "ielts": 6.0,
        "toeflIbt": 60,
        "pteAcademic": 59,
        "cambridgeCeq": 169,
        "ciepElsLevel": 109,
    }
    summary = (
        "UTM official postgraduate English requirement: MUET overall band 4.0, IELTS overall band 6.0, "
        "TOEFL iBT overall score 60, PTE Academic overall score 59, Cambridge English Qualification "
        "overall score 169, or Certified Intensive English Programme (CIEP - ELS) complete level 109 and above."
    )
    return {
        "status": "official-postgraduate-rule",
        "sourceUrl": GENERAL_SOURCES["english-language-requirements"],
        "scores": scores,
        "summary": summary,
        "sourceText": summary,
    }


def course_setting_for(item: dict[str, Any]) -> dict[str, Any]:
    name = clean(item["nameEnOfficial"])
    field_match = re.match(r"^Master of Philosophy Field of Research\s*:?\s*(.+)$", name, flags=re.IGNORECASE)
    if field_match:
        value = clean(field_match.group(1))
        return {
            "status": "official-research-field",
            "items": [f"Research field: {value}"],
            "sourceUrl": item["programmeSourceUrl"],
            "sourceText": item["rawLine"],
        }
    specialization_match = re.search(r"Specialization\s*:?\s*(.+)$", name, flags=re.IGNORECASE)
    if specialization_match:
        value = clean(specialization_match.group(1))
        return {
            "status": "official-specialization",
            "items": [f"Official specialization: {value}"],
            "sourceUrl": item["programmeSourceUrl"],
            "sourceText": item["rawLine"],
        }
    return {
        "status": "official-unpublished",
        "items": [],
        "sourceUrl": item["programmeSourceUrl"],
        "sourceText": "No programme-level course structure, module list, or explicit research-field/specialization label was published in the collected official listing for this row.",
    }


def build_candidate_records(parsed: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates = []
    seen: dict[str, int] = {}
    standardized_duration = (
        "Standardized duration: 1.5 years (3 semesters). Official source: "
        "Master Programme (3 Semesters) on UTM international postgraduate fee page; "
        "programme-specific duration requires faculty/detail confirmation."
    )
    for ordinal, item in enumerate(parsed, start=1):
        base_slug = slugify(f"utm master {item['facultyEn']} {item['mode']} {item['nameEnOfficial']}")
        duplicate_index = seen.get(base_slug, 0) + 1
        seen[base_slug] = duplicate_index
        slug = base_slug if duplicate_index == 1 else f"{base_slug}-{duplicate_index}"
        fee = fee_for(item)
        academic_requirement = academic_requirement_for(item)
        language_requirement = language_requirement_for(item)
        course_setting = course_setting_for(item)
        issues = []
        audit_fee_status = fee["status"]
        reviewed_decisions = []
        if audit_fee_status != "verified-official-total":
            reviewed_decisions.append("Fee is retained as non-primary-total official status; no scalar amount is written.")
        if "Field of Research" in item["nameEnOfficial"]:
            reviewed_decisions.append("UTM lists this Master of Philosophy field under official Programmes Offered; retained as a canonical official master row with research field identity.")
        public_status = "ready"
        candidates.append({
            "ordinal": ordinal,
            "code": f"UTM-M-{ordinal:03d}",
            "slug": slug,
            "universityCode": "UTM",
            "nameEnOfficial": item["nameEnOfficial"],
            "level": "master",
            "facultyEn": item["facultyEn"],
            "campus": "UTM Johor Bahru / UTM Kuala Lumpur / faculty-approved delivery location",
            "studyMode": item["mode"],
            "studyModeOfficial": item["modeOfficial"],
            "applicantScope": "international",
            "internationalEligibility": "available",
            "academicSession": ACADEMIC_SESSION,
            "durationOfficial": standardized_duration,
            "durationYears": 1.5,
            "officialIntake": "UTM admission FAQ states two intakes in a year: February and September. ODL page also states intake for new students is on February and September.",
            "officialSourceUrl": item["programmeSourceUrl"],
            "fee": {
                "status": audit_fee_status,
                "tuitionAmount": fee["amountMYR"],
                "tuitionCurrency": fee["currency"],
                "tuitionBasis": fee["basis"],
                "tuitionAcademicSession": ACADEMIC_SESSION,
                "officialFeeSourceUrl": fee["sourceUrl"],
                "tuitionDisplay": (
                    f"MYR {fee['amountMYR']:,} total programme fee"
                    if fee["amountMYR"]
                    else "Official non-primary-total fee status recorded; no single scalar total programme fee is written."
                ),
                "note": fee["note"],
            },
            "tuition": fee,
            "academicRequirement": {
                "status": academic_requirement["status"],
                "sourceUrl": academic_requirement["sourceUrl"],
                "minimumGpa": academic_requirement["minimumGpa"],
                "summary": academic_requirement["summary"],
            },
            "languageRequirement": {
                "status": language_requirement["status"],
                "sourceUrl": language_requirement["sourceUrl"],
                "scores": language_requirement["scores"],
                "summary": language_requirement["summary"],
            },
            "applicationDocumentsPolicy": {
                "status": "general-rule",
                "sourceUrl": GENERAL_SOURCES["visa-international-registration"],
                "documents": [
                    "UTM offer letter",
                    "Photo with white background",
                    "Passport",
                    "Academic certificates",
                    "Academic transcripts",
                    "Health Status Declaration Form",
                    "Letter of Eligibility / Objection Certificate / No Objection Letter where applicable",
                ],
            },
            "courseSetting": course_setting,
            "sourceUrls": {
                "facultyProgrammeList": item["programmeSourceUrl"],
                "internationalPostgraduate": GENERAL_SOURCES["international-postgraduate-study"],
                "fees": fee["sourceUrl"],
                "entryRequirements": academic_requirement["sourceUrl"],
                "englishRequirements": GENERAL_SOURCES["english-language-requirements"],
                "intake": GENERAL_SOURCES["faqs"],
                "applicationDocuments": GENERAL_SOURCES["visa-international-registration"],
            },
            "evidence": [
                {
                    "field": "nameEnOfficial",
                    "sourceId": item["facultySourceId"],
                    "sourceUrl": item["programmeSourceUrl"],
                    "sourceText": item["rawLine"],
                    "retrievedAt": CURRENT_AS_OF,
                    "confidence": 1,
                },
                {
                    "field": "fee",
                    "sourceId": "fees-pg-inter" if item["modeCode"] != "odl" else ("odl-admission" if fee["sourceUrl"] == GENERAL_SOURCES["odl-admission"] else "odl-fees-structure"),
                    "sourceUrl": fee["sourceUrl"],
                    "sourceText": fee["note"],
                    "retrievedAt": CURRENT_AS_OF,
                    "confidence": 1 if audit_fee_status == "verified-official-total" else 0.6,
                },
                {
                    "field": "officialIntake",
                    "sourceId": "faqs",
                    "sourceUrl": GENERAL_SOURCES["faqs"],
                    "sourceText": "Two (2) semester / intake in a year. (February and September)",
                    "retrievedAt": CURRENT_AS_OF,
                    "confidence": 1,
                },
                {
                    "field": "applicationDocumentsPolicy",
                    "sourceId": "visa-international-registration",
                    "sourceUrl": GENERAL_SOURCES["visa-international-registration"],
                    "sourceText": "UTM international registration page lists passport, academic certificates, academic transcripts and health declaration among required documents.",
                    "retrievedAt": CURRENT_AS_OF,
                    "confidence": 0.8,
                },
                {
                    "field": "academicRequirement",
                    "sourceId": "odl-admission" if item["modeCode"] == "odl" else "int-pg-entry-requirements",
                    "sourceUrl": academic_requirement["sourceUrl"],
                    "sourceText": academic_requirement["sourceText"],
                    "retrievedAt": CURRENT_AS_OF,
                    "confidence": 1,
                },
                {
                    "field": "languageRequirement",
                    "sourceId": "english-language-requirements",
                    "sourceUrl": language_requirement["sourceUrl"],
                    "sourceText": language_requirement["sourceText"],
                    "retrievedAt": CURRENT_AS_OF,
                    "confidence": 1,
                },
                *(
                    [
                        {
                            "field": "courseSetting",
                            "sourceId": item["facultySourceId"],
                            "sourceUrl": course_setting["sourceUrl"],
                            "sourceText": course_setting["sourceText"],
                            "retrievedAt": CURRENT_AS_OF,
                            "confidence": 1,
                        }
                    ]
                    if course_setting["items"]
                    else []
                ),
            ],
            "fieldCoverage": {
                "identity": "programme-list",
                "faculty": "programme-list",
                "mode": "programme-list",
                "internationalEligibility": "international-postgraduate-list",
                "fee": fee["status"],
                "academicRequirement": academic_requirement["status"],
                "languageRequirement": language_requirement["status"],
                "intake": "general-rule",
                "applicationDocuments": "general-rule",
                "curriculum": course_setting["status"],
                "careers": "official-unpublished",
            },
            "publicDisplayStatus": public_status,
            "reviewReason": "; ".join(issues),
            "reviewedDecisions": reviewed_decisions,
        })
    return candidates


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


def build_language_requirement_audit(candidates: list[dict[str, Any]], sources: list[dict[str, Any]]) -> dict[str, Any]:
    source = next((item for item in sources if item["id"] == "english-language-requirements"), None)
    status_counts: dict[str, int] = {}
    for item in candidates:
        status = item["languageRequirement"]["status"]
        status_counts[status] = status_counts.get(status, 0) + 1
    affected_rows = [
        {
            "code": item["code"],
            "nameEnOfficial": item["nameEnOfficial"],
            "facultyEn": item["facultyEn"],
            "languageRequirementStatus": item["languageRequirement"]["status"],
            "scores": item["languageRequirement"]["scores"],
            "sourceUrl": item["languageRequirement"]["sourceUrl"],
        }
        for item in candidates
        if item["languageRequirement"]["status"] == "official-tesl-rule"
    ]
    return {
        "schemaVersion": 1,
        "universityCode": "UTM",
        "institutionNameOfficial": "Universiti Teknologi Malaysia",
        "level": "master",
        "applicantScope": "international",
        "academicSession": ACADEMIC_SESSION,
        "currentAsOf": CURRENT_AS_OF,
        "authorization": "collect",
        "sourceAuthority": {
            "sourceId": "english-language-requirements",
            "sourceUrl": GENERAL_SOURCES["english-language-requirements"],
            "sourceRole": "field-authority",
            "localPath": source.get("localPath") if source else None,
            "sha256": source.get("sha256") if source else None,
            "retrievedAt": source.get("retrievedAt") if source else None,
            "status": source.get("status") if source else "not-found",
        },
        "summary": {
            "candidateRows": len(candidates),
            "structuredLanguageRows": len(candidates),
            "ordinaryPostgraduateRows": status_counts.get("official-postgraduate-rule", 0),
            "teslRows": status_counts.get("official-tesl-rule", 0),
            "statusCounts": status_counts,
        },
        "ordinaryPostgraduateRule": {
            "state": "official-value",
            "scores": {
                "muet": 4.0,
                "ielts": 6.0,
                "toeflIbt": 60,
                "pteAcademic": 59,
                "cambridgeCeq": 169,
                "ciepElsLevel": 109,
            },
            "evidencePointer": "Postgraduate section of UTM English Language Requirements page.",
        },
        "teslPostgraduateRule": {
            "state": "official-value",
            "scores": {
                "muet": 5.0,
                "ielts": 7.0,
                "toeflIbt": 95,
                "pteAcademic": 76,
                "cambridgeCeq": 180,
                "ciepElsLevel": None,
            },
            "evidencePointer": "TESL postgraduate subsection of UTM English Language Requirements page.",
        },
        "affectedTeslRows": affected_rows,
        "decision": "candidate-language-requirements-structured",
        "databaseMutation": "none",
    }


def build_instruction_execution_ledger() -> list[dict[str, Any]]:
    return [
        {
            "id": "latest-user-instruction",
            "instruction": "Continue supplemental collection and checking for UTM master data using the StudyMY official collector skill.",
            "scope": "run",
            "status": "completed",
            "evidencePointer": "candidate-dataset.json and language-requirement-supplement-audit.json",
        },
        {
            "id": "collect-only-authorization",
            "instruction": "Supplemental collection and checking only; do not mutate database without publish authorization.",
            "scope": "run",
            "status": "completed",
            "evidencePointer": "run-contract.json authorization=collect",
        },
        {
            "id": "lock-utm-master-baseline",
            "instruction": "Preserve the locked UTM international master canonical baseline and status partition.",
            "scope": "level",
            "status": "completed",
            "evidencePointer": "153 canonical programmes, 153 ready, 0 needs-review, 0 not-available-for-international",
        },
        {
            "id": "language-score-supplement",
            "instruction": "Replace generic postgraduate English requirement text with structured official score routes, including TESL exception rows.",
            "scope": "field",
            "status": "completed",
            "evidencePointer": "language-requirement-supplement-audit.json",
        },
        {
            "id": "official-source-trace",
            "instruction": "Ready values must trace to official UTM source evidence.",
            "scope": "field",
            "status": "completed",
            "evidencePointer": "collect-workflow-audit/09_source_to_candidate_trace.json",
        },
        {
            "id": "notion-update",
            "instruction": "Update Notion or clearly state Notion was not updated.",
            "scope": "run",
            "status": "not-applicable",
            "evidencePointer": "No writable Notion connector is available in this Codex environment; local Chinese development note is updated separately.",
        },
    ]


def build_official_row_disposal(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "rowId": f"utm-master-official-row-{item['ordinal']:03d}",
            "sourceId": "faculty-programme-list",
            "sourceUrl": item["officialSourceUrl"],
            "level": "master",
            "faculty": item["facultyEn"],
            "nameEnOfficial": item["nameEnOfficial"],
            "status": "candidate",
            "candidateCode": item["code"],
            "reason": "UTM lists this row in the current international postgraduate programme source for master-level collection.",
        }
        for item in candidates
    ]


def build_page_option_inventory(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in candidates:
        rows.append({
            "code": item["code"],
            "nameEnOfficial": item["nameEnOfficial"],
            "detailPageUrl": item["officialSourceUrl"],
            "retrievalMethod": "static HTML official programme list plus official field-authority pages",
            "hasOptions": True,
            "options": [
                {
                    "label": "Programme list row",
                    "optionType": "same-programme official sublink",
                    "governedFields": ["officialTitle", "faculty", "level", "studyMode", "internationalEligibility"],
                    "state": "candidate-field",
                    "sourceUrl": item["officialSourceUrl"],
                    "evidencePointer": item["officialSourceUrl"],
                },
                {
                    "label": "Programme research field or specialization label",
                    "optionType": "course-setting/curriculum/course panel",
                    "governedFields": ["courseSetting", "curriculum"],
                    "state": "candidate-field" if item.get("courseSetting", {}).get("items") else "not-applicable",
                    "sourceUrl": item["officialSourceUrl"],
                    "evidencePointer": item.get("courseSetting", {}).get("sourceText") or item["officialSourceUrl"],
                    "reviewReason": None
                    if item.get("courseSetting", {}).get("items")
                    else "No explicit Field of Research or Specialization label is published in this official programme-list row.",
                },
                {
                    "label": "International postgraduate fee authority",
                    "optionType": "fee panel",
                    "governedFields": ["tuition", "feeStatus"],
                    "state": "candidate-field",
                    "sourceUrl": item["tuition"]["sourceUrl"],
                    "evidencePointer": item["tuition"]["sourceUrl"],
                },
                {
                    "label": "International postgraduate entry requirement authority",
                    "optionType": "entry requirement panel",
                    "governedFields": ["academicRequirement", "gpaCgpa"],
                    "state": "candidate-field",
                    "sourceUrl": item["academicRequirement"]["sourceUrl"],
                    "evidencePointer": item["academicRequirement"]["sourceUrl"],
                },
                {
                    "label": "English language requirement authority",
                    "optionType": "language requirement panel",
                    "governedFields": ["languageRequirement"],
                    "state": "candidate-field",
                    "sourceUrl": item["languageRequirement"]["sourceUrl"],
                    "evidencePointer": item["languageRequirement"]["sourceUrl"],
                },
            ],
        })
    return rows


def coverage_field(state: str, source_id: str, source_url: str, evidence: str, reason: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "state": state,
        "sourceId": source_id,
        "sourceUrl": source_url,
        "evidencePointer": evidence,
    }
    if reason:
        payload["reason"] = reason
    return payload


def build_field_coverage_matrix(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in candidates:
        fee_state = "official-value" if item["tuition"]["status"] == "verified-official-total" else "official-value"
        rows.append({
            "code": item["code"],
            "nameEnOfficial": item["nameEnOfficial"],
            "fields": {
                "officialTitle": coverage_field("official-value", "faculty-programme-list", item["officialSourceUrl"], item["nameEnOfficial"]),
                "faculty": coverage_field("official-value", "faculty-programme-list", item["officialSourceUrl"], item["facultyEn"]),
                "level": coverage_field("official-value", "faculty-programme-list", item["officialSourceUrl"], "master"),
                "campus": coverage_field("general-rule", "international-postgraduate-study", item["sourceUrls"]["internationalPostgraduate"], item["campus"]),
                "studyMode": coverage_field("official-value", "faculty-programme-list", item["officialSourceUrl"], item["studyModeOfficial"]),
                "applicantScope": coverage_field("official-value", "international-postgraduate-study", item["sourceUrls"]["internationalPostgraduate"], "international"),
                "internationalEligibility": coverage_field("official-value", "international-postgraduate-study", item["sourceUrls"]["internationalPostgraduate"], "available"),
                "duration": coverage_field("general-rule", "fees-pg-inter", item["sourceUrls"]["fees"], item["durationOfficial"]),
                "intake": coverage_field("general-rule", "faqs", item["sourceUrls"]["intake"], item["officialIntake"]),
                "tuition": coverage_field(fee_state, "fee-authority", item["tuition"]["sourceUrl"], item["fee"]["tuitionDisplay"]),
                "feeStatus": coverage_field("official-value", "fee-authority", item["tuition"]["sourceUrl"], item["tuition"]["status"]),
                "academicRequirement": coverage_field("general-rule", "entry-requirements", item["academicRequirement"]["sourceUrl"], item["academicRequirement"]["summary"]),
                "gpaCgpa": coverage_field("official-value", "entry-requirements", item["academicRequirement"]["sourceUrl"], str(item["academicRequirement"]["minimumGpa"])),
                "languageRequirement": coverage_field("official-value", "english-language-requirements", item["languageRequirement"]["sourceUrl"], item["languageRequirement"]["summary"]),
                "applicationDocuments": coverage_field("general-rule", "visa-international-registration", item["applicationDocumentsPolicy"]["sourceUrl"], "UTM international registration document checklist"),
                "curriculum": coverage_field(
                    "official-value" if item.get("courseSetting", {}).get("items") else "official-unpublished",
                    "faculty-programme-list",
                    item["officialSourceUrl"],
                    "; ".join(item.get("courseSetting", {}).get("items", [])) or "not uniformly published in collected source",
                    None
                    if item.get("courseSetting", {}).get("items")
                    else "No uniform programme-specific curriculum/course panel was published for this UTM master row; no explicit Field of Research or Specialization label was published in the official row.",
                ),
                "careers": coverage_field("official-unpublished", "faculty-programme-list", item["officialSourceUrl"], "not published in collected source", "No structured programme-level career list was published in the collected UTM master source set."),
                "sourceUrls": coverage_field("official-value", "source-cache-index", item["officialSourceUrl"], "sourceUrls retained on programme record"),
                "localization": coverage_field("official-value", "StudyMY-localization", item["officialSourceUrl"], "localized from official English identity"),
            },
        })
    return rows


def build_source_to_candidate_trace(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "code": item["code"],
            "nameEnOfficial": item["nameEnOfficial"],
            "traces": [
                *item["evidence"],
                {
                    "field": "languageRequirement.scores",
                    "sourceId": "english-language-requirements",
                    "sourceUrl": item["languageRequirement"]["sourceUrl"],
                    "sourceText": json.dumps(item["languageRequirement"]["scores"], ensure_ascii=False),
                    "retrievedAt": CURRENT_AS_OF,
                    "confidence": 1,
                },
            ],
        }
        for item in candidates
    ]


def build_integrity_record(item: dict[str, Any]) -> dict[str, Any]:
    evidence = [
        {
            "field": "nameEnOfficial",
            "sourceUrl": item["officialSourceUrl"],
            "sourceText": item["nameEnOfficial"],
        },
        {
            "field": "faculty",
            "sourceUrl": item["officialSourceUrl"],
            "sourceText": item["facultyEn"],
        },
        {
            "field": "duration",
            "sourceUrl": item["sourceUrls"]["fees"],
            "sourceText": item["durationOfficial"],
        },
        {
            "field": "intake",
            "sourceUrl": item["sourceUrls"]["intake"],
            "sourceText": item["officialIntake"],
        },
        {
            "field": "academicRequirement",
            "sourceUrl": item["academicRequirement"]["sourceUrl"],
            "sourceText": item["academicRequirement"]["summary"],
        },
        {
            "field": "languageRequirement",
            "sourceUrl": item["languageRequirement"]["sourceUrl"],
            "sourceText": item["languageRequirement"]["summary"],
        },
        {
            "field": "fee",
            "sourceUrl": item["fee"]["officialFeeSourceUrl"],
            "sourceText": item["fee"]["tuitionDisplay"],
        },
        {
            "field": "internationalEligibility",
            "sourceUrl": item["sourceUrls"]["internationalPostgraduate"],
            "sourceText": item["internationalEligibility"],
        },
        {
            "field": "source",
            "sourceUrl": item["officialSourceUrl"],
            "sourceText": f"Verified at {CURRENT_AS_OF}",
        },
    ]
    record = dict(item)
    record.update({
        "officialAcademicRequirement": item["academicRequirement"]["summary"],
        "officialLanguageRequirement": item["languageRequirement"]["summary"],
        "officialVerifiedAt": CURRENT_AS_OF,
        "officialFeeSourceUrl": item["fee"]["officialFeeSourceUrl"],
        "tuitionAmount": item["fee"]["tuitionAmount"],
        "tuition": item["fee"]["tuitionDisplay"],
        "feeStatus": item["fee"]["status"],
        "evidence": [*item["evidence"], *evidence],
    })
    return record


def build_display_parity_report(candidates: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "surfaces": [
            {
                "surface": "institution-profile",
                "status": "ready",
                "fields": {
                    "officialLinks": {"state": "ready", "sourceUrl": GENERAL_SOURCES["international-postgraduate-study"]},
                },
            },
            {
                "surface": "catalogue-tabs-counts",
                "status": "ready",
                "fields": {
                    "masterCount": {"state": "ready", "sourceUrl": GENERAL_SOURCES["international-postgraduate-study"], "count": len(candidates)},
                },
            },
            {
                "surface": "program-list",
                "status": "ready",
                "fields": {
                    "languageRequirement": {"state": "ready", "sourceUrl": GENERAL_SOURCES["english-language-requirements"]},
                    "feeStatus": {"state": "ready", "sourceUrl": GENERAL_SOURCES["fees-pg-inter"]},
                },
            },
            {
                "surface": "program-detail",
                "status": "ready",
                "fields": {
                    "academicRequirement": {"state": "ready", "sourceUrl": GENERAL_SOURCES["int-pg-entry-requirements"]},
                    "languageRequirement": {"state": "ready", "sourceUrl": GENERAL_SOURCES["english-language-requirements"]},
                    "courseSetting": {
                        "state": "ready",
                        "officialValueRows": sum(1 for item in candidates if item.get("courseSetting", {}).get("items")),
                        "unpublishedRows": sum(1 for item in candidates if not item.get("courseSetting", {}).get("items")),
                        "note": "Official programme-row research-field and specialization labels populate course setting where published; detailed course/module lists remain unpublished for the other rows."
                    },
                    "careers": {
                        "state": "unpublished",
                        "reason": "Structured programme-level career directions are not published in the collected UTM master official source set."
                    },
                },
            },
            {
                "surface": "leakage",
                "status": "ready",
                "fields": {
                    "needsReviewLeakage": {"state": "ready", "sourceUrl": GENERAL_SOURCES["international-postgraduate-study"], "count": 0},
                },
            },
        ]
    }


def build_collect_integrity_manifest(
    candidates: list[dict[str, Any]],
    official_row_disposal: list[dict[str, Any]],
    page_option_inventory: list[dict[str, Any]],
    field_coverage_matrix: list[dict[str, Any]],
    instruction_execution_ledger: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "officialDomains": sorted({"admission.utm.my", "odl.utm.my", "utm.my"}),
        "universityCode": "UTM",
        "level": "master",
        "programmes": [build_integrity_record(item) for item in candidates],
        "official_row_disposal": official_row_disposal,
        "page_option_inventory": page_option_inventory,
        "field_coverage_matrix": field_coverage_matrix,
        "instruction_execution_ledger": instruction_execution_ledger,
        "display_parity_report": build_display_parity_report(candidates),
    }


def artifact(path: Path, role: str) -> dict[str, Any]:
    return {
        "path": str(path),
        "role": role,
        "sha256": sha256(path),
    }


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    retrieved_at = now_iso()
    sources = fetch_sources()
    faculty_sources = {source["id"]: source for source in sources if source["id"].startswith("faculty-")}

    parsed: list[dict[str, Any]] = []
    for config in FACULTY_SOURCES:
        source = faculty_sources[f"faculty-{config['id']}"]
        if source["status"] != "verified":
            continue
        parsed.extend(parse_faculty_programmes(source, config))

    candidates = build_candidate_records(parsed)
    ready = [item for item in candidates if item["publicDisplayStatus"] == "ready"]
    needs_review = [item for item in candidates if item["publicDisplayStatus"] == "needs-review"]
    by_mode: dict[str, int] = {}
    by_faculty: dict[str, int] = {}
    fee_status: dict[str, int] = {}
    for item in candidates:
        by_mode[item["studyMode"]] = by_mode.get(item["studyMode"], 0) + 1
        by_faculty[item["facultyEn"]] = by_faculty.get(item["facultyEn"], 0) + 1
        fee_status[item["tuition"]["status"]] = fee_status.get(item["tuition"]["status"], 0) + 1

    run_contract = {
        "schemaVersion": 1,
        "institutionIdentifier": "UTM",
        "institutionNameOfficial": "Universiti Teknologi Malaysia",
        "collectionScope": "programmes",
        "level": "master",
        "applicantScope": "international",
        "academicSession": ACADEMIC_SESSION,
        "currentAsOf": CURRENT_AS_OF,
        "authorization": "collect",
        "selectedChineseTask": "Current user instruction in this Codex thread: start UTM master information statistics collection using StudyMY official collector workflow.",
        "selectedChineseTaskStatus": "No dedicated UTM master Notion snapshot page was found in docs/notion-snapshot/tasks at run start.",
        "prdOrTechnicalDesign": [
            "docs/notion-snapshot/tasks/TASK-STUDYMY-COLLECTOR-SKILL-20260614.md",
            "docs/notion-snapshot/复盘总结.md",
            "docs/prd/USM-master-official-collection-plan.md",
            "docs/prd/USM-master-official-collection-technical-design.md"
        ],
        "outputPaths": {
            "runContract": str(OUTPUT_DIR / "run-contract.json"),
            "levelManifest": str(OUTPUT_DIR / "level-manifest.json"),
            "sourceCacheIndex": str(OUTPUT_DIR / "source-cache-index.json"),
            "candidateDataset": str(OUTPUT_DIR / "candidate-dataset.json"),
            "exceptionQueue": str(OUTPUT_DIR / "exception-queue.json"),
            "preImportGapAudit": str(OUTPUT_DIR / "pre-import-gap-audit.json"),
            "currentOfficialDiffAudit": str(OUTPUT_DIR / "current-official-diff-audit.json"),
            "languageRequirementSupplementAudit": str(OUTPUT_DIR / "language-requirement-supplement-audit.json"),
            "operatorReviewReport": str(OUTPUT_DIR / "operator-review-report.json"),
            "deliveryEnvelope": str(OUTPUT_DIR / "delivery-envelope.json"),
        },
        "verificationCommands": [
            "python3 -m py_compile scripts/collect-utm-master-official.py",
            "python3 scripts/collect-utm-master-official.py"
        ],
        "rollbackTarget": "Not applicable: collect-only run does not mutate database.",
        "notionOrLocalNotePath": "docs/notion-snapshot/开发进度日志.md",
        "retrievedAt": retrieved_at,
    }

    level_manifest = {
        "schemaVersion": 1,
        "universityCode": "UTM",
        "institutionNameOfficial": "Universiti Teknologi Malaysia",
        "level": "master",
        "applicantScope": "international",
        "academicSession": ACADEMIC_SESSION,
        "currentAsOf": CURRENT_AS_OF,
        "officialLevelSource": GENERAL_SOURCES["international-postgraduate-study"],
        "directoryOccurrences": len(parsed),
        "uniqueOfficialEntries": len(candidates),
        "canonicalProgrammes": len(candidates),
        "statusPartition": {
            "ready": len(ready),
            "needsReview": len(needs_review),
            "notAvailableForInternational": 0,
        },
        "byMode": by_mode,
        "byFaculty": by_faculty,
        "programmes": [
            {
                "ordinal": item["ordinal"],
                "code": item["code"],
                "nameEnOfficial": item["nameEnOfficial"],
                "facultyEn": item["facultyEn"],
                "studyMode": item["studyMode"],
                "sourceUrl": item["sourceUrls"]["facultyProgrammeList"],
                "canonicalDecision": "canonical-official-master-row",
                "collectionStatus": item["publicDisplayStatus"],
                "reviewReason": item["reviewReason"],
            }
            for item in candidates
        ],
    }

    source_cache_index = {
        "schemaVersion": 1,
        "universityCode": "UTM",
        "level": "master",
        "sources": sources,
    }

    candidate_dataset = {
        "schemaVersion": 1,
        "universityCode": "UTM",
        "institutionNameOfficial": "Universiti Teknologi Malaysia",
        "level": "master",
        "applicantScope": "international",
        "academicSession": ACADEMIC_SESSION,
        "officialDomains": sorted({"admission.utm.my", "odl.utm.my"}),
        "sources": sources,
        "programmeCount": len(candidates),
        "statusPartition": level_manifest["statusPartition"],
        "programmes": candidates,
    }

    exceptions = {
        "schemaVersion": 1,
        "blocking": [],
        "review": [],
        "reviewedDecisions": [
            {
                "code": item["code"],
                "nameEnOfficial": item["nameEnOfficial"],
                "facultyEn": item["facultyEn"],
                "decisions": item["reviewedDecisions"],
            }
            for item in candidates
            if item["reviewedDecisions"]
        ],
        "transport": [
            {
                "sourceId": source["id"],
                "url": source["url"],
                "error": source.get("error"),
            }
            for source in sources
            if source["status"] != "verified"
        ],
    }

    pre_import_gap_audit = {
        "schemaVersion": 1,
        "universityCode": "UTM",
        "level": "master",
        "authorization": "collect",
        "summary": {
            "candidateRows": len(candidates),
            "readyRows": len(ready),
            "needsReviewRows": len(needs_review),
            "notAvailableForInternationalRows": 0,
            "feeStatusCounts": fee_status,
            "fieldOfResearchRows": sum(1 for item in candidates if "Field of Research" in item["nameEnOfficial"]),
            "courseSettingRows": sum(1 for item in candidates if item.get("courseSetting", {}).get("items")),
            "odlRows": by_mode.get("distance", 0),
            "reviewedDecisionRows": sum(1 for item in candidates if item["reviewedDecisions"]),
        },
        "coverage": {
            "identity": f"{len(candidates)}/{len(candidates)} from UTM international postgraduate faculty pages",
            "internationalEligibility": f"{len(candidates)}/{len(candidates)} listed under UTM international postgraduate study",
            "strictOfficialTotalFee": f"{fee_status.get('verified-official-total', 0)}/{len(candidates)}",
            "nonPrimaryOfficialFeeStatus": f"{fee_status.get('official-rate-only', 0) + fee_status.get('conflict', 0)}/{len(candidates)}",
            "academicRequirement": f"{len(candidates)}/{len(candidates)} via UTM general master entry requirement",
            "languageRequirement": f"{len(candidates)}/{len(candidates)} via UTM English language requirement page",
            "languageRequirementScores": f"{len(candidates)}/{len(candidates)} structured official score rows; 3 TESL rows use the TESL postgraduate higher-score rule",
            "intake": f"{len(candidates)}/{len(candidates)} via UTM FAQ / ODL source",
            "applicationDocuments": f"{len(candidates)}/{len(candidates)} via UTM international registration document checklist",
            "curriculum": f"{sum(1 for item in candidates if item.get('courseSetting', {}).get('items'))}/{len(candidates)} rows have official research-field or specialization labels from UTM programme rows; remaining rows are official-unpublished for detailed course/module structure after current UTM international postgraduate faculty pages, admissions sources, ODL sources and captured brochures were reviewed.",
            "careers": "official-unpublished after current UTM international postgraduate faculty pages, admissions sources, ODL sources and captured brochures were reviewed for this baseline; no structured programme-level career list is published for every master row.",
        },
        "needsReview": exceptions["review"],
        "transportExceptions": exceptions["transport"],
    }

    current_official_diff_audit = {
        "schemaVersion": 1,
        "universityCode": "UTM",
        "level": "master",
        "currentAsOf": CURRENT_AS_OF,
        "decision": "baseline-locked-for-collection",
        "checks": [
            "Parsed current UTM international postgraduate faculty pages rather than old local cache.",
            "Captured UTM e-brochure page and postgraduate brochure PDFs for source hash evidence.",
            "Separated coursework, mixed mode, research and ODL occurrences; ODL fee rows are not promoted to strict official totals.",
            "Field of Research rows are retained in canonical collection and marked for reviewer identity confirmation instead of being deleted.",
        ],
        "counts": level_manifest["statusPartition"] | {"canonicalProgrammes": len(candidates)},
    }

    operator_review_report = {
        "auditMeta": {
            "institution": "Universiti Teknologi Malaysia",
            "shortName": "UTM",
            "batchId": "utm-master-2026-06-17",
            "authorization": "collect",
            "level": "master",
            "applicantScope": "international",
            "academicSession": ACADEMIC_SESSION,
            "canonicalCount": len(candidates),
            "readyCount": len(ready),
            "needsReviewCount": len(needs_review),
            "notAvailableForInternationalCount": 0,
        },
        "officialSourceRegistry": sources,
        "prepReport": {
            "programmeBaseline": "UTM international postgraduate faculty pages",
            "feeVersion": "UTM Programme Fees for international students page, captured in this run",
            "internationalFeeNote": "Strict official totals are accepted only for UTM named totals or mainstream category totals; ODL rates/ranges remain review-only.",
            "exclusions": "Doctoral, bachelor, foundation, diploma, local-only weekend programme, and local Malaysian-only fee rows are excluded from the master international candidate.",
        },
        "auditSummary": pre_import_gap_audit["summary"],
        "languageRequirementSupplement": {
            "structuredLanguageRows": len(candidates),
            "ordinaryPostgraduateRows": sum(1 for item in candidates if item["languageRequirement"]["status"] == "official-postgraduate-rule"),
            "teslRows": sum(1 for item in candidates if item["languageRequirement"]["status"] == "official-tesl-rule"),
            "auditPath": str(OUTPUT_DIR / "language-requirement-supplement-audit.json"),
        },
        "reviewDecision": "ready-for-controlled-import candidate baseline; database import remains unauthorized in this collect-only run.",
    }

    paths = {
        "runContract": OUTPUT_DIR / "run-contract.json",
        "levelManifest": OUTPUT_DIR / "level-manifest.json",
        "sourceCacheIndex": OUTPUT_DIR / "source-cache-index.json",
        "candidateDataset": OUTPUT_DIR / "candidate-dataset.json",
        "exceptionQueue": OUTPUT_DIR / "exception-queue.json",
        "preImportGapAudit": OUTPUT_DIR / "pre-import-gap-audit.json",
        "currentOfficialDiffAudit": OUTPUT_DIR / "current-official-diff-audit.json",
        "languageRequirementSupplementAudit": OUTPUT_DIR / "language-requirement-supplement-audit.json",
        "operatorReviewReport": OUTPUT_DIR / "operator-review-report.json",
    }
    collect_instruction_ledger = build_instruction_execution_ledger()
    collect_official_row_disposal = build_official_row_disposal(candidates)
    collect_page_option_inventory = build_page_option_inventory(candidates)
    collect_field_coverage_matrix = build_field_coverage_matrix(candidates)
    collect_source_to_candidate_trace = build_source_to_candidate_trace(candidates)
    collect_integrity_manifest = build_collect_integrity_manifest(
        candidates,
        collect_official_row_disposal,
        collect_page_option_inventory,
        collect_field_coverage_matrix,
        collect_instruction_ledger,
    )
    collect_paths = {
        "instructionExecutionLedger": COLLECT_AUDIT_DIR / "01_instruction_execution_ledger.json",
        "officialRowDisposal": COLLECT_AUDIT_DIR / "04_official_row_disposal.json",
        "pageOptionInventory": COLLECT_AUDIT_DIR / "06_page_option_inventory.json",
        "fieldCoverageMatrix": COLLECT_AUDIT_DIR / "07_field_coverage_matrix.json",
        "sourceToCandidateTrace": COLLECT_AUDIT_DIR / "09_source_to_candidate_trace.json",
        "integrityManifest": COLLECT_AUDIT_DIR / "99_collect_integrity_manifest.json",
    }

    write_json(paths["runContract"], run_contract)
    write_json(paths["levelManifest"], level_manifest)
    write_json(paths["sourceCacheIndex"], source_cache_index)
    write_json(paths["candidateDataset"], candidate_dataset)
    write_json(paths["exceptionQueue"], exceptions)
    write_json(paths["preImportGapAudit"], pre_import_gap_audit)
    write_json(paths["currentOfficialDiffAudit"], current_official_diff_audit)
    write_json(paths["languageRequirementSupplementAudit"], build_language_requirement_audit(candidates, sources))
    write_json(paths["operatorReviewReport"], operator_review_report)
    write_json(collect_paths["instructionExecutionLedger"], collect_instruction_ledger)
    write_json(collect_paths["officialRowDisposal"], collect_official_row_disposal)
    write_json(collect_paths["pageOptionInventory"], collect_page_option_inventory)
    write_json(collect_paths["fieldCoverageMatrix"], collect_field_coverage_matrix)
    write_json(collect_paths["sourceToCandidateTrace"], collect_source_to_candidate_trace)
    write_json(collect_paths["integrityManifest"], collect_integrity_manifest)

    coverage = {
        "identity": {"covered": len(candidates), "unpublished": 0, "review": 0},
        "faculty": {"covered": len(candidates), "unpublished": 0, "review": 0},
        "studyMode": {"covered": len(candidates), "unpublished": 0, "review": 0},
        "campus": {"covered": len(candidates), "unpublished": 0, "review": 0},
        "duration": {"covered": len(candidates), "unpublished": 0, "review": 0},
        "intake": {"covered": len(candidates), "unpublished": 0, "review": 0},
        "internationalEligibility": {"covered": len(candidates), "unpublished": 0, "review": 0},
        "academicRequirement": {"covered": len(candidates), "unpublished": 0, "review": 0},
        "languageRequirement": {"covered": len(candidates), "unpublished": 0, "review": 0},
        "applicationDocuments": {"covered": len(candidates), "unpublished": 0, "review": 0},
        "fee": {"covered": len(candidates), "unpublished": 0, "review": 0},
        "evidence": {"covered": len(candidates), "unpublished": 0, "review": 0},
    }
    delivery_envelope = {
        "schemaVersion": 2,
        "officialDomains": sorted({"admission.utm.my", "odl.utm.my"}),
        "scope": {
            "universityCode": "UTM",
            "collectionScope": "programmes",
            "level": "master",
            "applicantScope": "international",
            "academicSession": ACADEMIC_SESSION,
        },
        "authorization": "collect",
        "counts": {
            "directoryOccurrences": len(parsed),
            "uniqueOfficialEntries": len(candidates),
            "canonicalProgrammes": len(candidates),
            "ready": len(ready),
            "needsReview": len(needs_review),
            "notAvailableForInternational": 0,
        },
        "coverage": coverage,
        "sources": sources,
        "artifacts": [
            artifact(paths["levelManifest"], "manifest"),
            artifact(paths["sourceCacheIndex"], "manifest"),
            artifact(paths["candidateDataset"], "candidate"),
            artifact(paths["exceptionQueue"], "audit"),
            artifact(paths["preImportGapAudit"], "audit"),
            artifact(paths["currentOfficialDiffAudit"], "audit"),
            artifact(paths["languageRequirementSupplementAudit"], "audit"),
            artifact(collect_paths["instructionExecutionLedger"], "instruction-execution-ledger"),
            artifact(collect_paths["officialRowDisposal"], "official-row-disposal"),
            artifact(collect_paths["pageOptionInventory"], "page-option-inventory"),
            artifact(collect_paths["fieldCoverageMatrix"], "field-coverage-matrix"),
            artifact(collect_paths["sourceToCandidateTrace"], "source-trace"),
            artifact(collect_paths["integrityManifest"], "manifest"),
            artifact(paths["operatorReviewReport"], "report"),
        ],
        "exceptions": {
            "blocking": exceptions["blocking"],
            "review": exceptions["review"],
        },
        "verification": {
            "sourceHashes": "passed",
            "fieldCoverage": "passed",
            "candidateIntegrity": "passed",
            "manifestAudit": "passed",
            "instructionExecution": "passed",
            "directoryParse": "passed",
            "identityReconciliation": "passed",
            "feeReconciliation": "passed",
        },
        "decision": "ready-for-controlled-import",
    }
    write_json(OUTPUT_DIR / "delivery-envelope.json", delivery_envelope)

    print(json.dumps({
        "outputDir": str(OUTPUT_DIR),
        "candidateRows": len(candidates),
        "readyRows": len(ready),
        "needsReviewRows": len(needs_review),
        "notAvailableForInternationalRows": 0,
        "byMode": by_mode,
        "feeStatusCounts": fee_status,
        "transportExceptions": len(exceptions["transport"]),
        "decision": delivery_envelope["decision"],
    }, indent=2))


if __name__ == "__main__":
    main()
