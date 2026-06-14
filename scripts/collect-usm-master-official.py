#!/usr/bin/env python3
"""Collect and audit official USM master's programme data without writing the database."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

from pypdf import PdfReader


DIRECTORY_URL = "https://admission.usm.my/index.php/postgraduate/programmes"
FEE_PAGE_URL = "https://admission.usm.my/index.php/postgraduate/fee-pg"
FEE_URL = (
    "https://admission.usm.my/images/PG%20FEE%20-%20YURAN%20PG/"
    "PG%20FEES%2011.03.2025.pdf"
)
GENERAL_REQUIREMENT_URL = (
    "https://admission.usm.my/index.php/postgraduate/programmes"
    "?catid=48&id=785%3Ageneral-entry-requirement&view=article"
)
IPS_ADMISSION_URL = "https://ips.usm.my/index.php/download/admission"
IPS_RESEARCH_MODE_URL = (
    "https://ips.usm.my/index.php/current-student-v2/"
    "candidature-matters/research-mode-programme"
)
READER_PREFIX = "https://r.jina.ai/"

MASTER_PATTERN = re.compile(r"(^|\b)(Master|Masters|MSc|MA)(\b|\s*\()", re.IGNORECASE)
DOCTOR_PATTERN = re.compile(r"(^|\b)(Doctor|PhD|PHD)(\b|\s*\()", re.IGNORECASE)
PROGRAMME_LINK_PATTERN = re.compile(
    r"###\s+\[([^\]]+)\]\((https://admission\.usm\.my/[^)\n]+)\)"
)
DIRECTORY_EVENT_PATTERN = re.compile(
    r"\*\s+#\s+([^\n]+)|"
    r"###\s+\[([^\]]+)\]\((https://admission\.usm\.my/[^)\n]+)\)"
)
SECTION_PATTERN = re.compile(
    r"(?m)^\s*(?:\*\s+)?###\s+"
    r"(OVERVIEW|ADMISSION REQUIREMENTS|LANGUAGE REQUIREMENTS|DURATION|"
    r"SEMESTER INTAKE|FEES)\s*$"
)


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_path(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def classify_level(title: str) -> str:
    if DOCTOR_PATTERN.search(title):
        return "phd"
    if MASTER_PATTERN.search(title):
        return "master"
    return "unknown"


def infer_study_mode(title: str) -> str:
    lowered = title.lower()
    if "mixed" in lowered:
        return "mixed"
    if "coursework" in lowered:
        return "coursework"
    if "research" in lowered:
        return "research"
    return "official-title-unspecified"


def infer_delivery(title: str, url: str) -> str:
    lowered = title.lower()
    if "offshore" in lowered:
        return "offshore"
    if "catid=57" in url or "double degree" in lowered:
        return "double-degree"
    if "catid=58" in url or "dual degree" in lowered:
        return "dual-degree"
    if "catid=59" in url or "joint degree" in lowered:
        return "joint-degree"
    if "online" in lowered:
        return "online-or-hybrid"
    return "on-campus-or-unspecified"


def infer_cluster(url: str) -> str:
    path = urlparse(url).path
    if "/pure-sciences/" in path:
        return "pure-sciences"
    category_match = re.search(r"(?:[?&])catid=(\d+)", url)
    category = category_match.group(1) if category_match else ""
    return {
        "51": "applied-sciences",
        "52": "pure-arts",
        "53": "applied-arts",
        "54": "engineering",
        "55": "medical-dental-health",
        "57": "double-degree",
        "58": "dual-degree",
        "59": "joint-degree",
    }.get(category, "unknown")


def stable_entry_code(url: str) -> str:
    article_id = re.search(r"(?:[?&])id=(\d+)", url)
    if article_id:
        return f"USM-PG-ARTICLE-{article_id.group(1)}"
    slug = urlparse(url).path.rstrip("/").split("/")[-1]
    return f"USM-PG-SLUG-{slug.upper()}"


def normalized_fee_name(value: str) -> str:
    normalized = value.lower().replace("–", "-").replace("&", " and ")
    normalized = re.sub(r"^msc\b", "master of science", normalized)
    normalized = re.sub(r"^ma\s*\(", "master of arts (", normalized)
    normalized = re.sub(r"^ma\b", "master of arts", normalized)
    normalized = normalized.replace("masters in", "master in")
    normalized = normalized.replace("geomatic for", "geomatics for")
    normalized = normalized.replace("economics management", "economic management")
    normalized = re.sub(r"\bby (coursework|mixed mode|research mode)\b", "", normalized)
    normalized = re.sub(r"\((coursework|mixed|mixed mode|research)\)", "", normalized)
    normalized = re.sub(
        r"\s+-\s+(school|centre|institute|advanced|usm@kl|\(hbp\)|\(com\)|\(cyb\)).*$",
        "",
        normalized,
    )
    normalized = re.sub(r"\s+-\s+(coursework|mixed mode|research)$", "", normalized)
    return re.sub(r"[^a-z0-9]+", " ", normalized).strip()


def parse_directory(markdown: str) -> dict:
    school = ""
    occurrences: list[dict] = []
    for match in DIRECTORY_EVENT_PATTERN.finditer(markdown):
        if match.group(1):
            school = clean(match.group(1))
            continue
        title = clean(match.group(2))
        url = match.group(3)
        occurrences.append(
            {
                "title": title,
                "url": url,
                "school": school,
                "level": classify_level(title),
                "studyModeFromTitle": infer_study_mode(title),
                "deliveryFromTitle": infer_delivery(title, url),
                "cluster": infer_cluster(url),
            }
        )

    masters = [item for item in occurrences if item["level"] == "master"]
    doctors = [item for item in occurrences if item["level"] == "phd"]
    by_url: dict[str, dict] = {}
    for item in masters:
        existing = by_url.get(item["url"])
        if existing:
            existing["directoryOccurrences"] += 1
            continue
        by_url[item["url"]] = {
            "code": stable_entry_code(item["url"]),
            "nameEnOfficial": item["title"],
            "level": "master",
            "universityCode": "USM",
            "facultyEn": item["school"],
            "campus": "official-detail-review-required",
            "studyMode": item["studyModeFromTitle"],
            "delivery": item["deliveryFromTitle"],
            "cluster": item["cluster"],
            "applicantScope": "international",
            "internationalEligibility": "official-detail-review-required",
            "academicSession": None,
            "officialSourceUrl": item["url"],
            "directoryOccurrences": 1,
            "identityStatus": "official-directory-entry-pending-canonical-review",
        }

    return {
        "allDirectoryOccurrences": len(occurrences),
        "masterOccurrences": len(masters),
        "uniqueMasterDetailPages": len(by_url),
        "doctorOccurrences": len(doctors),
        "duplicateMasterOccurrences": len(masters) - len(by_url),
        "records": list(by_url.values()),
    }


def parse_offshore_offerings(markdown: str) -> list[dict]:
    marker = "*   ### MALAYSIA"
    if marker not in markdown:
        return []
    section = markdown.split(marker, 1)[1].split("\n# Postgraduate", 1)[0]
    country = "MALAYSIA"
    school = ""
    offerings: list[dict] = []
    for raw_line in section.splitlines():
        line = clean(raw_line)
        country_match = re.search(r"###\s+([A-Z]+)", line)
        if country_match:
            country = country_match.group(1)
            continue
        school_match = re.search(r"(?:\*\*)?USM:\s*([^*]+?)(?:\*\*)?$", line)
        if school_match:
            school = clean(school_match.group(1))
            continue
        programme_match = re.search(r"Programme:\s*([A-Z0-9]+)\s*-\s*(.+)$", line)
        if not programme_match:
            continue
        code = programme_match.group(1)
        title = clean(programme_match.group(2))
        offerings.append(
            {
                "code": code,
                "nameEnOfficial": title,
                "level": classify_level(title),
                "schoolEn": school,
                "country": country.title(),
                "delivery": "offshore",
                "officialSourceUrl": DIRECTORY_URL,
                "identityStatus": "official-offshore-offering-pending-base-programme-link",
            }
        )
    return offerings


def parse_general_requirements(markdown: str) -> dict:
    master_marker = "****MASTER****"
    doctorate_marker = "****PhD / DOCTORATE****"
    english_marker = "[English Requirements]"
    fast_track_marker = "[Fast-Track To PhD]"
    academic = markdown.split(master_marker, 1)[1].split(doctorate_marker, 1)[0].strip()
    language = markdown.split(english_marker, 1)[1].split(fast_track_marker, 1)[0].strip()
    return {
        "officialAcademicRequirement": evidence_excerpt(academic, limit=2600),
        "officialLanguageRequirement": evidence_excerpt(language, limit=2200),
        "englishMinimums": {
            "IELTS": 5.0,
            "TOEFL_iBT": 40,
            "TOEFL_Essentials": 7.5,
            "Cambridge_or_Linguaskill": 154,
            "PTE": 47,
            "CIEP_ELS": 107,
            "MUET": 3.5,
        },
        "officialSourceUrl": GENERAL_REQUIREMENT_URL,
        "scopeNote": "Programme-specific requirements take precedence where published.",
    }


def registration_requirements(
    ips_html: Path | None,
    research_mode_html: Path | None,
) -> dict:
    if not ips_html:
        return {
            "status": "source-not-archived",
            "officialSourceUrl": IPS_ADMISSION_URL,
        }
    return {
        "status": "verified",
        "officialSourceUrl": IPS_ADMISSION_URL,
        "sourceSha256": sha256_path(ips_html),
        "currentRegistrationCycles": {
            "clinical": "June 2026 intake",
            "courseworkMixedOnline": "September 2026 intake",
            "research": "Mode-specific rolling/current registration guidance",
        },
        "postOfferRegistrationDocuments": [
            "Student Pledge Form",
            "Medical Report Form",
            "Health Declaration Form (international students; scope varies by mode)",
            "Confirmation of Registration Form appropriate to programme mode and level",
        ],
        "visaRequirement": (
            "International on-campus students require Student Pass/Visa approval. "
            "USM states that visa approval should be initiated three months before the "
            "semester for coursework/mixed programmes or three months before intended "
            "registration for research programmes. Online and overseas offshore programmes "
            "are exempt from the Student Pass requirement."
        ),
        "applicationDocumentsStatus": (
            "The current public IPS page lists post-offer registration documents, not a "
            "complete pre-admission application-document checklist."
        ),
        "researchSemesterSystem": {
            "semesterI": "September-February",
            "semesterII": "March-August",
            "registrationDate": "Determined by the student's registration date",
            "officialSourceUrl": IPS_RESEARCH_MODE_URL,
            **(
                {"sourceSha256": sha256_path(research_mode_html)}
                if research_mode_html
                else {}
            ),
        },
    }


def numeric_values(line: str) -> list[float]:
    normalized = line.replace("1.190.00", "1,190.00")
    return [float(value.replace(",", "")) for value in re.findall(r"\d[\d,]*\.\d{2}", normalized)]


def parse_scalar(value: str) -> float | None:
    values = numeric_values(value)
    return values[0] if values else None


def slice_between(lines: list[str], start: str, end: str, start_at: int = 0) -> tuple[list[str], int]:
    start_index = next(index for index in range(start_at, len(lines)) if lines[index] == start)
    end_index = next(index for index in range(start_index + 1, len(lines)) if lines[index] == end)
    return lines[start_index + 1 : end_index], end_index


def parse_named_fee_table(
    names: list[str],
    malaysian_values: list[str],
    international_values: list[str],
    mode: str,
) -> list[dict]:
    if not (len(names) == len(malaysian_values) == len(international_values)):
        raise ValueError(
            f"{mode} fee table mismatch: names={len(names)}, "
            f"myr={len(malaysian_values)}, usd={len(international_values)}"
        )
    rows = []
    for name, myr, usd in zip(names, malaysian_values, international_values):
        rows.append(
            {
                "nameEnOfficial": name.rstrip("*").strip(),
                "level": classify_level(name),
                "studyMode": mode,
                "malaysian": {
                    "currency": "MYR",
                    "amount": parse_scalar(myr),
                    "raw": myr,
                    "basis": "total-programme",
                },
                "international": {
                    "currency": "USD",
                    "amount": parse_scalar(usd),
                    "raw": usd,
                    "basis": "total-programme",
                },
                "academicSession": "2025/2026",
                "officialFeeSourceUrl": FEE_PAGE_URL,
                "officialFeePdfUrl": FEE_URL,
                "sourcePage": 2,
            }
        )
    return rows


def parse_fee_pdf(path: Path) -> dict:
    page = PdfReader(str(path)).pages[1]
    lines = [clean(line) for line in (page.extract_text() or "").splitlines() if clean(line)]

    research_start = lines.index("Advanced Medical and Dental Institute")
    research_end = lines.index("International (USD)", research_start)
    research_names = lines[research_start:research_end]
    research_intl_header = lines.index("Full Time/sem P.Time/sem", research_end)
    research_myr_marker = lines.index("Malaysian (MYR)", research_intl_header)
    research_intl_values = lines[research_intl_header + 1 : research_myr_marker]
    research_myr_header = lines.index("Full Time/sem P.Time/sem", research_myr_marker)
    research_table_end = lines.index("Research Mode Programmes (PhD / MSc / MA)", research_myr_header)
    research_myr_values = lines[research_myr_header + 1 : research_table_end]
    if not (
        len(research_names) == len(research_intl_values) == len(research_myr_values) == 47
    ):
        raise ValueError(
            "Research fee table mismatch: "
            f"names={len(research_names)}, myr={len(research_myr_values)}, "
            f"usd={len(research_intl_values)}"
        )
    research_rows = []
    for name, myr, usd in zip(research_names, research_myr_values, research_intl_values):
        myr_values = numeric_values(myr)
        usd_values = numeric_values(usd)
        research_rows.append(
            {
                "academicUnit": name,
                "studyMode": "research",
                "malaysian": {
                    "currency": "MYR",
                    "fullTimePerSemester": myr_values[0],
                    "partTimePerSemester": myr_values[1],
                },
                "international": {
                    "currency": "USD",
                    "fullTimePerSemester": usd_values[0],
                    "partTimePerSemester": usd_values[1],
                },
                "academicSession": "2025/2026",
                "officialFeeSourceUrl": FEE_PAGE_URL,
                "officialFeePdfUrl": FEE_URL,
                "sourcePage": 2,
            }
        )

    mixed_names = lines[
        research_table_end + 1 : lines.index("*Malay Language as medium of instructions", research_table_end)
    ]
    mixed_label = lines.index("Mixed Mode Programmes", research_table_end)
    mixed_myr_marker = lines.index("Malaysian (MYR)", mixed_label)
    mixed_usd_marker = lines.index("International (USD)", mixed_myr_marker)
    coursework_label = lines.index("Coursework Mode Programmes", mixed_usd_marker)
    mixed_rows = parse_named_fee_table(
        mixed_names,
        lines[mixed_myr_marker + 1 : mixed_usd_marker],
        lines[mixed_usd_marker + 1 : coursework_label],
        "mixed",
    )

    coursework_myr_marker = lines.index("Malaysian (MYR)", coursework_label)
    coursework_names = lines[coursework_label + 1 : coursework_myr_marker]
    coursework_usd_marker = lines.index("International (USD)", coursework_myr_marker)
    clinical_first = next(
        index
        for index in range(coursework_usd_marker + 1, len(lines))
        if lines[index].startswith("Master of Medicine (")
    )
    coursework_rows = parse_named_fee_table(
        coursework_names,
        lines[coursework_myr_marker + 1 : coursework_usd_marker],
        lines[coursework_usd_marker + 1 : clinical_first],
        "coursework",
    )

    clinical_label = lines.index("Clinical Programmes", clinical_first)
    clinical_names = lines[clinical_first:clinical_label]
    clinical_myr_marker = lines.index("Malaysian (MYR)", clinical_label)
    clinical_usd_marker = lines.index("International (USD)", clinical_myr_marker)
    clinical_rows = parse_named_fee_table(
        clinical_names,
        lines[clinical_myr_marker + 1 : clinical_usd_marker],
        lines[clinical_usd_marker + 1 :],
        "clinical",
    )

    return {
        "academicSession": "2025/2026",
        "updatedOn": "2025-03-11",
        "disclaimer": [
            "Fees are subject to change.",
            "Final fees should be confirmed before any commitment is made.",
            "USM Bursary amount prevails if discrepancies exist.",
        ],
        "oneOffFees": {
            "registration": {
                "default": {"MYR": 330.0, "USD": 225.0},
                "Master of Public Administration": {"MYR": 510.0, "USD": 275.0},
                "Master of Economic Management": {"MYR": 510.0, "USD": 275.0},
                "Master of Business Administration (Online)": {"MYR": 120.0, "USD": 210.0},
            },
            "personalBond": {"MYR": None, "USD": 1000.0},
            "researchMethodology": {"MYR": 320.0, "USD": 80.0},
            "malayLanguageLKM111": {
                "MYR": None,
                "USDNew": 0.0,
                "USDRepeat": 80.0,
            },
            "thesisEvaluation": {"MYR": 800.0, "USD": 250.0},
            "graduation": {"MYR": 200.0, "USD": 50.0},
        },
        "researchAcademicUnitFees": research_rows,
        "namedProgrammeFees": mixed_rows + coursework_rows + clinical_rows,
        "masterNamedProgrammeFees": [
            row
            for row in mixed_rows + coursework_rows + clinical_rows
            if row["level"] == "master"
        ],
    }


def reader_url(official_url: str) -> str:
    return READER_PREFIX + quote(official_url, safe=":/?=")


def fetch_text(url: str, timeout: int = 90) -> str:
    request = Request(
        url,
        headers={
            "Accept": "text/plain,text/markdown;q=0.9,*/*;q=0.1",
            "User-Agent": "StudyMY-Official-Collector/1.0",
        },
    )
    with urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def extract_sections(markdown: str) -> dict[str, str]:
    matches = list(SECTION_PATTERN.finditer(markdown))
    sections: dict[str, str] = {}
    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(markdown)
        key = match.group(1).lower().replace(" ", "_")
        sections[key] = markdown[start:end].strip()
    return sections


def source_title(markdown: str) -> str:
    match = re.search(r"(?m)^Title:\s*(.+)$", markdown)
    return clean(match.group(1)) if match else ""


def source_url(markdown: str) -> str:
    match = re.search(r"(?m)^URL Source:\s*(.+)$", markdown)
    return clean(match.group(1)) if match else ""


def evidence_excerpt(value: str, limit: int = 1200) -> str:
    collapsed = clean(re.sub(r"[*_#`]+", " ", value))
    return collapsed[:limit]


def fetch_detail(
    record: dict,
    cache_dir: Path,
    retrieved_at: str,
    refresh: bool,
    request_delay: float,
) -> dict:
    cache_path = cache_dir / f"{record['code'].lower()}.md"
    error = ""
    markdown = ""
    if cache_path.exists() and not refresh:
        markdown = cache_path.read_text(encoding="utf-8")
    else:
        for attempt in range(3):
            try:
                if request_delay:
                    time.sleep(request_delay)
                markdown = fetch_text(reader_url(record["officialSourceUrl"]))
                break
            except HTTPError as exc:
                error = f"HTTPError: {exc.code} {exc.reason}"
                time.sleep(45 if exc.code == 429 else 2**attempt)
            except Exception as exc:  # noqa: BLE001 - preserve source failure in the audit
                error = f"{type(exc).__name__}: {exc}"
                time.sleep(2**attempt)
        if markdown:
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            cache_path.write_text(markdown, encoding="utf-8")

    if not markdown:
        return {
            "code": record["code"],
            "officialSourceUrl": record["officialSourceUrl"],
            "status": "blocked",
            "error": error or "empty response",
            "retrievedAt": retrieved_at,
        }

    sections = extract_sections(markdown)
    required = {
        "admission_requirements": "officialAcademicRequirement",
        "language_requirements": "officialLanguageRequirement",
        "duration": "durationOfficial",
        "semester_intake": "officialIntake",
        "fees": "officialFeeText",
    }
    missing = [field for section, field in required.items() if not sections.get(section)]
    fee_text = sections.get("fees", "")
    return {
        "code": record["code"],
        "officialSourceUrl": record["officialSourceUrl"],
        "transport": "public-reader-proxy",
        "transportUrl": reader_url(record["officialSourceUrl"]),
        "status": "verified" if not missing else "review-required",
        "retrievedAt": retrieved_at,
        "sha256": sha256_bytes(markdown.encode("utf-8")),
        "pageTitle": source_title(markdown),
        "reportedSourceUrl": source_url(markdown),
        "overviewExcerpt": evidence_excerpt(sections.get("overview", "")),
        "officialAcademicRequirement": evidence_excerpt(
            sections.get("admission_requirements", "")
        ),
        "officialLanguageRequirement": evidence_excerpt(
            sections.get("language_requirements", "")
        ),
        "durationOfficial": evidence_excerpt(sections.get("duration", "")),
        "officialIntake": evidence_excerpt(sections.get("semester_intake", "")),
        "officialFeeText": evidence_excerpt(fee_text, limit=2200),
        "hasExplicit2025FeeUpdate": "2025/2026" in fee_text
        or "October 2025" in fee_text,
        "missingOfficialFields": missing,
        "careersStatus": "official-unpublished-unless-present-in-overview",
        "applicationDocumentsStatus": "not-published-on-programme-detail",
    }


def fetch_details(
    records: list[dict],
    cache_dir: Path,
    retrieved_at: str,
    workers: int,
    refresh: bool,
    request_delay: float,
) -> list[dict]:
    results: list[dict] = []
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(
                fetch_detail,
                record,
                cache_dir,
                retrieved_at,
                refresh,
                request_delay,
            ): record
            for record in records
        }
        for future in as_completed(futures):
            results.append(future.result())
    return sorted(results, key=lambda item: item["code"])


def reconcile_exact_fee_matches(
    records: list[dict],
    fee_data: dict,
    cache_dir: Path,
) -> dict:
    records_by_name: dict[str, list[dict]] = {}
    for record in records:
        records_by_name.setdefault(
            normalized_fee_name(record["nameEnOfficial"]),
            [],
        ).append(record)

    matches: list[dict] = []
    unresolved: list[dict] = []
    for fee_row in fee_data["masterNamedProgrammeFees"]:
        candidates = records_by_name.get(normalized_fee_name(fee_row["nameEnOfficial"]), [])
        if len(candidates) != 1:
            unresolved.append(
                {
                    "feeName": fee_row["nameEnOfficial"],
                    "studyMode": fee_row["studyMode"],
                    "candidateCodes": [candidate["code"] for candidate in candidates],
                    "reason": "no-unique-exact-normalized-title-match",
                }
            )
            continue
        record = candidates[0]
        raw_path = cache_dir / f"{record['code'].lower()}.md"
        raw = raw_path.read_text(encoding="utf-8") if raw_path.exists() else ""
        amount = fee_row["international"]["amount"]
        amount_variants = (
            {
                f"{amount:,.2f}",
                f"{amount:.2f}",
                f"{amount:,.0f}",
                f"{amount:.0f}",
            }
            if amount is not None
            else set()
        )
        detail_has_fee = "### FEES" in raw or "Tuition Fee" in raw or "Tuition Fees" in raw
        amount_found = amount is not None and any(value in raw for value in amount_variants)
        if amount is None:
            status = "official-fee-page-refers-to-programme-website"
        elif amount_found:
            status = "corroborated"
        elif not detail_has_fee:
            status = "detail-fee-unpublished"
        else:
            status = "official-source-conflict-candidate"
        matches.append(
            {
                "feeName": fee_row["nameEnOfficial"],
                "recordCode": record["code"],
                "recordName": record["nameEnOfficial"],
                "studyMode": fee_row["studyMode"],
                "internationalAmountUSD": amount,
                "status": status,
                "detailHasExplicit2025FeeUpdate": "2025/2026" in raw
                or "October 2025" in raw,
                "feePageSourceUrl": FEE_PAGE_URL,
                "detailSourceUrl": record["officialSourceUrl"],
            }
        )

    status_counts: dict[str, int] = {}
    for match in matches:
        status_counts[match["status"]] = status_counts.get(match["status"], 0) + 1
    return {
        "method": "unique exact normalized title match only; unresolved rows require manual identity review",
        "matches": matches,
        "unresolvedFeeRows": unresolved,
        "statusCounts": status_counts,
    }


def build_audit(
    directory: dict,
    offshore: list[dict],
    fee_data: dict,
    details: list[dict],
    fee_reconciliation: dict,
) -> dict:
    detail_statuses: dict[str, int] = {}
    missing_fields: dict[str, int] = {}
    for detail in details:
        detail_statuses[detail["status"]] = detail_statuses.get(detail["status"], 0) + 1
        for field in detail.get("missingOfficialFields", []):
            missing_fields[field] = missing_fields.get(field, 0) + 1

    stale_fee_pages = [
        detail["code"]
        for detail in details
        if detail.get("officialFeeText") and not detail.get("hasExplicit2025FeeUpdate")
    ]
    blocking_reasons = []
    if directory["uniqueMasterDetailPages"] != 274:
        blocking_reasons.append(
            f"Expected 274 unique master detail pages, got {directory['uniqueMasterDetailPages']}."
        )
    if len(details) != directory["uniqueMasterDetailPages"]:
        blocking_reasons.append(
            f"Detail count mismatch: directory={directory['uniqueMasterDetailPages']}, "
            f"details={len(details)}."
        )
    if detail_statuses.get("blocked"):
        blocking_reasons.append(f"{detail_statuses['blocked']} detail pages could not be collected.")
    if missing_fields:
        blocking_reasons.append("Required programme detail fields remain missing.")
    if stale_fee_pages:
        blocking_reasons.append(
            f"{len(stale_fee_pages)} detail pages do not explicitly identify the 2025/2026 fee update."
        )
    conflict_candidates = fee_reconciliation["statusCounts"].get(
        "official-source-conflict-candidate",
        0,
    )
    if conflict_candidates:
        blocking_reasons.append(
            f"{conflict_candidates} exact-title fee matches contain conflicting official amounts."
        )
    blocking_reasons.extend(
        [
            "Directory entries still require canonical programme versus specialization review.",
            "Named fee rows and research academic-unit fees are not yet fully reconciled to all directory entries.",
            "Application document requirements require a separate current official application source.",
            "Four-language commercial localization has not been produced or reviewed.",
        ]
    )
    return {
        "directory": {
            key: value for key, value in directory.items() if key != "records"
        },
        "offshoreOfferingCount": len(offshore),
        "offshoreMasterOfferingCount": sum(item["level"] == "master" for item in offshore),
        "feeSchedule": {
            "researchAcademicUnitRows": len(fee_data["researchAcademicUnitFees"]),
            "namedProgrammeRows": len(fee_data["namedProgrammeFees"]),
            "masterNamedProgrammeRows": len(fee_data["masterNamedProgrammeFees"]),
        },
        "detailStatuses": detail_statuses,
        "missingOfficialFields": missing_fields,
        "detailPagesWithoutExplicit2025FeeUpdate": stale_fee_pages,
        "feeReconciliation": {
            "statusCounts": fee_reconciliation["statusCounts"],
            "unresolvedFeeRows": len(fee_reconciliation["unresolvedFeeRows"]),
        },
        "publicationDecision": "blocked" if blocking_reasons else "ready",
        "blockingReasons": blocking_reasons,
    }


def build_manifest(args: argparse.Namespace) -> dict:
    retrieved_at = args.retrieved_at or utc_now()
    directory_markdown = args.directory_markdown.read_text(encoding="utf-8")
    directory = parse_directory(directory_markdown)
    general_requirements = parse_general_requirements(directory_markdown)
    offshore = parse_offshore_offerings(directory_markdown)
    fee_data = parse_fee_pdf(args.fee_pdf)
    details = (
        fetch_details(
            directory["records"],
            args.detail_cache,
            retrieved_at,
            args.workers,
            args.refresh,
            args.request_delay,
        )
        if args.fetch_details
        else []
    )
    fee_reconciliation = reconcile_exact_fee_matches(
        directory["records"],
        fee_data,
        args.detail_cache,
    )
    audit = build_audit(directory, offshore, fee_data, details, fee_reconciliation)
    return {
        "universityCode": "USM",
        "officialDomains": ["usm.my", "admission.usm.my", "ips.usm.my"],
        "level": "master",
        "applicantScope": "international",
        "academicSession": "2025/2026",
        "retrievedAt": retrieved_at,
        "declaredProgrammeCount": None,
        "directoryEntryCount": directory["uniqueMasterDetailPages"],
        "publicationDecision": audit["publicationDecision"],
        "sources": [
            {
                "id": "usm-pg-directory-current",
                "title": "USM Postgraduate Programme Directory",
                "url": DIRECTORY_URL,
                "sourceType": "official-page",
                "role": "canonical",
                "retrievedAt": retrieved_at,
                "academicSession": None,
                "status": "verified",
                "sha256": sha256_path(args.directory_markdown),
                "localPath": str(args.directory_markdown),
                "transport": "public-reader-proxy because direct requests are blocked by USM WAF",
            },
            {
                "id": "usm-pg-fee-page-current",
                "title": "USM Postgraduate Fees",
                "url": FEE_PAGE_URL,
                "sourceType": "official-page",
                "role": "field-authority",
                "retrievedAt": retrieved_at,
                "academicSession": "2025/2026",
                "status": "verified",
                **(
                    {
                        "sha256": sha256_path(args.fee_page_markdown),
                        "localPath": str(args.fee_page_markdown),
                    }
                    if args.fee_page_markdown
                    else {}
                ),
            },
            {
                "id": "usm-pg-fees-2025-2026",
                "title": "USM Postgraduate Fees 2025/2026",
                "url": FEE_URL,
                "sourceType": "official-pdf",
                "role": "cross-check",
                "retrievedAt": retrieved_at,
                "academicSession": "2025/2026",
                "status": "verified",
                "sha256": sha256_path(args.fee_pdf),
                "localPath": str(args.fee_pdf),
                "sourcePage": 2,
            },
            {
                "id": "usm-pg-general-requirements",
                "title": "USM General Entry Requirements",
                "url": GENERAL_REQUIREMENT_URL,
                "sourceType": "official-page",
                "role": "field-authority",
                "retrievedAt": retrieved_at,
                "academicSession": None,
                "status": "verified",
                "sha256": sha256_path(args.directory_markdown),
                "localPath": str(args.directory_markdown),
                "evidenceNote": "The same general requirement text is embedded in the canonical directory snapshot.",
            },
            {
                "id": "usm-ips-admission-downloads",
                "title": "USM IPS Admission and Registration Downloads",
                "url": IPS_ADMISSION_URL,
                "sourceType": "official-page",
                "role": "cross-check",
                "retrievedAt": retrieved_at,
                "academicSession": "2026/2027",
                "status": "verified",
                **(
                    {
                        "sha256": sha256_path(args.ips_admission_html),
                        "localPath": str(args.ips_admission_html),
                    }
                    if args.ips_admission_html
                    else {}
                ),
            },
            {
                "id": "usm-ips-research-mode-registration",
                "title": "USM IPS Research Mode Programme",
                "url": IPS_RESEARCH_MODE_URL,
                "sourceType": "official-page",
                "role": "cross-check",
                "retrievedAt": retrieved_at,
                "academicSession": None,
                "status": "verified",
                **(
                    {
                        "sha256": sha256_path(args.research_mode_html),
                        "localPath": str(args.research_mode_html),
                    }
                    if args.research_mode_html
                    else {}
                ),
            },
        ],
        "records": directory["records"],
        "generalRequirements": general_requirements,
        "registrationRequirements": registration_requirements(
            args.ips_admission_html,
            args.research_mode_html,
        ),
        "offshoreOfferings": offshore,
        "feeSchedule": fee_data,
        "feeReconciliation": fee_reconciliation,
        "details": details,
        "audit": audit,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory-markdown", required=True, type=Path)
    parser.add_argument("--fee-pdf", required=True, type=Path)
    parser.add_argument("--fee-page-markdown", type=Path)
    parser.add_argument("--ips-admission-html", type=Path)
    parser.add_argument("--research-mode-html", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--detail-cache", type=Path, default=Path("tmp/usm-master-details"))
    parser.add_argument("--retrieved-at")
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--request-delay", type=float, default=0.0)
    parser.add_argument("--fetch-details", action="store_true")
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()

    manifest = build_manifest(args)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "output": str(args.output),
                "directoryEntryCount": manifest["directoryEntryCount"],
                "detailCount": len(manifest["details"]),
                "offshoreOfferingCount": len(manifest["offshoreOfferings"]),
                "masterNamedFeeRows": len(
                    manifest["feeSchedule"]["masterNamedProgrammeFees"]
                ),
                "publicationDecision": manifest["publicationDecision"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
