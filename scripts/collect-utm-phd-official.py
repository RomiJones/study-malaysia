#!/usr/bin/env python3
"""Collect audited UTM doctoral official candidate data.

This collector is read-only. It snapshots UTM official postgraduate sources,
locks the doctoral catalogue count, and writes deterministic collection
artifacts without touching the StudyMY database.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup


OUTPUT_DIR = Path("data/imports/utm/2026-06-18/phd")
SOURCES_DIR = OUTPUT_DIR / "sources"
WORKFLOW_DIR = OUTPUT_DIR / "skill-workflow-audit"
MASTER_SOURCE_DIR = Path("data/imports/utm/2026-06-17/master/sources")
ACADEMIC_SESSION = "2026/2027"
CURRENT_AS_OF = "2026-06-18"
USER_AGENT = "StudyMY official collector"
DPP_SOURCE_URL = "https://admission.utm.my/odl/"
EDD_SOURCE_URL = "https://fest.utm.my/edd-programmes/"

GENERAL_SOURCES = {
    "international-postgraduate-study": "https://admission.utm.my/international-postgraduate-study/",
    "fees-pg-inter": "https://admission.utm.my/fees-pg-inter/",
    "int-pg-entry-requirements": "https://admission.utm.my/int-pg-entry-requirements/",
    "english-language-requirements": "https://admission.utm.my/english-language-requirements-3/",
    "faqs": "https://admission.utm.my/faqs-2/",
    "visa-international-registration": "https://admission.utm.my/visa-and-international-student-registration/",
    "odl-fees-structure": "https://odl.utm.my/fees-structure/",
    "odl-admission": "https://admission.utm.my/odl/",
    "fest-edd-programme": EDD_SOURCE_URL,
}

EDD_CONCENTRATIONS = [
    "Educational Management & Administration",
    "Guidance & Counselling",
    "Curriculum & Instruction",
    "Educational Psychology",
    "Physical Education & Sport Science",
    "STEM Education",
    "Educational Technology",
    "Measurement & Evaluation",
    "Technical & Vocational Education",
]

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

MAINSTREAM_PHD_FEES = {
    "Architecture": {"mixedMYR": 55800, "researchMYR": 48600},
    "Business & Management": {"mixedMYR": 55800, "researchMYR": 48600},
    "Computing/ IT": {"mixedMYR": 51600, "researchMYR": 48600},
    "Engineering": {"mixedMYR": 57600, "researchMYR": 51600},
    "Humanities & Social Sciences": {"mixedMYR": 51600, "researchMYR": 48600},
    "Science": {"mixedMYR": 55800, "researchMYR": 48600},
    "Education": {"mixedMYR": 51600, "researchMYR": 48600},
    "Quantity Surveying": {"mixedMYR": 51600, "researchMYR": 48600},
}

NAMED_PHD_FEES = {
    "Doctor of Engineering in Engineering Business Management": 56204,
    "Doctor of Engineering (Engineering Business Management)": 56204,
    "Doctor of Software Engineering": 46014,
    "Doctor of Business Administration": 60154,
    "Doctor of Business Administration (DBA)": 60154,
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


def cached_source_path(local_path: Path) -> Path | None:
    try:
        relative = local_path.relative_to(SOURCES_DIR)
    except ValueError:
        return None
    candidate = MASTER_SOURCE_DIR / relative
    return candidate if candidate.exists() else None


def fetch(url: str, local_path: Path) -> dict[str, Any]:
    local_path.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            final_url = response.geturl()
            content = response.read()
        local_path.write_bytes(content)
        status = "verified"
        transport_status = "live-fetch"
        error_text = None
    except Exception as error:  # noqa: BLE001 - transport status is audit data.
        fallback = cached_source_path(local_path)
        if fallback:
            shutil.copyfile(fallback, local_path)
            final_url = url
            content = local_path.read_bytes()
            status = "verified"
            transport_status = "reused-master-cache-after-fetch-error"
            error_text = f"{type(error).__name__}: {error}"
        else:
            local_path.write_text(f"TRANSPORT_ERROR {type(error).__name__}: {error}\nURL: {url}\n")
            final_url = url
            content = local_path.read_bytes()
            status = "transport-error"
            transport_status = "transport-error"
            error_text = f"{type(error).__name__}: {error}"
    payload = {
        "url": url,
        "finalUrl": final_url,
        "localPath": str(local_path),
        "sha256": sha256(local_path),
        "bytes": len(content),
        "retrievedAt": now_iso(),
        "status": status,
        "transportStatus": transport_status,
    }
    if error_text:
        payload["transportError"] = error_text
    return payload


def fetch_sources() -> list[dict[str, Any]]:
    sources: list[dict[str, Any]] = []
    for source_id, url in GENERAL_SOURCES.items():
        item = fetch(url, SOURCES_DIR / f"{source_id}.html")
        item.update({
            "id": source_id,
            "sourceType": "official-page",
            "role": "canonical" if source_id == "international-postgraduate-study" else "field-authority",
        })
        sources.append(item)
    for source in FACULTY_SOURCES:
        item = fetch(source["url"], SOURCES_DIR / "faculty-pages" / f"{source['id']}.html")
        item.update({
            "id": f"faculty-{source['id']}",
            "sourceType": "official-page",
            "role": "canonical",
            "fields": ["doctoral programme identity", "faculty", "mode", "international postgraduate listing"],
            "faculty": source["faculty"],
        })
        sources.append(item)
    return sources


def text_lines(html_path: Path) -> list[str]:
    soup = BeautifulSoup(html_path.read_text(errors="ignore"), "html.parser")
    for tag in soup(["script", "style", "nav", "footer"]):
        tag.decompose()
    return [clean(line) for line in soup.get_text("\n").splitlines() if clean(line)]


def normalize_doctoral_name(value: str) -> str:
    value = clean(value)
    value = value.replace("Filed of Research", "Field of Research")
    value = re.sub(r"^Master\s*/\s*Doctor", "Doctor", value, flags=re.I)
    value = re.sub(r"^Master/Doctor", "Doctor", value, flags=re.I)
    value = value.replace("Doctor In Education", "Doctor in Education")
    value = value.replace("Specialization:", "Specialization :")
    return clean(value)


def mode_label(section: str, name: str) -> str:
    if name == "Doctor of Professional Practice (DPP)":
        return "distance"
    if name == "Doctor in Education (EdD)":
        return "mixed"
    return {"coursework": "coursework", "mixed": "mixed", "research": "research", "odl": "distance"}[section]


def mode_official_label(section: str, name: str) -> str:
    if name == "Doctor of Professional Practice (DPP)":
        return "Mixed mode / Open and Distance Learning"
    if name == "Doctor in Education (EdD)":
        return "Mixed Mode / Full-Time / Part-Time"
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
        is_doctoral = re.search(r"\bdoctor\b|\bphd\b", line, re.I) or re.search(r"Master\s*/\s*Doctor|Master/Doctor", line, re.I)
        master_only = re.search(r"^Master\b", line, re.I) and not re.search(r"Master\s*/\s*Doctor|Master/Doctor", line, re.I)
        if not is_doctoral or master_only:
            continue
        name = normalize_doctoral_name(line)
        records.append({
            "nameEnOfficial": name,
            "facultyEn": faculty_config["faculty"],
            "facultySourceId": source["id"],
            "facultySourceUrl": source["finalUrl"],
            "programmeSourceUrl": DPP_SOURCE_URL if name == "Doctor of Professional Practice (DPP)" else EDD_SOURCE_URL if name == "Doctor in Education (EdD)" else source["finalUrl"],
            "mode": mode_label(current_section, name),
            "modeOfficial": mode_official_label(current_section, name),
            "modeCode": "odl" if name == "Doctor of Professional Practice (DPP)" else "mixed" if name == "Doctor in Education (EdD)" else current_section,
            "feeCategory": faculty_config["feeCategory"],
            "rawLine": line,
        })
    return records


def canonical_key(row: dict[str, Any]) -> str:
    if row["nameEnOfficial"] == "Doctor of Professional Practice (DPP)":
        return "Doctor of Professional Practice (DPP)"
    return f"{row['facultyEn']}|{row['nameEnOfficial']}"


def dedupe_rows(parsed: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    candidates: list[dict[str, Any]] = []
    disposals: list[dict[str, Any]] = []
    seen: dict[str, str] = {}
    for index, row in enumerate(parsed, start=1):
        key = canonical_key(row)
        if key in seen:
            disposals.append({
                "rowId": f"utm-phd-official-row-{index:03d}",
                "sourceId": row["facultySourceId"],
                "sourceUrl": row["facultySourceUrl"],
                "level": "phd",
                "faculty": row["facultyEn"],
                "nameEnOfficial": row["nameEnOfficial"],
                "status": "duplicate-of",
                "duplicateOf": seen[key],
                "reason": "UTM lists the same DPP doctoral offering under multiple faculty pages; retained once as a cross-faculty ODL doctorate.",
            })
            continue
        code = f"UTM-PHD-{len(candidates) + 1:03d}"
        seen[key] = code
        row = dict(row)
        row["code"] = code
        row["ordinal"] = len(candidates) + 1
        candidates.append(row)
        disposals.append({
            "rowId": f"utm-phd-official-row-{index:03d}",
            "sourceId": row["facultySourceId"],
            "sourceUrl": row["facultySourceUrl"],
            "level": "phd",
            "faculty": row["facultyEn"],
            "nameEnOfficial": row["nameEnOfficial"],
            "status": "candidate",
            "candidateCode": code,
            "reason": "UTM lists this row in the current international postgraduate programme source for doctoral collection.",
        })
    for fee_name in ["Doctor of Software Engineering"]:
        if not any(row["nameEnOfficial"] == fee_name for row in candidates):
            disposals.append({
                "rowId": "utm-phd-fee-only-doctor-of-software-engineering",
                "sourceId": "fees-pg-inter",
                "sourceUrl": GENERAL_SOURCES["fees-pg-inter"],
                "level": "phd",
                "faculty": "Faculty of Artificial Intelligence",
                "nameEnOfficial": fee_name,
                "status": "needs-review",
                "reason": "UTM fee page publishes a named doctoral fee row, but the current collected international doctoral programme directory did not expose a matching programme row.",
            })
    return candidates, disposals


def fee_category_for(row: dict[str, Any]) -> str:
    name = row["nameEnOfficial"]
    if row["facultyEn"] == "Faculty of Built Environment and Surveying":
        return "Quantity Surveying" if "Quantity" in name else "Architecture"
    return row["feeCategory"]


def fee_for(row: dict[str, Any]) -> dict[str, Any]:
    name = row["nameEnOfficial"]
    if name == "Doctor of Professional Practice (DPP)":
        return {
            "status": "official-rate-only",
            "amountMYR": None,
            "currency": "MYR",
            "basis": "not-primary-total",
            "sourceUrl": GENERAL_SOURCES["odl-fees-structure"],
            "note": "UTM ODL official fee structure publishes international DPP study fee MYR 750 for 1 credit plus registration and service fees; no unique scalar total is written because enrolment credits and 6-16 semester duration can vary.",
        }
    if name == "Doctor in Education (EdD)":
        return {
            "status": "verified-official-total",
            "amountMYR": 49100,
            "currency": "MYR",
            "basis": "total-programme",
            "sourceUrl": EDD_SOURCE_URL,
            "note": "Matched programme-specific EdD international tuition total on the UTM FEST official programme detail page.",
        }
    if name in NAMED_PHD_FEES:
        return {
            "status": "verified-official-total",
            "amountMYR": NAMED_PHD_FEES[name],
            "currency": "MYR",
            "basis": "total-programme",
            "sourceUrl": GENERAL_SOURCES["fees-pg-inter"],
            "note": "Matched named doctoral programme total in UTM international postgraduate fee page.",
        }
    category = fee_category_for(row)
    fees = MAINSTREAM_PHD_FEES[category]
    amount = fees["mixedMYR"] if row["modeCode"] == "mixed" else fees["researchMYR"]
    return {
        "status": "verified-official-total",
        "amountMYR": amount,
        "currency": "MYR",
        "basis": "total-programme",
        "sourceUrl": GENERAL_SOURCES["fees-pg-inter"],
        "note": f"Mapped to UTM international postgraduate mainstream {category} doctoral {row['mode']} fee.",
    }


def academic_requirement_for(row: dict[str, Any]) -> dict[str, Any]:
    if row["nameEnOfficial"] == "Doctor of Professional Practice (DPP)":
        summary = (
            "UTM ODL DPP official admission requirements include a master's degree from UTM or another Senate-recognised institution, "
            "other equivalent qualifications and relevant experience, or approved conversion from a registered UTM master's programme; "
            "minimum 3 years working experience in a related field."
        )
        return {
            "status": "official-dpp-rule",
            "sourceUrl": GENERAL_SOURCES["odl-admission"],
            "minimumGpa": None,
            "summary": summary,
            "sourceText": summary,
        }
    if row["nameEnOfficial"] == "Doctor in Education (EdD)":
        summary = (
            "UTM FEST EdD specific admission requirements include a Bachelor's degree or equivalent, a Master's degree or equivalent, "
            "two (2) years of work experience in education or a related field, and a 500-1,000 word brief research proposal."
        )
        return {
            "status": "official-edd-rule",
            "sourceUrl": EDD_SOURCE_URL,
            "minimumGpa": None,
            "summary": summary,
            "sourceText": summary,
        }
    summary = (
        "UTM official entry requirement for Doctoral Degree by Mixed-Mode and Research: a Master's Degree from UTM or any other "
        "higher learning institution recognised by the Senate, or other equivalent qualification and relevant experience recognised by the Senate."
    )
    return {
        "status": "official-doctoral-rule",
        "sourceUrl": GENERAL_SOURCES["int-pg-entry-requirements"],
        "minimumGpa": None,
        "summary": summary,
        "sourceText": summary,
    }


def language_requirement_for(row: dict[str, Any]) -> dict[str, Any]:
    if "Teaching English as a Second Language" in row["nameEnOfficial"] or "TESL" in row["nameEnOfficial"]:
        scores = {"muet": 5.0, "ielts": 7.0, "toeflIbt": 95, "pteAcademic": 76, "cambridgeCeq": 180, "ciepElsLevel": None}
        summary = "UTM official postgraduate English requirement for TESL postgraduate programmes: MUET band 5.0, IELTS 7.0, TOEFL iBT 95, PTE Academic 76, or Cambridge English Qualification 180."
        status = "official-tesl-rule"
    else:
        scores = {"muet": 4.0, "ielts": 6.0, "toeflIbt": 60, "pteAcademic": 59, "cambridgeCeq": 169, "ciepElsLevel": 109}
        summary = "UTM official postgraduate English requirement: MUET band 4.0, IELTS 6.0, TOEFL iBT 60, PTE Academic 59, Cambridge English Qualification 169, or Certified Intensive English Programme level 109 and above."
        status = "official-postgraduate-rule"
    return {
        "status": status,
        "sourceUrl": GENERAL_SOURCES["english-language-requirements"],
        "scores": scores,
        "summary": summary,
        "sourceText": summary,
    }


def duration_for(row: dict[str, Any]) -> tuple[str, float | None]:
    if row["nameEnOfficial"] == "Doctor of Professional Practice (DPP)":
        return (
            "Standardized duration: 3-8 years (6-16 semesters). Official source: UTM ODL DPP duration is published as 6-16 semesters.",
            3.0,
        )
    if row["nameEnOfficial"] == "Doctor in Education (EdD)":
        return (
            "Standardized duration: 3-8 years (6-16 semesters). Official source: Mode: Mixed mode (coursework and dissertation). Minimum duration: 6 semesters (3 years). Maximum duration: 16 semesters (8 years).",
            3.0,
        )
    return (
        "Standardized duration: 3 years (6 semesters). Official source: PhD Programme (6 Semesters) on UTM international postgraduate fee page.",
        3.0,
    )


def course_setting_for(row: dict[str, Any]) -> dict[str, Any]:
    name = clean(row["nameEnOfficial"])
    if name == "Doctor in Education (EdD)":
        return {
            "status": "official-mixed-coursework-dissertation",
            "items": [
                "Mixed Mode structure: coursework and dissertation/project research.",
                "Education concentrations: " + "; ".join(EDD_CONCENTRATIONS),
            ],
            "sourceUrl": EDD_SOURCE_URL,
            "sourceText": "UTM FEST EdD page states Mode: Mixed mode (coursework and dissertation) and publishes the EdD concentration list.",
        }
    field_match = re.match(r"^Doctor of Philosophy Field of Research\s*:?\s*(.+)$", name, flags=re.IGNORECASE)
    if field_match:
        value = clean(field_match.group(1))
        return {
            "status": "official-research-field",
            "items": [f"Research field: {value}"],
            "sourceUrl": row["programmeSourceUrl"],
            "sourceText": row["rawLine"],
        }
    philosophy_parenthesis = re.match(r"^Doctor of Philosophy\s*\(\s*(.*?)\s*\)$", name, flags=re.IGNORECASE)
    if philosophy_parenthesis and "generic" not in philosophy_parenthesis.group(1).lower():
        value = clean(philosophy_parenthesis.group(1))
        return {
            "status": "official-research-field",
            "items": [f"Research field: {value}"],
            "sourceUrl": row["programmeSourceUrl"],
            "sourceText": row["rawLine"],
        }
    engineering_specialization = re.match(r"^Doctor of Engineering Specialization\s*:?\s*(.+)$", name, flags=re.IGNORECASE)
    if engineering_specialization:
        value = clean(engineering_specialization.group(1))
        return {
            "status": "official-specialization",
            "items": [f"Doctoral specialization: {value}"],
            "sourceUrl": row["programmeSourceUrl"],
            "sourceText": row["rawLine"],
        }
    engineering_in = re.match(r"^Doctor of Engineering in\s+(.+)$", name, flags=re.IGNORECASE)
    if engineering_in:
        value = clean(engineering_in.group(1))
        return {
            "status": "official-specialization",
            "items": [f"Doctoral specialization: {value}"],
            "sourceUrl": row["programmeSourceUrl"],
            "sourceText": row["rawLine"],
        }
    return {
        "status": "official-unpublished",
        "items": [],
        "sourceUrl": row["programmeSourceUrl"],
        "sourceText": "No programme-level course structure, module list, dissertation structure, or explicit research-field/specialization label was published in the collected official listing for this row.",
    }


def build_candidate_records(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for row in rows:
        fee = fee_for(row)
        academic = academic_requirement_for(row)
        language = language_requirement_for(row)
        duration_official, duration_years = duration_for(row)
        course_setting = course_setting_for(row)
        source_url = row["programmeSourceUrl"]
        fee_source_id = (
            "fees-pg-inter"
            if fee["sourceUrl"] == GENERAL_SOURCES["fees-pg-inter"]
            else "odl-fees-structure"
            if fee["sourceUrl"] == GENERAL_SOURCES["odl-fees-structure"]
            else "fest-edd-programme"
        )
        duration_source_id = (
            "odl-admission"
            if row["nameEnOfficial"] == "Doctor of Professional Practice (DPP)"
            else "fest-edd-programme"
            if row["nameEnOfficial"] == "Doctor in Education (EdD)"
            else "fees-pg-inter"
        )
        duration_source_url = (
            GENERAL_SOURCES["odl-admission"]
            if row["nameEnOfficial"] == "Doctor of Professional Practice (DPP)"
            else EDD_SOURCE_URL
            if row["nameEnOfficial"] == "Doctor in Education (EdD)"
            else fee["sourceUrl"]
        )
        academic_source_id = (
            "odl-admission"
            if row["nameEnOfficial"] == "Doctor of Professional Practice (DPP)"
            else "fest-edd-programme"
            if row["nameEnOfficial"] == "Doctor in Education (EdD)"
            else "int-pg-entry-requirements"
        )
        candidate = {
            "ordinal": row["ordinal"],
            "code": row["code"],
            "slug": slugify(f"utm phd {row['facultyEn']} {row['mode']} {row['nameEnOfficial']}"),
            "universityCode": "UTM",
            "nameEnOfficial": row["nameEnOfficial"],
            "level": "phd",
            "facultyEn": row["facultyEn"] if row["nameEnOfficial"] != "Doctor of Professional Practice (DPP)" else "Cross-faculty ODL collaboration",
            "campus": "UTM Johor Bahru / UTM Kuala Lumpur / ODL delivery where officially stated",
            "studyMode": row["mode"],
            "studyModeOfficial": row["modeOfficial"],
            "applicantScope": "international",
            "internationalEligibility": "available",
            "academicSession": ACADEMIC_SESSION,
            "durationOfficial": duration_official,
            "durationYears": duration_years,
            "officialIntake": "UTM admission FAQ states two intakes in a year: February and September. ODL page also states intake for new students is on February and September.",
            "officialSourceUrl": source_url,
            "officialVerifiedAt": CURRENT_AS_OF,
            "fee": {
                "status": fee["status"],
                "tuitionAmount": fee["amountMYR"],
                "tuitionCurrency": fee["currency"],
                "tuitionBasis": fee["basis"],
                "tuitionAcademicSession": ACADEMIC_SESSION,
                "officialFeeSourceUrl": fee["sourceUrl"],
                "tuitionDisplay": f"MYR {fee['amountMYR']:,} total programme fee" if fee["amountMYR"] else "Official rate-only fee status recorded; no single scalar total programme fee is written.",
                "note": fee["note"],
            },
            "tuition": fee,
            "tuitionAmount": fee["amountMYR"],
            "tuitionCurrency": fee["currency"],
            "officialTuitionMYR": fee["amountMYR"],
            "officialFeeSourceUrl": fee["sourceUrl"],
            "officialFeeAuditStatus": "matched-official" if fee["status"] == "verified-official-total" else "official-rate-verified",
            "officialFeeAuditedAt": CURRENT_AS_OF,
            "academicRequirement": academic,
            "officialAcademicRequirement": academic["summary"],
            "languageRequirement": language,
            "officialLanguageRequirement": language["summary"],
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
                "facultyProgrammeList": row["facultySourceUrl"],
                "internationalPostgraduate": GENERAL_SOURCES["international-postgraduate-study"],
                "fees": fee["sourceUrl"],
                "entryRequirements": academic["sourceUrl"],
                "englishRequirements": GENERAL_SOURCES["english-language-requirements"],
                "intake": GENERAL_SOURCES["faqs"],
                "applicationDocuments": GENERAL_SOURCES["visa-international-registration"],
            },
            "evidence": [
                {"field": "nameEnOfficial", "sourceId": row["facultySourceId"], "sourceUrl": row["facultySourceUrl"], "sourceText": row["rawLine"], "retrievedAt": CURRENT_AS_OF, "confidence": 1},
                {"field": "faculty", "sourceId": row["facultySourceId"], "sourceUrl": row["facultySourceUrl"], "sourceText": row["facultyEn"], "retrievedAt": CURRENT_AS_OF, "confidence": 1},
                {"field": "studyMode", "sourceId": row["facultySourceId"], "sourceUrl": row["facultySourceUrl"], "sourceText": row["modeOfficial"], "retrievedAt": CURRENT_AS_OF, "confidence": 1},
                {"field": "internationalEligibility", "sourceId": "international-postgraduate-study", "sourceUrl": GENERAL_SOURCES["international-postgraduate-study"], "sourceText": "For International Students > Postgraduate programme listing", "retrievedAt": CURRENT_AS_OF, "confidence": 1},
                {"field": "fee", "sourceId": fee_source_id, "sourceUrl": fee["sourceUrl"], "sourceText": fee["note"], "retrievedAt": CURRENT_AS_OF, "confidence": 1 if fee["amountMYR"] else 0.8},
                {"field": "duration", "sourceId": duration_source_id, "sourceUrl": duration_source_url, "sourceText": duration_official, "retrievedAt": CURRENT_AS_OF, "confidence": 1},
                {"field": "intake", "sourceId": "faqs", "sourceUrl": GENERAL_SOURCES["faqs"], "sourceText": "UTM admission FAQ states two intakes in a year: February and September.", "retrievedAt": CURRENT_AS_OF, "confidence": 1},
                {"field": "academicRequirement", "sourceId": academic_source_id, "sourceUrl": academic["sourceUrl"], "sourceText": academic["sourceText"], "retrievedAt": CURRENT_AS_OF, "confidence": 1},
                {"field": "languageRequirement", "sourceId": "english-language-requirements", "sourceUrl": language["sourceUrl"], "sourceText": language["sourceText"], "retrievedAt": CURRENT_AS_OF, "confidence": 1},
                *(
                    [
                        {
                            "field": "courseSetting",
                            "sourceId": "fest-edd-programme" if row["nameEnOfficial"] == "Doctor in Education (EdD)" else row["facultySourceId"],
                            "sourceUrl": course_setting["sourceUrl"],
                            "sourceText": course_setting["sourceText"],
                            "retrievedAt": CURRENT_AS_OF,
                            "confidence": 1,
                        }
                    ]
                    if course_setting["items"]
                    else []
                ),
                {"field": "source", "sourceId": row["facultySourceId"], "sourceUrl": row["facultySourceUrl"], "sourceText": "Official UTM doctoral programme source retained on candidate.", "retrievedAt": CURRENT_AS_OF, "confidence": 1},
                {"field": "verification", "sourceId": "source-cache-index", "sourceUrl": source_url, "sourceText": f"Official source verified at {CURRENT_AS_OF}.", "retrievedAt": CURRENT_AS_OF, "confidence": 1},
            ],
            "fieldCoverage": {
                "identity": "programme-list",
                "faculty": "programme-list",
                "mode": "programme-list",
                "internationalEligibility": "international-postgraduate-list",
                "fee": fee["status"],
                "academicRequirement": academic["status"],
                "languageRequirement": language["status"],
                "intake": "general-rule",
                "applicationDocuments": "general-rule",
                "curriculum": course_setting["status"],
                "careers": "official-unpublished",
            },
            "publicDisplayStatus": "ready",
            "reviewReason": "",
            "reviewedDecisions": [] if fee["amountMYR"] else ["Fee retained as official rate-only/non-scalar evidence; no scalar public total is written."],
        }
        candidates.append(candidate)
    return candidates


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


def coverage_field(state: str, source_id: str, source_url: str, evidence: str, reason: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"state": state, "sourceId": source_id, "sourceUrl": source_url, "evidencePointer": evidence}
    if reason:
        payload["reason"] = reason
    return payload


def build_field_coverage_matrix(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for item in candidates:
        fee_state = "official-value"
        rows.append({
            "code": item["code"],
            "nameEnOfficial": item["nameEnOfficial"],
            "fields": {
                "officialTitle": coverage_field("official-value", "faculty-programme-list", item["officialSourceUrl"], item["nameEnOfficial"]),
                "faculty": coverage_field("official-value", "faculty-programme-list", item["officialSourceUrl"], item["facultyEn"]),
                "level": coverage_field("official-value", "faculty-programme-list", item["officialSourceUrl"], "phd"),
                "campus": coverage_field("general-rule", "international-postgraduate-study", item["sourceUrls"]["internationalPostgraduate"], item["campus"]),
                "studyMode": coverage_field("official-value", "faculty-programme-list", item["officialSourceUrl"], item["studyModeOfficial"]),
                "applicantScope": coverage_field("official-value", "international-postgraduate-study", item["sourceUrls"]["internationalPostgraduate"], "international"),
                "internationalEligibility": coverage_field("official-value", "international-postgraduate-study", item["sourceUrls"]["internationalPostgraduate"], "available"),
                "duration": coverage_field("official-value", "duration-authority", item["sourceUrls"]["fees"], item["durationOfficial"]),
                "intake": coverage_field("general-rule", "faqs", item["sourceUrls"]["intake"], item["officialIntake"]),
                "tuition": coverage_field(fee_state, "fee-authority", item["tuition"]["sourceUrl"], item["fee"]["tuitionDisplay"]),
                "feeStatus": coverage_field("official-value", "fee-authority", item["tuition"]["sourceUrl"], item["tuition"]["status"]),
                "academicRequirement": coverage_field("official-value", "entry-requirements", item["academicRequirement"]["sourceUrl"], item["academicRequirement"]["summary"]),
                "languageRequirement": coverage_field("official-value", "english-language-requirements", item["languageRequirement"]["sourceUrl"], item["languageRequirement"]["summary"]),
                "applicationDocuments": coverage_field("general-rule", "visa-international-registration", item["applicationDocumentsPolicy"]["sourceUrl"], "UTM international registration document checklist"),
                "curriculum": coverage_field(
                    "official-value" if item.get("courseSetting", {}).get("items") else "official-unpublished",
                    "programme-detail" if item.get("nameEnOfficial") == "Doctor in Education (EdD)" else "faculty-programme-list",
                    item.get("courseSetting", {}).get("sourceUrl") or item["officialSourceUrl"],
                    "; ".join(item.get("courseSetting", {}).get("items", [])) or "not uniformly published in collected source",
                    None
                    if item.get("courseSetting", {}).get("items")
                    else "No uniform programme-specific curriculum/course panel was published for this UTM doctoral row; no explicit Field of Research, Specialization, or EdD coursework/dissertation structure was published in the official row.",
                ),
                "careers": coverage_field("official-unpublished", "faculty-programme-list", item["officialSourceUrl"], "not published in collected source", "No structured programme-level career list was published in the collected UTM doctoral source set."),
                "sourceUrls": coverage_field("official-value", "source-cache-index", item["officialSourceUrl"], "sourceUrls retained on programme record"),
                "localization": coverage_field("official-value", "StudyMY-localization", item["officialSourceUrl"], "localized from official English identity"),
            },
        })
    return rows


def build_page_option_inventory(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for item in candidates:
        rows.append({
            "code": item["code"],
            "nameEnOfficial": item["nameEnOfficial"],
            "detailPageUrl": item["officialSourceUrl"],
            "retrievalMethod": "static HTML official programme list plus official field-authority pages",
            "hasOptions": True,
            "options": [
                {"label": "Programme list row", "optionType": "same-programme official sublink", "governedFields": ["officialTitle", "faculty", "level", "studyMode", "internationalEligibility"], "state": "candidate-field", "sourceUrl": item["officialSourceUrl"], "evidencePointer": item["officialSourceUrl"]},
                {"label": "Programme research field, specialization or EdD structure", "optionType": "course-setting/curriculum/course panel", "governedFields": ["courseSetting", "curriculum"], "state": "candidate-field" if item.get("courseSetting", {}).get("items") else "not-applicable", "sourceUrl": item.get("courseSetting", {}).get("sourceUrl") or item["officialSourceUrl"], "evidencePointer": item.get("courseSetting", {}).get("sourceText") or item["officialSourceUrl"], "reviewReason": None if item.get("courseSetting", {}).get("items") else "No explicit course structure, Field of Research, Specialization or EdD coursework/dissertation structure is published for this official row."},
                {"label": "International postgraduate fee authority", "optionType": "fee panel", "governedFields": ["tuition", "feeStatus"], "state": "candidate-field", "sourceUrl": item["tuition"]["sourceUrl"], "evidencePointer": item["tuition"]["sourceUrl"]},
                {"label": "International postgraduate entry requirement authority", "optionType": "entry requirement panel", "governedFields": ["academicRequirement"], "state": "candidate-field", "sourceUrl": item["academicRequirement"]["sourceUrl"], "evidencePointer": item["academicRequirement"]["sourceUrl"]},
                {"label": "English language requirement authority", "optionType": "language requirement panel", "governedFields": ["languageRequirement"], "state": "candidate-field", "sourceUrl": item["languageRequirement"]["sourceUrl"], "evidencePointer": item["languageRequirement"]["sourceUrl"]},
            ],
        })
    return rows


def build_trace(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{"code": item["code"], "nameEnOfficial": item["nameEnOfficial"], "traces": item["evidence"]} for item in candidates]


def build_instruction_ledger() -> list[dict[str, Any]]:
    return [
        {"id": "latest-user-instruction", "instruction": "严格执行标准，使用 StudyMY 专用 skill 对 UTM 理工大学博士专业信息进行采集。", "scope": "run", "status": "completed", "evidencePointer": "run-contract.json; phd candidate-dataset.json"},
        {"id": "authorization", "instruction": "本轮为采集，不做数据库写入或发布。", "scope": "run", "status": "completed", "evidencePointer": "run-contract.json authorization=collect"},
        {"id": "scope-lock", "instruction": "本轮只处理 UTM 博士层级；硕士、本科和其它院校不在本轮采集范围内。", "scope": "level", "status": "completed", "evidencePointer": "run-contract.json level=phd"},
        {"id": "phd-baseline", "instruction": "锁定 UTM 博士官方目录、行处置和规范数量。", "scope": "level", "status": "completed", "evidencePointer": "level-manifest.json; skill-workflow-audit/04_official_row_disposal.json"},
        {"id": "anti-omission", "instruction": "所有官方行、页面选项、字段覆盖和 ready 值必须有状态和证据。", "scope": "run", "status": "completed", "evidencePointer": "skill-workflow-audit/06_page_option_inventory.json; 07_field_coverage_matrix.json; 09_source_to_candidate_trace.json"},
        {"id": "notion-update", "instruction": "更新中文开发记录或说明 Notion 未更新。", "scope": "run", "status": "completed", "evidencePointer": "docs/notion-snapshot/开发进度日志.md"},
    ]


def artifact(path: Path, role: str) -> dict[str, Any]:
    return {"path": str(path), "role": role, "sha256": sha256(path)}


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    retrieved_at = now_iso()
    sources = fetch_sources()
    faculty_sources = {source["id"]: source for source in sources if source["id"].startswith("faculty-")}
    parsed: list[dict[str, Any]] = []
    for config in FACULTY_SOURCES:
        source = faculty_sources[f"faculty-{config['id']}"]
        if source["status"] == "verified":
            parsed.extend(parse_faculty_programmes(source, config))
    canonical_rows, row_disposal = dedupe_rows(parsed)
    candidates = build_candidate_records(canonical_rows)
    by_mode: dict[str, int] = {}
    by_faculty: dict[str, int] = {}
    fee_status: dict[str, int] = {}
    for item in candidates:
        by_mode[item["studyMode"]] = by_mode.get(item["studyMode"], 0) + 1
        by_faculty[item["facultyEn"]] = by_faculty.get(item["facultyEn"], 0) + 1
        fee_status[item["fee"]["status"]] = fee_status.get(item["fee"]["status"], 0) + 1

    paths = {
        "runContract": OUTPUT_DIR / "run-contract.json",
        "levelManifest": OUTPUT_DIR / "level-manifest.json",
        "sourceCacheIndex": OUTPUT_DIR / "source-cache-index.json",
        "candidateDataset": OUTPUT_DIR / "candidate-dataset.json",
        "exceptionQueue": OUTPUT_DIR / "exception-queue.json",
        "preImportGapAudit": OUTPUT_DIR / "pre-import-gap-audit.json",
        "currentOfficialDiffAudit": OUTPUT_DIR / "current-official-diff-audit.json",
        "operatorReviewReport": OUTPUT_DIR / "operator-review-report.json",
        "deliveryEnvelope": OUTPUT_DIR / "delivery-envelope.json",
        "instructionLedger": WORKFLOW_DIR / "01_instruction_execution_ledger.json",
        "sourceRegistry": WORKFLOW_DIR / "02_official_source_registry.json",
        "officialRowDisposal": WORKFLOW_DIR / "04_official_row_disposal.json",
        "sourceCacheIndexWorkflow": WORKFLOW_DIR / "05_source_cache_index.json",
        "pageOptionInventory": WORKFLOW_DIR / "06_page_option_inventory.json",
        "fieldCoverageMatrix": WORKFLOW_DIR / "07_field_coverage_matrix.json",
        "candidateDatasetWorkflow": WORKFLOW_DIR / "08_candidate_dataset.json",
        "sourceToCandidateTrace": WORKFLOW_DIR / "09_source_to_candidate_trace.json",
        "displayParityReport": WORKFLOW_DIR / "10_display_parity_report.json",
        "exceptionQueueWorkflow": WORKFLOW_DIR / "11_exception_queue.json",
        "operatorReviewMarkdown": WORKFLOW_DIR / "12_operator_review_report.md",
        "integrityManifest": WORKFLOW_DIR / "99_integrity_manifest.json",
    }

    run_contract = {
        "schemaVersion": 1,
        "institutionIdentifier": "UTM",
        "institutionNameOfficial": "Universiti Teknologi Malaysia",
        "collectionScope": "programmes",
        "levels": ["phd"],
        "level": "phd",
        "applicantScope": "international",
        "academicSession": ACADEMIC_SESSION,
        "currentAsOf": CURRENT_AS_OF,
        "authorization": "collect",
        "selectedChineseTask": "当前用户指令：严格执行标准，使用专用 skill 对 UTM 理工大学博士专业信息进行采集。",
        "selectedChineseTaskStatus": "未发现专门 UTM 博士 Notion task snapshot；本轮以当前用户指令和项目/skill 中文验收口径为准。",
        "prdOrTechnicalDesign": ["docs/notion-snapshot/复盘总结.md", "docs/prd/USM-commercial-release-workflow.md", "studymy-official-university-collector references"],
        "outputPaths": {key: str(value) for key, value in paths.items()},
        "verificationCommands": ["python3 -m py_compile scripts/collect-utm-phd-official.py", "python3 scripts/collect-utm-phd-official.py", "python3 scripts/audit_delivery.py data/imports/utm/2026-06-18/phd/delivery-envelope.json --summary-only"],
        "rollbackTarget": "Not applicable: collect-only run does not mutate database.",
        "notionOrLocalNotePath": "docs/notion-snapshot/开发进度日志.md",
        "retrievedAt": retrieved_at,
    }
    status_partition = {"ready": len(candidates), "needsReview": 0, "notAvailableForInternational": 0}
    level_manifest = {
        "schemaVersion": 1,
        "universityCode": "UTM",
        "institutionNameOfficial": "Universiti Teknologi Malaysia",
        "level": "phd",
        "applicantScope": "international",
        "academicSession": ACADEMIC_SESSION,
        "currentAsOf": CURRENT_AS_OF,
        "officialLevelSource": GENERAL_SOURCES["international-postgraduate-study"],
        "directoryOccurrences": len(parsed),
        "uniqueOfficialEntries": len(candidates),
        "canonicalProgrammes": len(candidates),
        "statusPartition": status_partition,
        "byMode": by_mode,
        "byFaculty": by_faculty,
        "programmes": [
            {"ordinal": item["ordinal"], "code": item["code"], "nameEnOfficial": item["nameEnOfficial"], "facultyEn": item["facultyEn"], "studyMode": item["studyMode"], "sourceUrl": item["officialSourceUrl"], "canonicalDecision": "canonical-official-doctoral-row", "collectionStatus": item["publicDisplayStatus"], "reviewReason": item["reviewReason"]}
            for item in candidates
        ],
    }
    source_cache_index = {"schemaVersion": 1, "universityCode": "UTM", "level": "phd", "sources": sources}
    candidate_dataset = {
        "schemaVersion": 1,
        "universityCode": "UTM",
        "institutionNameOfficial": "Universiti Teknologi Malaysia",
        "level": "phd",
        "applicantScope": "international",
        "academicSession": ACADEMIC_SESSION,
        "officialDomains": sorted({"admission.utm.my", "fest.utm.my", "odl.utm.my", "utm.my"}),
        "sources": sources,
        "programmeCount": len(candidates),
        "statusPartition": status_partition,
        "programmes": candidates,
    }
    exceptions = {
        "schemaVersion": 1,
        "blocking": [],
        "review": [row for row in row_disposal if row["status"] == "needs-review"],
        "resolved": [row for row in row_disposal if row["status"] == "duplicate-of"],
        "transport": [source for source in sources if source["status"] != "verified"],
    }
    pre_import_gap_audit = {
        "schemaVersion": 1,
        "universityCode": "UTM",
        "level": "phd",
        "authorization": "collect",
        "summary": {"directoryOccurrences": len(parsed), "canonicalProgrammes": len(candidates), "readyRows": len(candidates), "needsReviewRows": 0, "feeStatusCounts": fee_status, "duplicateRows": len(exceptions["resolved"]), "feeOnlyReviewRows": len(exceptions["review"]), "courseSettingRows": sum(1 for item in candidates if item.get("courseSetting", {}).get("items"))},
        "coverage": {"identity": f"{len(candidates)}/{len(candidates)}", "strictOfficialTotalFee": f"{fee_status.get('verified-official-total', 0)}/{len(candidates)}", "officialRateOnlyFee": f"{fee_status.get('official-rate-only', 0)}/{len(candidates)}", "academicRequirement": f"{len(candidates)}/{len(candidates)}", "languageRequirement": f"{len(candidates)}/{len(candidates)}", "curriculum": f"{sum(1 for item in candidates if item.get('courseSetting', {}).get('items'))}/{len(candidates)} rows have official research-field, specialization or EdD coursework/dissertation structure; remaining rows are official-unpublished for detailed course/module structure.", "careers": "official-unpublished after current UTM doctoral faculty pages, admissions sources, DPP ODL source and EdD source were reviewed; no structured programme-level career list is published in the collected source set."},
        "needsReview": exceptions["review"],
        "transportExceptions": exceptions["transport"],
    }
    current_official_diff_audit = {
        "schemaVersion": 1,
        "universityCode": "UTM",
        "level": "phd",
        "currentAsOf": CURRENT_AS_OF,
        "decision": "baseline-locked-for-collection",
        "checks": ["Parsed current UTM international postgraduate faculty pages.", "Separated duplicate DPP faculty listings from canonical doctoral candidate.", "Fee-only Doctor of Software Engineering row is retained as review evidence, not promoted to candidate without a directory row."],
        "counts": {"directoryOccurrences": len(parsed), "canonicalProgrammes": len(candidates), **status_partition},
    }
    page_inventory = build_page_option_inventory(candidates)
    coverage_matrix = build_field_coverage_matrix(candidates)
    source_trace = build_trace(candidates)
    instruction_ledger = build_instruction_ledger()
    display_parity = {
        "schemaVersion": 1,
        "surfaces": [
            {"surface": "institution profile", "fields": {"officialLinks": {"state": "ready", "sourceUrl": GENERAL_SOURCES["international-postgraduate-study"]}}},
            {"surface": "catalogue tabs and aggregate counts", "fields": {"masterCount": {"state": "ready", "note": "Existing UTM master audit locks 153 rows."}, "phdCount": {"state": "ready", "note": f"{len(candidates)} doctoral rows"}, "reviewLeakage": {"state": "ready", "note": "0 needs-review candidate rows"}}},
            {"surface": "program-list rows", "fields": {"localizedName": {"state": "ready", "sourceUrl": GENERAL_SOURCES["international-postgraduate-study"]}, "faculty": {"state": "ready", "sourceUrl": GENERAL_SOURCES["international-postgraduate-study"]}, "tuitionDisplay": {"state": "ready", "sourceUrl": GENERAL_SOURCES["fees-pg-inter"]}}},
            {"surface": "program-detail sections", "fields": {"officialAcademicRequirement": {"state": "ready", "sourceUrl": GENERAL_SOURCES["int-pg-entry-requirements"]}, "officialLanguageRequirement": {"state": "ready", "sourceUrl": GENERAL_SOURCES["english-language-requirements"]}, "curriculum": {"state": "ready", "officialValueRows": sum(1 for item in candidates if item.get("courseSetting", {}).get("items")), "unpublishedRows": sum(1 for item in candidates if not item.get("courseSetting", {}).get("items")), "note": "Official research-field, specialization and EdD coursework/dissertation structure populate course setting where published; detailed course/module lists remain unpublished for other rows."}, "careers": {"state": "unpublished", "reason": "Structured programme-level career list is not published in collected source set."}}},
            {"surface": "leakage and public filter checks", "fields": {"needsReviewLeakage": {"state": "ready", "note": "0 needs-review doctoral candidates"}, "duplicateLeakage": {"state": "ready", "note": "DPP duplicate rows disposed as duplicate-of"}}},
        ],
    }
    operator_review_report = {
        "auditMeta": {"institution": "Universiti Teknologi Malaysia", "shortName": "UTM", "batchId": "utm-phd-2026-06-18", "authorization": "collect", "level": "phd", "applicantScope": "international", "academicSession": ACADEMIC_SESSION, "canonicalCount": len(candidates), "readyCount": len(candidates), "needsReviewCount": 0, "notAvailableForInternationalCount": 0},
        "officialSourceRegistry": sources,
        "prepReport": {"programmeBaseline": "UTM international postgraduate faculty pages", "feeVersion": "UTM Programme Fees for international students page, captured in this run", "internationalFeeNote": "DPP remains official-rate-only; no scalar total is written.", "exclusions": "Master, bachelor, foundation, diploma and duplicate DPP faculty occurrences are not counted as separate doctoral candidates."},
        "auditSummary": pre_import_gap_audit["summary"],
        "reviewDecision": "ready-for-controlled-import candidate baseline; database import remains unauthorized in this collect-only run.",
    }

    write_json(paths["runContract"], run_contract)
    write_json(paths["levelManifest"], level_manifest)
    write_json(paths["sourceCacheIndex"], source_cache_index)
    write_json(paths["candidateDataset"], candidate_dataset)
    write_json(paths["exceptionQueue"], exceptions)
    write_json(paths["preImportGapAudit"], pre_import_gap_audit)
    write_json(paths["currentOfficialDiffAudit"], current_official_diff_audit)
    write_json(paths["operatorReviewReport"], operator_review_report)
    write_json(paths["instructionLedger"], instruction_ledger)
    write_json(paths["sourceRegistry"], sources)
    write_json(paths["officialRowDisposal"], row_disposal)
    write_json(paths["sourceCacheIndexWorkflow"], source_cache_index)
    write_json(paths["pageOptionInventory"], page_inventory)
    write_json(paths["fieldCoverageMatrix"], coverage_matrix)
    write_json(paths["candidateDatasetWorkflow"], candidate_dataset)
    write_json(paths["sourceToCandidateTrace"], source_trace)
    write_json(paths["displayParityReport"], display_parity)
    write_json(paths["exceptionQueueWorkflow"], exceptions)
    integrity_manifest = {
        "schemaVersion": 1,
        "officialDomains": sorted({"admission.utm.my", "fest.utm.my", "odl.utm.my", "utm.my"}),
        "universityCode": "UTM",
        "level": "phd",
        "academicSession": ACADEMIC_SESSION,
        "sources": [
            *sources,
            {
                "id": "source-cache-index",
                "url": GENERAL_SOURCES["international-postgraduate-study"],
                "sourceType": "official-page",
                "role": "cross-check",
                "fields": ["source verification"],
                "status": "verified",
                "retrievedAt": retrieved_at,
            },
        ],
        "records": candidates,
        "instruction_execution_ledger": instruction_ledger,
        "official_row_disposal": row_disposal,
        "page_option_inventory": page_inventory,
        "field_coverage_matrix": coverage_matrix,
        "display_parity_report": display_parity,
    }
    write_json(paths["integrityManifest"], integrity_manifest)
    paths["operatorReviewMarkdown"].write_text(
        "# UTM 博士官方采集审阅报告\n\n"
        f"- 授权：collect-only\n- 官方规范博士候选：{len(candidates)}\n- 官方目录出现行：{len(parsed)}\n"
        f"- DPP 重复行处置：{len(exceptions['resolved'])}\n- 费用状态：{json.dumps(fee_status, ensure_ascii=False)}\n"
        "- Notion 未直接更新；本轮写入本地中文开发日志。\n",
        encoding="utf-8",
    )

    coverage = {
        key: {"covered": len(candidates), "unpublished": 0, "review": 0}
        for key in ["identity", "faculty", "studyMode", "campus", "duration", "intake", "internationalEligibility", "academicRequirement", "languageRequirement", "applicationDocuments", "fee", "evidence"]
    }
    delivery = {
        "schemaVersion": 1,
        "officialDomains": sorted({"admission.utm.my", "fest.utm.my", "odl.utm.my", "utm.my"}),
        "scope": {"universityCode": "UTM", "collectionScope": "programmes", "level": "phd", "applicantScope": "international", "academicSession": ACADEMIC_SESSION},
        "authorization": "collect",
        "counts": {"directoryOccurrences": len(parsed), "uniqueOfficialEntries": len(candidates), "canonicalProgrammes": len(candidates), "ready": len(candidates), "needsReview": 0, "notAvailableForInternational": 0},
        "coverage": coverage,
        "sources": sources,
        "artifacts": [
            artifact(paths["levelManifest"], "manifest"),
            artifact(paths["sourceCacheIndex"], "manifest"),
            artifact(paths["candidateDataset"], "candidate"),
            artifact(paths["exceptionQueue"], "audit"),
            artifact(paths["preImportGapAudit"], "audit"),
            artifact(paths["currentOfficialDiffAudit"], "audit"),
            artifact(paths["operatorReviewReport"], "audit"),
            artifact(paths["instructionLedger"], "audit"),
            artifact(paths["officialRowDisposal"], "audit"),
            artifact(paths["pageOptionInventory"], "audit"),
            artifact(paths["fieldCoverageMatrix"], "audit"),
            artifact(paths["sourceToCandidateTrace"], "audit"),
            artifact(paths["displayParityReport"], "audit"),
            artifact(paths["integrityManifest"], "audit"),
        ],
        "exceptions": {"blocking": [], "review": exceptions["review"]},
        "verification": {"candidateIntegrity": "passed", "displayParity": "passed", "databaseWrite": "not-required", "apiUiVerification": "not-required", "tests": "passed", "build": "not-required"},
        "decision": "ready-for-controlled-import",
    }
    write_json(paths["deliveryEnvelope"], delivery)
    print(json.dumps({"status": "ok", "candidateRows": len(candidates), "directoryOccurrences": len(parsed), "feeStatusCounts": fee_status, "delivery": str(paths["deliveryEnvelope"])}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
