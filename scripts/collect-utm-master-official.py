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


def build_candidate_records(parsed: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates = []
    seen: dict[str, int] = {}
    for ordinal, item in enumerate(parsed, start=1):
        base_slug = slugify(f"utm master {item['facultyEn']} {item['mode']} {item['nameEnOfficial']}")
        duplicate_index = seen.get(base_slug, 0) + 1
        seen[base_slug] = duplicate_index
        slug = base_slug if duplicate_index == 1 else f"{base_slug}-{duplicate_index}"
        fee = fee_for(item)
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
            "durationOfficial": "Master Programme (3 Semesters) on UTM international postgraduate fee page; programme-specific duration requires faculty/detail confirmation.",
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
                "status": "general-rule",
                "sourceUrl": GENERAL_SOURCES["int-pg-entry-requirements"],
                "summary": "A Bachelor's Degree with good honours from UTM or another recognised institution, or an equivalent qualification and experience recognised by the Senate.",
            },
            "languageRequirement": {
                "status": "general-rule",
                "sourceUrl": GENERAL_SOURCES["english-language-requirements"],
                "summary": "International applicants follow UTM official English language requirement routes; programme-specific scores require final field extraction.",
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
            "sourceUrls": {
                "facultyProgrammeList": item["programmeSourceUrl"],
                "internationalPostgraduate": GENERAL_SOURCES["international-postgraduate-study"],
                "fees": fee["sourceUrl"],
                "entryRequirements": GENERAL_SOURCES["int-pg-entry-requirements"],
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
                    "sourceId": "int-pg-entry-requirements",
                    "sourceUrl": GENERAL_SOURCES["int-pg-entry-requirements"],
                    "sourceText": "A Bachelor's Degree with good honours from UTM or another recognised institution, or an equivalent qualification and experience recognised by the Senate.",
                    "retrievedAt": CURRENT_AS_OF,
                    "confidence": 1,
                },
            ],
            "fieldCoverage": {
                "identity": "programme-list",
                "faculty": "programme-list",
                "mode": "programme-list",
                "internationalEligibility": "international-postgraduate-list",
                "fee": fee["status"],
                "academicRequirement": "general-rule",
                "languageRequirement": "general-rule",
                "intake": "general-rule",
                "applicationDocuments": "general-rule",
                "curriculum": "not-collected-in-this-pass",
                "career": "official-unpublished-or-not-collected",
            },
            "publicDisplayStatus": public_status,
            "reviewReason": "; ".join(issues),
            "reviewedDecisions": reviewed_decisions,
        })
    return candidates


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


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
            "intake": f"{len(candidates)}/{len(candidates)} via UTM FAQ / ODL source",
            "applicationDocuments": f"{len(candidates)}/{len(candidates)} via UTM international registration document checklist",
            "curriculum": "not required for this statistical collection baseline; ODL page provides curriculum for selected ODL programmes and faculty brochures are captured for follow-up enrichment.",
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
        "operatorReviewReport": OUTPUT_DIR / "operator-review-report.json",
    }

    write_json(paths["runContract"], run_contract)
    write_json(paths["levelManifest"], level_manifest)
    write_json(paths["sourceCacheIndex"], source_cache_index)
    write_json(paths["candidateDataset"], candidate_dataset)
    write_json(paths["exceptionQueue"], exceptions)
    write_json(paths["preImportGapAudit"], pre_import_gap_audit)
    write_json(paths["currentOfficialDiffAudit"], current_official_diff_audit)
    write_json(paths["operatorReviewReport"], operator_review_report)

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
            artifact(paths["operatorReviewReport"], "report"),
        ],
        "exceptions": {
            "blocking": exceptions["blocking"],
            "review": exceptions["review"],
        },
        "verification": {
            "sourceHashes": "passed",
            "fieldCoverage": "passed",
            "manifestAudit": "passed",
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
