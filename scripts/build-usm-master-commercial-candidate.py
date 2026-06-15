#!/usr/bin/env python3
"""Build a complete, source-labelled USM master's commercial candidate manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


APPLICATION_GUIDE_URL = (
    "https://onlineips.usm.my/images/ONLINE%20APPLICATION%20GUIDELINE%20012026%20v1.pdf"
)
COURSEWORK_MIXED_URL = (
    "https://ips.usm.my/index.php/current-student-v2/candidature-matters/"
    "coursework-and-mixed-mode-programme"
)

# Programme pages refreshed by USM on 2026-06-12 now publish numeric
# durations that were absent from the original collection snapshot.
PROGRAMME_DURATION_OVERRIDES = {
    "USM-PG-ARTICLE-342-733AE3B5": "Full Time: Min 2 semesters / Max 4 semesters Part Time: Min 3 semesters / Max 6 semesters",
    "USM-PG-ARTICLE-356-6C394BC4": "Full-time: Minimum 2 semesters / Maximum 4 semesters Part-time: Minimum 4 semesters / Maximum 8 semesters",
    "USM-PG-ARTICLE-190-DE25AD0C": "Full-time: Min 4 semesters / Max 8 semesters",
    "USM-PG-ARTICLE-562-2AAFA9B6": "Full-time: 2 years (USM MBA Year 1 and University of Glasgow MSc Year 2)",
    "USM-PG-ARTICLE-345-346DCB40": "Full-time: Min 2 semesters / Max 4 semesters Part-time: Min 4 semesters / Max 8 semesters",
    "USM-PG-ARTICLE-198-D33A1020": "Full-time: Min 2 semesters / Max 4 semesters",
    "USM-PG-ARTICLE-191-42EA011D": "Full-time: Min 3 semesters / Max 6 semesters",
    "USM-PG-ARTICLE-816-97D94C5C": "Full-time: Min 2 semesters / Max 4 semesters Part-time: Min 4 semesters / Max 6 semesters",
    "USM-PG-ARTICLE-1478-65126CE8": "Full-time: Min 2 semesters / Max 4 semesters Part-time: Min 4 semesters / Max 6 semesters",
    "USM-PG-ARTICLE-1226-61E0EF9C": "Full-time: Min 2 semesters / Max 4 semesters Part-time: Min 4 semesters / Max 6 semesters",
    "USM-PG-ARTICLE-352-D31C8D58": "Part-time: 4 semesters / 24 months",
    "USM-PG-ARTICLE-352-DA22F697": "Part-time: 4 semesters / 24 months",
    "USM-PG-ARTICLE-192-E15D3E0E": "Full-time: Min 2 semesters / Max 4 semesters Part-time: Min 4 semesters / Max 8 semesters",
    "USM-PG-ARTICLE-341-25F866C6": "Full-time: Minimum 2 semesters / Maximum 4 semesters Part-time: Minimum 4 semesters / Maximum 8 semesters",
    "USM-PG-ARTICLE-499-208F3220": "Full-time: Min 2 semesters / Max 4 semesters Part-time: Min 3 semesters / Max 6 semesters",
    "USM-PG-ARTICLE-357-1651A3F3": "Full-time: Min 2 semesters / Max 4 semesters Part-time: Min 3 semesters / Max 6 semesters",
    "USM-PG-ARTICLE-890-22D7982F": "Full-time: Min 2 semesters / Max 4 semesters Part-time: Min 4 semesters / Max 8 semesters",
    "USM-PG-ARTICLE-335-083F609A": "Full-time: Minimum 2 semesters / Maximum 4 semesters Part-time: Minimum 4 semesters / Maximum 8 semesters",
    "USM-PG-ARTICLE-335-CAAB9128": "Full-time: Minimum 2 semesters / Maximum 4 semesters Part-time: Minimum 4 semesters / Maximum 8 semesters",
    "USM-PG-ARTICLE-1499-54A1B24B": "Full-time: Min 2 semesters / Max 4 semesters Part-time: Min 3 semesters / Max 6 semesters",
    "USM-PG-ARTICLE-1500-3149EB02": "Full-time: Min 2 semesters / Max 4 semesters Part-time: Min 3 semesters / Max 6 semesters",
    "USM-PG-ARTICLE-423-8DE050DC": "Full-time: 2 semesters / 1 year",
    "USM-PG-ARTICLE-1488-CA798095": "Full-time: Min 24 months / Max 36 months",
    "USM-PG-ARTICLE-387-909293EB": "Full-time: Min 2 semesters / Max 4 semesters Part-time: Min 4 semesters / Max 8 semesters",
    "USM-PG-ARTICLE-118-E8F9BDA4": "Full-time: 2 years (4 semesters); maximum 4 years (8 semesters)",
    "USM-PG-ARTICLE-226-D47C7183": "Full-time: Min 2 semesters / Max 4 semesters Part-time: Min 4 semesters / Max 8 semesters",
    "USM-PG-ARTICLE-1513-8022424A": "Full-time: Min 2 semesters / Max 4 semesters",
    "USM-PG-ARTICLE-195-3919140E": "Full-time: Min 12 months / Max 36 months Part-time: Min 24 months / Max 72 months",
    "USM-PG-ARTICLE-106-8E379C40": "Full-time: Min 2 semesters / Max 4 semesters Part-time: Min 4 semesters / Max 8 semesters",
    "USM-PG-ARTICLE-351-57741454": "Full-time: Minimum 4 semesters / Maximum 8 semesters Part-time: Minimum 6 semesters / Maximum 10 semesters",
}

# Officially reviewed international eligibility decisions that are not
# recoverable from fee availability alone.
INTERNATIONAL_ELIGIBILITY_OVERRIDES = {
    "USM-PG-ARTICLE-118-E8F9BDA4": {
        "status": "available-after-official-review",
        "reason": "Current official dual-degree programme entry and international postgraduate application rules confirm international scope.",
    },
    "USM-PG-ARTICLE-882-4E737064": {
        "status": "available-after-official-review",
        "reason": "Current official programme entry and international postgraduate application rules confirm international scope.",
    },
}

APPLICATION_DOCUMENTS = [
    {"id": "passport", "nameEn": "Passport for international applicants", "sourcePage": 2},
    {"id": "photo", "nameEn": "Passport-size photograph", "sourcePage": 2},
    {
        "id": "bachelor-certificate",
        "nameEn": "Bachelor degree certificate and official English translation",
        "sourcePage": 2,
    },
    {
        "id": "academic-transcripts",
        "nameEn": "Academic transcripts and official English translation",
        "sourcePage": 2,
    },
    {
        "id": "graduation-certificate",
        "nameEn": "Graduation certificate, where applicable",
        "sourcePage": 2,
    },
    {
        "id": "grading-scheme",
        "nameEn": "Official grading scheme",
        "sourcePage": 2,
    },
    {
        "id": "english-result",
        "nameEn": "Accepted English-language test result or exemption evidence",
        "sourcePage": 2,
    },
    {
        "id": "research-proposal",
        "nameEn": "Research proposal for research-mode applications",
        "sourcePage": 2,
        "conditional": "research",
    },
    {
        "id": "referees",
        "nameEn": "Referee details for research mode or Master of Medicine",
        "sourcePage": 2,
        "conditional": "research-or-master-of-medicine",
    },
    {
        "id": "scholarship-letter",
        "nameEn": "Scholarship letter, if available",
        "sourcePage": 2,
        "conditional": "if-applicable",
    },
]

# Rows that are fee variants or specialisations under one public directory entry.
SPECIALISATION_FEE_TARGETS = {
    **{
        name: "USM-PG-ARTICLE-362"
        for name in (
            "Master of Arts (Education) - Curriculum Studies",
            "Master of Arts (Education) - Early Childhood Education",
            "Master of Arts (Education) - Education Management and Administration",
            "Master of Arts (Education) - Educational Psychology",
            "Master of Arts (Education) - Educational Technology and Multimedia",
            "Master of Arts (Education) - English Language Education/TESOL",
            "Master of Arts (Education) - Malay Language Education",
            "Master of Arts (Education) - Mathematics Education",
            "Master of Arts (Education) - Psychometrics and Educational Measurement",
            "Master of Arts (Education) - Science Education",
            "Master of Arts (Education) - Special Education",
        )
    },
    **{
        name: "USM-PG-ARTICLE-334"
        for name in (
            "Master of Education in Curriculum Studies",
            "Master of Education in Education Management and Administration",
            "Master of Education in Educational Psychology",
            "Master of Education in Educational Technology",
            "Master of Education in English Language Education/TESOL",
            "Master of Education in Science Education",
        )
    },
    "Master of Science in Electronic Systems Design Engineering - Industry": "USM-PG-ARTICLE-386",
    "Master of Science (Microelectronic Engineering) - Industry": "USM-PG-ARTICLE-389",
    "Master of Landscape Architecture (Track 1)": "USM-PG-ARTICLE-193",
    "Master of Landscape Architecture (Track 2)": "USM-PG-ARTICLE-193",
    "Master of Landscape Architecture (Track 3)": "USM-PG-ARTICLE-193",
    **{
        name: "USM-PG-ARTICLE-442"
        for name in (
            "Master of Medicine (Anaesthesiology and Critical Care)",
            "Master of Medicine (Emergency Medicine)",
            "Master of Medicine (Family Medicine)",
            "Master of Medicine (Internal Medicine)",
            "Master of Medicine (Obstetrics and Gynaecology)",
            "Master of Medicine (Ophthalmology)",
            "Master of Medicine (Orthopaedics)",
            "Master of Medicine (Otorinolaringology, Head and Neck Surgery)",
            "Master of Medicine (Paediatrics)",
            "Master of Medicine (Psychiatry)",
            "Master of Medicine (Radiology)",
            "Master of Medicine (Surgery)",
        )
    },
}

# Current fee rows that intentionally apply to one or more directory offerings.
DIRECT_FEE_TARGETS = {
    "Master of Arts in Southeast Asian History": ["USM-PG-ARTICLE-257"],
    "Master of Arts in Hadith": ["USM-PG-ARTICLE-258"],
    "Master of Arts in Linguistics and English Language Studies": ["USM-PG-ARTICLE-259"],
    "Master of Communication": ["USM-PG-ARTICLE-339", "USM-PG-ARTICLE-1425"],
    "Master of Science (Medical Education)": ["USM-PG-ARTICLE-452"],
    "Master of Science (Solid State Physics) - Dual Degree Germany": [
        "USM-PG-SLUG-MSC-SOLID-STATE-PHYSICS-DUAL-DEGREE",
        "USM-PG-ARTICLE-563",
    ],
    "Master of Science in Bioprocess Technology": ["USM-PG-ARTICLE-178"],
    "Master of Science in Tourism Development": ["USM-PG-ARTICLE-184"],
    "Master of Science in Tropical Plant Disease Management": [
        "USM-PG-SLUG-MSC-TROPICAL-PLANT-DISEASE-MANAGEMENT"
    ],
    "Master in Counseling": ["USM-PG-ARTICLE-342"],
    "Master in Dental Sciences": ["USM-PG-ARTICLE-947"],
    "Master of Business Administration": ["USM-PG-ARTICLE-343"],
    "Master of Business Administration - Double Degree UK": ["USM-PG-ARTICLE-562"],
    "Master of Business Administration - Dual Degree Indonesia": ["USM-PG-ARTICLE-564"],
    "Master of Business Administration (Online)": ["USM-PG-ARTICLE-344"],
    "Master of Business Administration (Online) - Dual Degree Indonesia": [
        "USM-PG-ARTICLE-564"
    ],
    "Master of Business Analytics (also available in Online mode)": [
        "USM-PG-ARTICLE-355",
        "USM-PG-ARTICLE-359",
    ],
    "Master of Design in Creative Industry": ["USM-PG-ARTICLE-816", "USM-PG-ARTICLE-1226"],
    "Master of Economics Management": ["USM-PG-ARTICLE-262"],
    "Master of Professional Management (also available in Online mode)": [
        "USM-PG-ARTICLE-357",
        "USM-PG-ARTICLE-335",
    ],
    "Master of Psychology (Clinical Psychology) - Joint Degree": [
        "USM-PG-ARTICLE-449",
        "USM-PG-ARTICLE-568",
    ],
    "Master of Public Administration": ["USM-PG-ARTICLE-263", "USM-PG-ARTICLE-1427"],
    "Master of Science in Cyber Security": ["USM-PG-ARTICLE-883"],
    "Master of Science in Geomatics for Disaster Risk Reduction": ["USM-PG-ARTICLE-179"],
    "Master of Science in Teaching of Mathematics": [
        "USM-PG-SLUG-MSC-TEACHING-OF-MATHEMATICS-SCHOOL-OF-MATHEMATICAL-SCIENCES",
        "USM-PG-SLUG-MSC-TEACHING-OF-MATHEMATICS-SCHOOL-OF-MATHEMATICAL-SCIENCES-2",
    ],
}

FEE_ONLY_OFFERINGS = {
    "Master of Pathology (Chemical Pathology)": {
        "parentCode": None,
        "identityStatus": "official-fee-row-without-public-directory-entry",
    },
    "Master of Pathology (Medical Genetics)": {
        "parentCode": None,
        "identityStatus": "official-fee-row-without-public-directory-entry",
    },
}

MODE_SPECIFIC_FEE_TARGETS = {
    ("Master of Science in Building Technology", "mixed"): ["USM-PG-ARTICLE-226"],
    ("Master of Science in Building Technology", "coursework"): ["USM-PG-ARTICLE-183"],
}

LATEST_PROGRAMME_FEES = {
    "USM-PG-ARTICLE-118": {
        "academicSession": "2025/2026",
        "malaysianAmount": 22600.0,
        "internationalAmount": 9000.0,
    },
    "USM-PG-ARTICLE-191": {
        "academicSession": "2025/2026",
        "malaysianAmount": 21120.0,
        "internationalAmount": 8800.0,
    },
    "USM-PG-ARTICLE-562": {
        "academicSession": "current",
        "internationalCurrency": "GBP",
        "internationalAmount": 5000.0,
    },
    "USM-PG-ARTICLE-890": {
        "academicSession": "2025/2026",
        "malaysianAmount": 18900.0,
        "internationalAmount": 10500.0,
    },
    "USM-PG-ARTICLE-1424": {
        "academicSession": "2026/2027",
        "malaysianAmount": 18900.0,
        "internationalAmount": 9030.0,
    },
    "USM-PG-ARTICLE-1425": {
        "academicSession": "2026/2027",
        "malaysianAmount": 20000.0,
        "internationalAmount": 8600.0,
    },
    "USM-PG-ARTICLE-1498": {
        "academicSession": "2026/2027",
        "malaysianAmount": 18900.0,
        "internationalAmount": 9030.0,
    },
    "USM-PG-ARTICLE-339": {
        "academicSession": "2026/2027",
        "malaysianAmount": 20000.0,
        "internationalAmount": 8600.0,
    },
    "USM-PG-ARTICLE-355": {
        "academicSession": "2026/2027",
        "malaysianAmount": 18900.0,
        "internationalAmount": 9030.0,
    },
}

RESEARCH_UNIT_ALIASES = {
    "Centre For Marine And Coastal Studies": "Centre for Marine and Coastal Studies",
    "Centre for Global Sustainability Studies": "Centre for Global Sustainability Studies (Sciences)",
    "Centre for Islamic Development Management Studies": "Centre for Islamic Dev. Management Studies",
    "Centre for Research on Women and Gender (KANITA)": "Centre for Research on Women & Gender",
    "Centre for Research On Women and Gender (KANITA)": "Centre for Research on Women & Gender",
    "Collaborative Microelectronic Design Excellence Centre": (
        "Collab. Microelectronic Design Excellence Centre"
    ),
    "Cyber Security Research Centre": "National Advanced IPv6 Centre",
    "Cybersecurity Research Centre": "National Advanced IPv6 Centre",
    "Institute for Research in Molecular Medicine": "Inst. for Research in Molecular Medicine",
    "Institute of Nano Optoelectronics Research & Technology": (
        "Inst. of Nano-Optoelectronics Research & Tech."
    ),
    "Malaysian Institute of Pharmaceuticals and Nutraceuticals": (
        "M’sian Institute of Pharmaceuticals & Nutraceuticals"
    ),
    "Pusat Kanser Tun Abdullah Ahmad Badawi": "Advanced Medical and Dental Institute",
    "River Engineering and Urban Drainage Research Centre": (
        "River Eng. & Urban Drainage Research Centre"
    ),
    "School of Languages, Literacies & Translation": (
        "School of Languages, Literacies and Translation"
    ),
    "School of Materials and Mineral Resources Engineering": (
        "School of Materials and Mineral Resources Eng."
    ),
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def clean_duration(value: str | None) -> str:
    return clean(value).split("Postgraduate Institute of Postgraduate Studies", 1)[0].strip()


def has_numeric_duration(value: str) -> bool:
    return bool(re.search(r"\d+(?:\.\d+)?\s*(?:years?|months?|semesters?)", value, re.I))


def normalized_name(value: str) -> str:
    value = value.lower().replace("&", "and").replace("–", "-").replace("—", "-")
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def detail_code(url: str) -> str:
    article_id = re.search(r"(?:[?&])id=(\d+)", url)
    if article_id:
        return f"USM-PG-ARTICLE-{article_id.group(1)}"
    slug = url.split("?", 1)[0].rstrip("/").split("/")[-1]
    return f"USM-PG-SLUG-{slug.upper()}"


def normalized_official_url(url: str) -> str:
    article_id = re.search(r"(?:[?&])id=(\d+)", url)
    if article_id:
        return f"https://admission.usm.my/index.php/postgraduate/programmes?id={article_id.group(1)}"
    return url.rstrip("/")


def current_faculty(value: str) -> str:
    faculty = (
        value.title()
        .replace(" Of ", " of ")
        .replace(" And ", " and ")
        .replace(" For ", " for ")
        .replace(" In ", " in ")
        .replace("Usm", "USM")
        .replace("(Kanita)", "(KANITA)")
    )
    return {
        "School of Languages, Literacies and Translation": (
            "School of Languages, Literacies & Translation"
        ),
        "Institute of Nano-Optoelectronics Research and Technology": (
            "Institute of Nano Optoelectronics Research & Technology"
        ),
    }.get(faculty, faculty)


def current_catalogue_record(row: dict) -> dict:
    base_code = detail_code(row["url"])
    identity = hashlib.sha1(
        (
            f"{row['name']}|{row['mode']}|{row['degree']}|"
            f"{row['school']}|{row['cluster']}"
        ).encode()
    ).hexdigest()[:8].upper()
    title = row["name"]
    mode = {
        "RESEARCH": "research",
        "COURSEWORK": "coursework",
        "MIXED MODE": "mixed",
        "ODL (ONLINE)": "online",
    }[row["mode"]]
    if title.startswith(
        ("MASTER OF MEDICINE", "MASTER OF SURGERY", "MASTER OF PATHOLOGY")
    ):
        mode = "clinical"
    delivery = {
        "CONVENTIONAL": "on-campus-or-unspecified",
        "OFFSHORE": "offshore",
        "DOUBLE DEGREE": "double-degree",
        "DUAL DEGREE": "dual-degree",
        "JOINT DEGREE": "joint-degree",
    }[row["degree"]]
    return {
        "code": f"{base_code}-{identity}",
        "detailCode": base_code,
        "nameEnOfficial": title,
        "level": "master",
        "universityCode": "USM",
        "facultyEn": current_faculty(row["school"]),
        "campus": "official-detail-review-required",
        "studyMode": mode,
        "delivery": delivery,
        "degreeType": row["degree"],
        "cluster": row["cluster"].lower().replace(" & ", "-and-").replace(" ", "-"),
        "applicantScope": "international",
        "internationalEligibility": "official-detail-review-required",
        "academicSession": None,
        "officialSourceUrl": row["url"],
        "directoryOccurrences": 1,
        "identityStatus": "current-official-catalogue-entry",
    }


def infer_mode(record: dict, detail: dict, attached_fee_modes: list[str]) -> tuple[str, str]:
    if record["studyMode"] in {
        "research",
        "coursework",
        "mixed",
        "clinical",
        "online",
    }:
        return record["studyMode"], "official-directory-title"
    title = record["nameEnOfficial"].lower()
    text = " ".join(
        [
            title,
            detail.get("overviewExcerpt", ""),
            detail.get("officialFeeText", ""),
        ]
    ).lower()
    if title.startswith(("master of medicine", "master of surgery", "master of pathology")):
        return "clinical", "official-degree-title"
    if "by research" in text or "research mode" in text or "tuition fee (semester)" in text:
        return "research", "official-detail-page"
    if attached_fee_modes:
        mode = Counter(attached_fee_modes).most_common(1)[0][0]
        return mode, "official-current-fee-row"
    if "mixed mode" in text or " by mixed" in text:
        return "mixed", "official-detail-page"
    if "coursework" in text or "course structure" in text:
        return "coursework", "official-detail-page"
    return "research", "official-directory-academic-unit-default-reviewable"


def campus_for(record: dict) -> dict:
    title = record["nameEnOfficial"].lower()
    faculty = record["facultyEn"]
    if record["delivery"] == "offshore":
        country = "International partner campus"
        for token in ("Istanbul", "Uzbekistan", "Iraq", "Indonesia"):
            if token.lower() in title:
                country = token
                break
        return {"name": country, "status": "official-title"}
    if "usm@kl" in title or faculty == "USM@KL":
        return {"name": "USM@KL, Kuala Lumpur", "status": "official-title"}
    if faculty in {
        "School of Aerospace Engineering",
        "School of Chemical Engineering",
        "School of Civil Engineering",
        "School of Electrical and Electronic Engineering",
        "School of Materials and Mineral Resources Engineering",
        "School of Mechanical Engineering",
    }:
        return {"name": "Engineering Campus, Nibong Tebal", "status": "institutional-unit-mapping"}
    if faculty in {
        "School of Dental Sciences",
        "School of Health Sciences",
        "School of Medical Sciences",
    }:
        return {"name": "Health Campus, Kubang Kerian", "status": "institutional-unit-mapping"}
    if faculty == "Pusat Kanser Tun Abdullah Ahmad Badawi":
        return {"name": "Advanced Medical and Dental Institute, Bertam", "status": "unit-mapping"}
    return {"name": "Main Campus, Penang", "status": "institutional-unit-mapping"}


def research_fee_for(record: dict, research_fees: dict[str, dict]) -> dict | None:
    unit = record["facultyEn"]
    if unit == "School of Distance Education":
        unit = (
            "School of Distance Education (Sciences)"
            if record["cluster"] == "pure-sciences"
            else "School of Distance Education (Arts)"
        )
    if unit == "Centre for Global Sustainability Studies":
        unit = (
            "Centre for Global Sustainability Studies (Sciences)"
            if record["cluster"] in {"pure-sciences", "applied-sciences"}
            else "Centre for Global Sustainability Studies (Arts)"
        )
    unit = RESEARCH_UNIT_ALIASES.get(unit, unit)
    row = research_fees.get(unit)
    if not row:
        return None
    return {
        "status": "official-rate-only",
        "feeType": "research-academic-unit",
        "academicUnit": unit,
        "academicSession": row["academicSession"],
        "international": row["international"],
        "malaysian": row["malaysian"],
        "officialSourceUrl": row["officialFeeSourceUrl"],
        "sourcePage": row["sourcePage"],
    }


def named_fee_value(row: dict, allocation: str) -> dict:
    international_amount = row.get("international", {}).get("amount")
    return {
        "status": (
            "verified-current-official-fee"
            if international_amount is not None
            else "official-total-unpublished"
        ),
        "feeType": allocation,
        "officialFeeName": row["nameEnOfficial"],
        "studyMode": row["studyMode"],
        "academicSession": row["academicSession"],
        "international": row["international"],
        "malaysian": row["malaysian"],
        "officialSourceUrl": row["officialFeeSourceUrl"],
        "sourcePage": row["sourcePage"],
    }


def latest_programme_fee(code: str, detail: dict, previous_fee: dict) -> dict:
    latest = LATEST_PROGRAMME_FEES[code]
    malaysian_amount = latest.get("malaysianAmount")
    return {
        "status": "verified-current-official-fee",
        "feeType": "programme-detail-latest-published",
        "academicSession": latest["academicSession"],
        "effectiveNote": (
            "Effective for students from the 2026/2027 intake."
            if latest["academicSession"] == "2026/2027"
            else "Published on the current official programme page."
        ),
        "international": {
            "currency": latest.get("internationalCurrency", "USD"),
            "amount": latest["internationalAmount"],
            "basis": "total-programme",
        },
        **(
            {
                "malaysian": {
                    "currency": "MYR",
                    "amount": malaysian_amount,
                    "basis": "total-programme",
                }
            }
            if malaysian_amount is not None
            else {}
        ),
        "officialSourceUrl": detail["officialSourceUrl"],
        "detailSha256": detail["sha256"],
        "previousPublishedFee": previous_fee if previous_fee.get("international") else None,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--application-guide", required=True, type=Path)
    parser.add_argument("--coursework-mixed-html", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    source = json.loads(args.source.read_text(encoding="utf-8"))
    details = {
        normalized_official_url(item["officialSourceUrl"]): item
        for item in source["details"]
    }
    records_by_code = {item["code"]: item for item in source["records"]}
    current_rows = source.get("currentCatalogue", {}).get("rows", [])
    if len(current_rows) != 305:
        raise ValueError(
            f"Expected 305 current official master rows, got {len(current_rows)}."
        )
    current_records = [current_catalogue_record(row) for row in current_rows]
    current_records_by_detail: dict[str, list[dict]] = defaultdict(list)
    current_records_by_name: dict[str, list[dict]] = defaultdict(list)
    for record in current_records:
        current_records_by_detail[record["detailCode"]].append(record)
        current_records_by_name[normalized_name(record["nameEnOfficial"])].append(record)
    named_rows = {
        (item["nameEnOfficial"], item["studyMode"]): item
        for item in source["feeSchedule"]["masterNamedProgrammeFees"]
    }
    named_rows_by_name: dict[str, list[dict]] = defaultdict(list)
    for row in named_rows.values():
        named_rows_by_name[row["nameEnOfficial"]].append(row)
    research_fees = {
        item["academicUnit"]: item for item in source["feeSchedule"]["researchAcademicUnitFees"]
    }

    direct_allocations: dict[str, list[dict]] = defaultdict(list)
    specialisation_allocations: dict[str, list[dict]] = defaultdict(list)
    allocated_fee_rows: dict[str, dict] = {}

    for match in source["feeReconciliation"]["matches"]:
        row_key = (match["feeName"], match["studyMode"])
        if row_key in MODE_SPECIFIC_FEE_TARGETS:
            continue
        row = named_rows[row_key]
        direct_allocations[match["recordCode"]].append(row)
        allocated_fee_rows[f"{row['studyMode']}::{row['nameEnOfficial']}"] = {
            "officialFeeName": row["nameEnOfficial"],
            "studyMode": row["studyMode"],
            "allocation": "direct",
            "targetCodes": [match["recordCode"]],
        }

    for (fee_name, fee_mode), target_codes in MODE_SPECIFIC_FEE_TARGETS.items():
        row = named_rows[(fee_name, fee_mode)]
        for code in target_codes:
            direct_allocations[code].append(row)
        allocated_fee_rows[f"{fee_mode}::{fee_name}"] = {
            "officialFeeName": fee_name,
            "studyMode": fee_mode,
            "allocation": "direct-mode-specific",
            "targetCodes": target_codes,
        }

    for fee_name, target_codes in DIRECT_FEE_TARGETS.items():
        rows = named_rows_by_name[fee_name]
        if len(rows) != 1:
            raise ValueError(f"Fee mode required for duplicate fee name: {fee_name}")
        row = rows[0]
        for code in target_codes:
            if code not in records_by_code:
                raise ValueError(f"Unknown fee target code: {code}")
            direct_allocations[code].append(row)
        allocated_fee_rows[f"{row['studyMode']}::{fee_name}"] = {
            "officialFeeName": fee_name,
            "studyMode": row["studyMode"],
            "allocation": "direct-manual",
            "targetCodes": target_codes,
        }

    for fee_name, code in SPECIALISATION_FEE_TARGETS.items():
        rows = named_rows_by_name[fee_name]
        if len(rows) != 1:
            raise ValueError(f"Fee mode required for duplicate fee name: {fee_name}")
        row = rows[0]
        specialisation_allocations[code].append(row)
        allocated_fee_rows[f"{row['studyMode']}::{fee_name}"] = {
            "officialFeeName": fee_name,
            "studyMode": row["studyMode"],
            "allocation": "specialisation-or-variant",
            "targetCodes": [code],
        }

    fee_only = []
    for fee_name, identity in FEE_ONLY_OFFERINGS.items():
        rows = named_rows_by_name[fee_name]
        if len(rows) != 1:
            raise ValueError(f"Fee mode required for duplicate fee name: {fee_name}")
        row = rows[0]
        current_targets = current_records_by_name.get(normalized_name(fee_name), [])
        if current_targets:
            for target in current_targets:
                direct_allocations[target["code"]].append(row)
            allocated_fee_rows[f"{row['studyMode']}::{fee_name}"] = {
                "officialFeeName": fee_name,
                "studyMode": row["studyMode"],
                "allocation": "direct-current-catalogue",
                "targetCodes": [target["code"] for target in current_targets],
            }
            continue
        fee_only.append(
            {
                "officialName": fee_name,
                **identity,
                "studyMode": row["studyMode"],
                "fee": named_fee_value(row, "fee-only-offering"),
                "officialSourceUrl": row["officialFeeSourceUrl"],
            }
        )
        allocated_fee_rows[f"{row['studyMode']}::{fee_name}"] = {
            "officialFeeName": fee_name,
            "studyMode": row["studyMode"],
            "allocation": "fee-only-offering",
            "targetCodes": [],
        }

    candidates = []
    mode_counts = Counter()
    fee_status_counts = Counter()
    field_source_counts = Counter()
    exceptions = []
    for record in current_records:
        detail = details[normalized_official_url(record["officialSourceUrl"])]
        attached_rows = list(direct_allocations[record["code"]])
        attached_rows.extend(direct_allocations[record["detailCode"]])
        attached_rows.extend(specialisation_allocations[record["detailCode"]])
        exact_name_rows = [
            row
            for row in named_rows.values()
            if normalized_name(row["nameEnOfficial"])
            == normalized_name(record["nameEnOfficial"])
            and (
                row["studyMode"] == record["studyMode"]
                or (
                    record["studyMode"] == "online"
                    and row["studyMode"] == "coursework"
                )
            )
        ]
        attached_rows = exact_name_rows + [
            row for row in attached_rows if row not in exact_name_rows
        ]
        mode, mode_source = infer_mode(
            record, detail, [row["studyMode"] for row in attached_rows]
        )
        mode_counts[mode] += 1

        if attached_rows:
            fee = named_fee_value(attached_rows[0], "named-programme")
            if len(attached_rows) > 1:
                fee["alternatives"] = [
                    named_fee_value(row, "named-programme") for row in attached_rows[1:]
                ]
        elif mode == "research" and record["delivery"] != "offshore":
            fee = research_fee_for(record, research_fees)
            if fee is None:
                fee = {
                    "status": "official-current-fee-not-mapped",
                    "reason": "No current research fee academic-unit match.",
                }
                exceptions.append(
                    {
                        "severity": "review",
                        "code": record["code"],
                        "field": "fee",
                        "reason": fee["reason"],
                    }
                )
        else:
            fee = {
                "status": "official-current-fee-not-published-for-directory-entry",
                "reason": "No unique current 2025/2026 named fee row applies to this directory entry.",
            }
        if record["detailCode"] in LATEST_PROGRAMME_FEES:
            fee = latest_programme_fee(record["detailCode"], detail, fee)
        fee_status_counts[fee["status"]] += 1

        academic = clean(detail.get("officialAcademicRequirement"))
        language = clean(detail.get("officialLanguageRequirement"))
        duration = PROGRAMME_DURATION_OVERRIDES.get(record["code"]) or clean_duration(
            detail.get("durationOfficial")
        )
        if duration and not has_numeric_duration(duration):
            duration = ""
        intake = clean(detail.get("officialIntake"))
        if not academic:
            academic = source["generalRequirements"]["officialAcademicRequirement"]
            academic_status = "official-general-rule"
        else:
            academic_status = "official-programme-specific"
        if not language:
            language = source["generalRequirements"]["officialLanguageRequirement"]
            language_status = "official-general-rule"
        else:
            language_status = "official-programme-specific"
        if not duration and mode == "research":
            duration = "Full-time: 2-6 semesters; Part-time: 4-12 semesters"
            duration_status = "official-research-mode-rule"
        elif duration:
            duration_status = (
                "official-programme-page-refreshed-2026-06-12"
                if record["code"] in PROGRAMME_DURATION_OVERRIDES
                else "official-programme-specific"
            )
        else:
            duration = "Subject to the published programme structure"
            duration_status = "official-coursework-mixed-general-rule"
        if not intake and mode == "research":
            intake = "Semester I: September-February; Semester II: March-August"
            intake_status = "official-research-semester-rule"
        elif intake:
            intake_status = "official-programme-specific"
        else:
            intake = "Programme-specific intake not published on the public detail page"
            intake_status = "official-unpublished"

        international_evidence = bool(
            "international applicant" in language.lower()
            or fee.get("international")
            or record["delivery"] == "offshore"
        )
        international_eligibility = (
            "officially-addresses-international-applicants"
            if international_evidence
            else "not-explicitly-confirmed-on-public-detail"
        )
        eligibility_override = INTERNATIONAL_ELIGIBILITY_OVERRIDES.get(record["code"])
        if eligibility_override:
            international_eligibility = eligibility_override["status"]
        if re.search(
            r"malaysian(?:\s+candidate)?\s+only",
            record["nameEnOfficial"],
            re.IGNORECASE,
        ):
            international_eligibility = "not-eligible-malaysian-candidate-only"

        specialisation_fees = [
            named_fee_value(row, "specialisation-or-variant")
            for row in attached_rows[1:]
        ]
        field_source_counts.update(
            [academic_status, language_status, duration_status, intake_status]
        )
        candidates.append(
            {
                "code": record["code"],
                "detailCode": record["detailCode"],
                "officialName": record["nameEnOfficial"],
                "level": "master",
                "universityCode": "USM",
                "faculty": record["facultyEn"],
                "campus": campus_for(record),
                "studyMode": mode,
                "studyModeSource": mode_source,
                "delivery": record["delivery"],
                "internationalEligibility": international_eligibility,
                **(
                    {
                        "internationalEligibilityEvidence": eligibility_override[
                            "reason"
                        ]
                    }
                    if eligibility_override
                    else {}
                ),
                "identityStatus": "verified-official-public-directory-entry",
                "overviewOfficial": detail.get("overviewExcerpt") or "",
                "academicRequirement": {
                    "textEnOfficial": academic,
                    "status": academic_status,
                    "officialSourceUrl": (
                        detail["officialSourceUrl"]
                        if academic_status == "official-programme-specific"
                        else source["generalRequirements"]["officialSourceUrl"]
                    ),
                },
                "languageRequirement": {
                    "textEnOfficial": language,
                    "status": language_status,
                    "officialSourceUrl": (
                        detail["officialSourceUrl"]
                        if language_status == "official-programme-specific"
                        else source["generalRequirements"]["officialSourceUrl"]
                    ),
                },
                "duration": {"textEnOfficial": duration, "status": duration_status},
                "intake": {"textEnOfficial": intake, "status": intake_status},
                "fee": fee,
                "specialisationOrVariantFees": specialisation_fees,
                "applicationDocumentsPolicy": "shared-current-onlineips-guide",
                "careers": {
                    "status": "official-unpublished",
                    "items": [],
                    "note": "No structured career list is asserted without a programme-level official source.",
                },
                "localisation": {
                    "officialLanguage": "en",
                    "status": "source-complete-localisation-pending",
                    "requiredLocales": ["en", "ms", "zh-CN", "zh-TW"],
                },
                "evidence": {
                    "officialDirectoryUrl": record["officialSourceUrl"],
                    "detailSha256": detail["sha256"],
                    "detailStatus": detail["status"],
                    "retrievedAt": detail["retrievedAt"],
                },
            }
        )

    unallocated = sorted(
        f"{mode}::{name}"
        for name, mode in named_rows
        if f"{mode}::{name}" not in allocated_fee_rows
    )
    if unallocated:
        raise ValueError(f"Unallocated current named fee rows: {unallocated}")

    output = {
        "schemaVersion": "studymy-usm-master-candidate-v1",
        "generatedAt": utc_now(),
        "universityCode": "USM",
        "level": "master",
        "applicantScope": "international",
        "academicSession": {
            "baseFeeSchedule": "2025/2026",
            "programmeOverrides": "2026/2027 where explicitly published",
        },
        "catalogueDecision": {
            "status": "complete-current-official-catalogue",
            "officialDirectoryEntryCount": len(candidates),
            "canonicalCountClaim": (
                "305 distinct official master catalogue identities from the current dynamic "
                "directory; 255 unique detail URLs are retained as supporting evidence."
            ),
            "applicationChoiceStatus": "current-public-catalogue-authority",
        },
        "sources": [
            {
                "id": "master-official-source",
                "localPath": str(args.source),
                "sha256": sha256(args.source),
            },
            {
                "id": "onlineips-application-guide-2026",
                "url": APPLICATION_GUIDE_URL,
                "localPath": str(args.application_guide),
                "sha256": sha256(args.application_guide),
                "published": "2026-01",
            },
            {
                "id": "coursework-mixed-candidature",
                "url": COURSEWORK_MIXED_URL,
                "localPath": str(args.coursework_mixed_html),
                "sha256": sha256(args.coursework_mixed_html),
            },
        ],
        "applicationDocuments": {
            "status": "verified-current-official-guide",
            "officialSourceUrl": APPLICATION_GUIDE_URL,
            "items": APPLICATION_DOCUMENTS,
            "uploadRules": [
                "Application documents are uploaded in PDF format.",
                "Passport photograph is uploaded as JPEG.",
                "Official English translations are required for non-English documents.",
                "Long documents may need to be split into separate uploads.",
            ],
        },
        "records": candidates,
        "feeOnlyOfferings": fee_only,
        "feeRowAllocations": [
            {"feeRowKey": key, **allocation}
            for key, allocation in sorted(allocated_fee_rows.items())
        ],
        "audit": {
            "currentOfficialCatalogueRows": len(current_rows),
            "currentOfficialUniqueUrls": source["currentCatalogue"][
                "uniqueOfficialUrls"
            ],
            "legacyDirectoryDetailEntries": len(source["records"]),
            "currentDetailsAddedBeyondLegacyDirectory": source["currentCatalogue"][
                "detailUrlsAddedBeyondLegacyDirectory"
            ],
            "recordCount": len(candidates),
            "modeCounts": dict(sorted(mode_counts.items())),
            "feeStatusCounts": dict(sorted(fee_status_counts.items())),
            "fieldSourceCounts": dict(sorted(field_source_counts.items())),
            "currentNamedFeeRowsAccountedFor": len(allocated_fee_rows),
            "feeOnlyOfferingCount": len(fee_only),
            "exceptionCount": len(exceptions),
            "exceptions": exceptions,
            "publicationDecision": "publish-ready-subset",
            "blockingReasons": [
                "Needs-review and Malaysian-only records must remain excluded from the public international catalogue.",
                "Official-unpublished fees must remain explicitly labelled and must not be inferred.",
            ],
        },
        "databaseWrite": "not-performed",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "output": str(args.output),
                "records": len(candidates),
                "modes": dict(mode_counts),
                "namedFeeRowsAccountedFor": len(allocated_fee_rows),
                "exceptions": len(exceptions),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
