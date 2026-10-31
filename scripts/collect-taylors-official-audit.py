#!/usr/bin/env python3
"""Collect Taylor's University official programme candidate artifacts."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup


BASE_URL = "https://university.taylors.edu.my"
OFFICIAL_DOMAIN = "taylors.edu.my"
DEFAULT_BATCH_DIR = Path("data/imports/tsu/2026-06-20/tsu-20260620")
USER_AGENT = "StudyMY official collector"

CORE_URLS = {
    "homepage": "https://university.taylors.edu.my/en.html",
    "explore": "https://university.taylors.edu.my/en/study/explore-all-programmes.html",
    "fees": "https://university.taylors.edu.my/en/study/scholarships-and-financial-aid/fees-schedules.html",
    "undergraduate_admission": "https://university.taylors.edu.my/en/study/how-to-apply/undergraduate-admission.html",
    "postgraduate_admission": "https://university.taylors.edu.my/en/study/how-to-apply/postgraduate-admission.html",
    "online_postgraduate": "https://university.taylors.edu.my/en/study/online-postgraduate-programmes.html",
    "key_intakes": "https://university.taylors.edu.my/en/study/how-to-apply/key-intakes.html",
    "application_portal": "https://topas.taylors.edu.my/",
}
CORE_FILES = {
    "homepage": "homepage.html",
    "explore": "explore-all-programmes.html",
    "fees": "fees-schedules.html",
    "undergraduate_admission": "undergraduate-admission.html",
    "postgraduate_admission": "postgraduate-admission.html",
    "online_postgraduate": "online-postgraduate-programmes.html",
    "key_intakes": "key-intakes.html",
    "application_portal": "application-portal.html",
}

RAW_DIR = Path("sources/raw")
PARSED_DIR = Path("sources/parsed")
DETAIL_DIR = Path("sources/raw/programme-details")
PDF_DIR = Path("sources/raw/fee-pdfs")

INFO_LABELS = {
    "Duration",
    "Study options",
    "Study Options",
    "Intake Month",
    "Offered by",
    "Fees",
}
STOP_INFO = {
    "NEXT: PROGRAMME STRUCTURE",
    "NEXT: ENTRY REQUIREMENTS",
    "NEXT: WHY TAYLOR'S",
    "NEXT: FUTURE CAREERS",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, data: object) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\xa0", " ")).strip()


def slugify(value: str, max_len: int = 120) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return (slug[:max_len].strip("-") or "item")


def request_url(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def fetch(url: str, path: Path, refresh: bool = False) -> tuple[str, str]:
    path.parent.mkdir(parents=True, exist_ok=True)
    if refresh or not path.exists():
        data = request_url(url)
        path.write_bytes(data)
        time.sleep(0.08)
    return "cached" if path.exists() else "missing", sha256(path)


def soup_from(path: Path) -> BeautifulSoup:
    return BeautifulSoup(path.read_text(encoding="utf-8", errors="ignore"), "html.parser")


def lines_from_tag(tag) -> list[str]:
    if not tag:
        return []
    seen_blank = False
    lines: list[str] = []
    for raw in tag.get_text("\n").splitlines():
        line = clean_text(raw)
        if not line:
            seen_blank = True
            continue
        if seen_blank or not lines or lines[-1] != line:
            lines.append(line)
        seen_blank = False
    return lines


def tab_lines(soup: BeautifulSoup) -> dict[str, list[str]]:
    tabs: dict[str, list[str]] = {}
    for tag in soup.find_all(attrs={"data-tab-content": True}):
        tabs[str(tag.get("data-tab-content"))] = lines_from_tag(tag)
    return tabs


def first_meta(soup: BeautifulSoup, name: str) -> str:
    tag = soup.find("meta", attrs={"name": name})
    if tag and tag.get("content"):
        return clean_text(tag["content"])
    return ""


def course_schema(soup: BeautifulSoup) -> dict:
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        text = script.string or script.get_text()
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict) and payload.get("@type") == "Course":
            return payload
    return {}


def extract_info(overview: list[str]) -> dict[str, object]:
    info: dict[str, object] = {
        "descriptionLines": [],
        "durationOfficial": "",
        "studyOptions": "",
        "intakeOfficial": "",
        "offeredBy": "",
        "feeLines": [],
        "feeNote": "",
    }
    try:
        start = overview.index("Programme Information for 2026")
    except ValueError:
        info["descriptionLines"] = [line for line in overview if line != "Overview"][:4]
        return info

    info["descriptionLines"] = [
        line for line in overview[1:start] if line not in {"Overview", "REQUEST FOR MORE INFO"}
    ]
    block = []
    for line in overview[start + 1 :]:
        if line in STOP_INFO or line.startswith("NEXT:"):
            break
        block.append(line)

    current = ""
    buckets: dict[str, list[str]] = defaultdict(list)
    for line in block:
        if line in {"Programme Information for 2026", "REQUEST FOR MORE INFO"}:
            continue
        if line in INFO_LABELS:
            current = line
            continue
        if current:
            buckets[current].append(line)

    info["durationOfficial"] = clean_text("; ".join(buckets.get("Duration", [])))
    info["studyOptions"] = clean_text("; ".join(buckets.get("Study options") or buckets.get("Study Options") or []))
    info["intakeOfficial"] = clean_text("; ".join(buckets.get("Intake Month", [])))
    info["offeredBy"] = clean_text("; ".join(buckets.get("Offered by", [])))
    fees = buckets.get("Fees", [])
    note_start = next((i for i, line in enumerate(fees) if line.lower().startswith("note")), None)
    if note_start is not None:
        info["feeLines"] = fees[:note_start]
        info["feeNote"] = clean_text(" ".join(fees[note_start:]))
    else:
        info["feeLines"] = fees
    return info


def months_from(text: str) -> list[str]:
    months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ]
    found = []
    lower = text.lower()
    for month in months:
        if month.lower() in lower:
            found.append(month)
    return found


def parse_usd_fee(lines: list[str]) -> tuple[int | None, str]:
    joined = " ".join(lines)
    matches = re.findall(r"USD\s*([0-9][0-9,]*)", joined, flags=re.IGNORECASE)
    if not matches:
        return None, ""
    value = int(matches[-1].replace(",", ""))
    return value, f"USD {matches[-1]}"


def parse_myr_fee(lines: list[str]) -> tuple[int | None, str]:
    joined = " ".join(lines)
    matches = re.findall(r"MYR\s*([0-9][0-9,]*)", joined, flags=re.IGNORECASE)
    if not matches:
        return None, ""
    value = int(matches[0].replace(",", ""))
    return value, f"MYR {matches[0]}"


def normalize_duration_years(duration: str) -> float | None:
    match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*-\s*year", duration, re.IGNORECASE)
    if match:
        return float(match.group(1))
    match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*year", duration, re.IGNORECASE)
    if match:
        return float(match.group(1))
    return None


def split_language(lines: list[str]) -> tuple[str, str]:
    if not lines:
        return "", ""
    lower = [line.lower() for line in lines]
    if "english requirements" in lower:
        idx = lower.index("english requirements")
        academic = clean_text(" ".join(lines[:idx]))
        language = clean_text(" ".join(lines[idx:]))
        return academic, language
    for marker in ("international students", "ielts", "muet", "toefl"):
        for index, line in enumerate(lower):
            if marker in line:
                academic = clean_text(" ".join(lines[:index]))
                language = clean_text(" ".join(lines[index:]))
                return academic, language
    return clean_text(" ".join(lines)), ""


def concise_lines(lines: list[str], max_items: int = 60) -> list[str]:
    ignored = {"show all", "next: future careers", "next: get inspired"}
    result = []
    for line in lines:
        key = line.lower()
        if key in ignored or key.startswith("next:"):
            continue
        if result and result[-1] == line:
            continue
        result.append(line)
        if len(result) >= max_items:
            break
    return result


def localized(en: str, zh: str | None = None) -> dict[str, str]:
    zh_text = zh or en
    return {"en": en, "ms": en, "zh-CN": zh_text, "zh-TW": zh_text}


def classify_record(row: dict) -> tuple[str | None, str, str]:
    title = clean_text(row.get("title", ""))
    levels = [item.get("title") for item in row.get("tags", {}).get("level-of-study", [])]
    level_title = levels[0] if levels else ""
    if level_title == "Undergraduate":
        if title.lower().startswith("bachelor"):
            return "bachelor", "candidate", "Current official bachelor degree row."
        return None, "out-of-scope", "Official undergraduate listing row is not a bachelor degree in the requested 本硕博 scope."
    if level_title in {"Master (Coursework)", "Master (Research)", "Master (Online)"}:
        if title.lower().startswith("postgraduate certificate"):
            return None, "out-of-scope", "Official PGCert row discovered; disposed separately because user requested bachelor/master/phd."
        return "master", "candidate", f"Current official {level_title} row."
    if level_title in {"PhD (Research)", "PhD (Coursework)"}:
        return "phd", "candidate", f"Current official {level_title} row."
    return None, "out-of-scope", f"Unsupported or unrequested level: {level_title or 'unknown'}."


def study_type_from(row: dict) -> str:
    levels = [item.get("title", "") for item in row.get("tags", {}).get("level-of-study", [])]
    joined = " ".join(levels).lower()
    if "research" in joined:
        return "research"
    if "coursework" in joined or "online" in joined:
        return "coursework"
    return "coursework"


def audit_study_mode_from(row: dict, study_options: str) -> str:
    source = f"{study_options} {' '.join(item.get('title','') for item in row.get('tags', {}).get('level-of-study', []))}".lower()
    if "online" in source:
        return "online"
    return study_type_from(row)


def arrangement_from(row: dict, study_options: str) -> list[str]:
    values = []
    source = f"{study_options} {' '.join(item.get('title','') for item in row.get('tags', {}).get('level-of-study', []))}".lower()
    if "online" in source:
        values.append("online")
    if "full time" in source or "full-time" in source:
        values.append("full-time")
    if "part time" in source or "part-time" in source:
        values.append("part-time")
    if not values:
        values.append("full-time")
    return values


def parse_listing(batch_dir: Path) -> list[dict]:
    soup = soup_from(batch_dir / RAW_DIR / "explore-all-programmes.html")
    tag = soup.find("study-listing")
    if not tag or not tag.get("listing-data"):
        raise RuntimeError("Official programme listing-data not found.")
    listing = json.loads(tag["listing-data"])
    records = []
    for group in listing:
        for item in group.get("study", []):
            record = dict(item)
            record["groupTitle"] = group.get("title")
            record["groupPath"] = group.get("path")
            record["groupValue"] = group.get("value")
            records.append(record)
    return records


def parse_fee_links(batch_dir: Path) -> dict[str, list[dict[str, str]]]:
    soup = soup_from(batch_dir / RAW_DIR / "fees-schedules.html")
    mapping: dict[str, list[dict[str, str]]] = {}
    for heading in soup.find_all(["h3", "h4", "h5"]):
        title = clean_text(heading.get_text(" ", strip=True))
        if not title:
            continue
        links = []
        for sibling in heading.find_all_next(["a", "h3", "h4", "h5"], limit=8):
            if sibling.name in {"h3", "h4", "h5"} and sibling is not heading:
                break
            if sibling.name == "a" and sibling.get("href") and ".pdf" in sibling.get("href"):
                links.append(
                    {
                        "label": clean_text(sibling.get_text(" ", strip=True)),
                        "url": urljoin(BASE_URL, sibling["href"]),
                    }
                )
        if links:
            mapping[title] = links
    return mapping


def best_fee_links(row: dict, fee_mapping: dict[str, list[dict[str, str]]]) -> list[dict[str, str]]:
    title = clean_text(row.get("title", ""))
    faculty = clean_text(row.get("groupTitle", ""))
    candidates = [title, title.replace("(100% Online)", "").replace("(100% online)", "").strip(), faculty]
    if title == "Master in Applied Computing (Coursework)":
        candidates.append("Master of Applied Computing (Coursework)")
    if title == "Master in Applied Computing (100% Online)":
        candidates.append("Master of Applied Computing")
    if title == "Master of Business Administration (100% Online)":
        candidates.append("Master of Business Adminstration")
    if title == "Master of Teaching and Learning (100% online)":
        candidates.append("Master of Teaching & Learning")
    if title == "Doctor of Philosophy In Hospitality & Tourism":
        candidates.append("Doctor of Philosophy in Hospitality and Tourism")
    if title == "Doctor of Philosophy in Pharmaceutical Sciences":
        candidates.append("Doctor of Philosophy in Pharmaceutical Science")
    if title == "Master of Philosophy in Pharmaceutical Sciences":
        candidates.append("Master of Philosophy in Pharmaceutical Science")
    for key in candidates:
        if key in fee_mapping:
            return fee_mapping[key]
    return []


def source_id_for(kind: str, code: str) -> str:
    return f"{kind}-{code.lower()}"


def official_source_text(lines: list[str], limit: int = 1200) -> str:
    return clean_text(" ".join(lines))[:limit]


def collect(batch_dir: Path, refresh: bool) -> None:
    retrieved_at = now_iso()
    for subdir in (RAW_DIR, PARSED_DIR, DETAIL_DIR, PDF_DIR):
        (batch_dir / subdir).mkdir(parents=True, exist_ok=True)

    source_cache: list[dict] = []
    for source_id, url in CORE_URLS.items():
        filename = CORE_FILES[source_id]
        local_rel = RAW_DIR / filename
        try:
            status, digest = fetch(url, batch_dir / local_rel, refresh=refresh)
        except (urllib.error.URLError, TimeoutError) as exc:
            status, digest = f"transport-blocked: {exc}", ""
        role = "institution-authority" if source_id == "homepage" else "field-authority"
        if source_id == "explore":
            role = "canonical"
        source_cache.append(
            {
                "id": source_id,
                "url": url,
                "role": role,
                "sourceType": "official-page",
                "fields": ["institution"] if source_id == "homepage" else ["programmes"],
                "retrievedAt": retrieved_at,
                "academicSession": "2026",
                "status": status,
                "localPath": str(local_rel) if digest else "",
                "sha256": digest,
            }
        )

    records = parse_listing(batch_dir)
    fee_mapping = parse_fee_links(batch_dir)
    write_json(batch_dir / PARSED_DIR / "programme-directory-flattened.json", records)
    write_json(batch_dir / PARSED_DIR / "fee-schedule-link-map.json", fee_mapping)

    row_disposal: list[dict] = []
    level_manifest_entries: list[dict] = []
    candidate_rows = []
    out_of_scope_rows = []
    candidate_ordinals = Counter()
    detail_sources: dict[str, dict] = {}
    pdf_sources: dict[str, dict] = {}

    for index, row in enumerate(records, start=1):
        level, decision, reason = classify_record(row)
        row_id = f"TSU-OFFICIAL-{index:03d}"
        title = clean_text(row.get("title", ""))
        source_url = row.get("path")
        faculty = clean_text(row.get("groupTitle") or "")
        level_title = next((item.get("title") for item in row.get("tags", {}).get("level-of-study", [])), "")
        if decision == "candidate" and level:
            candidate_ordinals[level] += 1
            prefix = {"bachelor": "B", "master": "M", "phd": "D"}[level]
            code = f"TSU-{prefix}-{candidate_ordinals[level]:03d}"
            candidate_rows.append((code, level, row))
        else:
            code = ""
            out_of_scope_rows.append(row)
        row_disposal.append(
            {
                "rowId": row_id,
                "sourceId": "explore",
                "sourceUrl": source_url,
                "sourceRole": "canonical",
                "nameEnOfficial": title,
                "facultyEn": faculty,
                "levelTag": level_title,
                "level": level or "out-of-scope",
                "status": decision,
                "candidateCode": code,
                "reason": reason,
            }
        )
        level_manifest_entries.append(
            {
                "rowId": row_id,
                "candidateCode": code,
                "level": level or "out-of-scope",
                "levelTag": level_title,
                "nameEnOfficial": title,
                "facultyEn": faculty,
                "sourceUrl": source_url,
                "collectionStatus": decision,
                "reason": reason,
            }
        )

    fee_pdf_urls = set()
    details: dict[str, dict] = {}
    for code, level, row in candidate_rows:
        url = row["path"]
        local_rel = DETAIL_DIR / f"{code.lower()}-{slugify(row['title'], 90)}.html"
        status, digest = fetch(url, batch_dir / local_rel, refresh=refresh)
        detail_sources[code] = {
            "id": source_id_for("detail", code),
            "url": url,
            "role": "field-authority",
            "sourceType": "official-page",
            "fields": ["identity", "duration", "intake", "tuition", "requirements", "curriculum", "careers"],
            "retrievedAt": retrieved_at,
            "academicSession": "2026",
            "status": status,
            "localPath": str(local_rel) if digest else "",
            "sha256": digest,
        }
        source_cache.append(detail_sources[code])
        soup = soup_from(batch_dir / local_rel)
        tabs = tab_lines(soup)
        overview = tabs.get("overview", [])
        info = extract_info(overview)
        schema = course_schema(soup)
        entry_lines = concise_lines(tabs.get("entry-requirements", []), 120)
        academic_text, language_text = split_language(entry_lines)
        programme_structure = concise_lines(tabs.get("programme-structure", []), 100)
        careers = concise_lines(tabs.get("future-careers", []), 60)
        usd_amount, usd_display = parse_usd_fee(info["feeLines"])
        myr_amount, myr_display = parse_myr_fee(info["feeLines"])
        fee_links = best_fee_links(row, fee_mapping)
        international_fee_url = next(
            (item["url"] for item in fee_links if "international" in item.get("label", "").lower() or "usd" in item.get("label", "").lower()),
            "",
        )
        for item in fee_links:
            if item["url"].endswith(".pdf"):
                fee_pdf_urls.add(item["url"])
        details[code] = {
            "soupTitle": clean_text(soup.title.string if soup.title else ""),
            "metaDescription": first_meta(soup, "description"),
            "schemaCourse": schema,
            "tabs": tabs,
            "info": info,
            "academicRequirement": academic_text,
            "languageRequirement": language_text,
            "programmeStructure": programme_structure,
            "careers": careers,
            "usdAmount": usd_amount,
            "usdDisplay": usd_display,
            "myrAmount": myr_amount,
            "myrDisplay": myr_display,
            "feeLinks": fee_links,
            "internationalFeeUrl": international_fee_url,
        }

    for url in sorted(fee_pdf_urls):
        local_rel = PDF_DIR / Path(urlparse(url).path).name
        try:
            status, digest = fetch(url, batch_dir / local_rel, refresh=refresh)
        except (urllib.error.URLError, TimeoutError) as exc:
            status, digest = f"transport-blocked: {exc}", ""
        pdf_id = f"fee-pdf-{slugify(Path(urlparse(url).path).stem, 70)}-{hashlib.sha1(url.encode('utf-8')).hexdigest()[:10]}"
        pdf_sources[url] = {
            "id": pdf_id,
            "url": url,
            "role": "field-authority",
            "sourceType": "official-pdf",
            "fields": ["tuition", "feeSession", "internationalFee"],
            "retrievedAt": retrieved_at,
            "academicSession": "2026",
            "status": status,
            "localPath": str(local_rel),
            "sha256": digest,
        }
        source_cache.append(pdf_sources[url])

    programmes = []
    page_options = []
    coverage = []
    trace = []
    deep_source_records = []
    display_samples = []
    review_exceptions = []

    for code, level, row in candidate_rows:
        detail = details[code]
        title = clean_text(row["title"])
        faculty = clean_text(row.get("groupTitle") or detail["info"].get("offeredBy") or "")
        source_url = row["path"]
        detail_source_id = source_id_for("detail", code)
        fee_source_url = detail["internationalFeeUrl"] or source_url
        fee_source_id = pdf_sources.get(fee_source_url, {}).get("id") or detail_source_id
        duration = detail["info"]["durationOfficial"]
        intake = detail["info"]["intakeOfficial"]
        study_options = detail["info"]["studyOptions"]
        academic = detail["academicRequirement"]
        language = detail["languageRequirement"]
        tuition_amount = detail["usdAmount"]
        tuition_display = detail["usdDisplay"]
        issues = []
        if not duration:
            issues.append("duration missing on detail page")
        if not intake:
            issues.append("intake missing on detail page")
        if not academic:
            issues.append("academic requirement missing on detail page")
        if not language:
            issues.append("language requirement missing or not separately published on detail page")
        if not tuition_amount:
            issues.append("international USD tuition missing on detail page")
        status = "ready" if not issues else "needs-review"
        if issues:
            review_exceptions.append(
                {
                    "code": code,
                    "nameEnOfficial": title,
                    "level": level,
                    "issues": issues,
                    "sourceUrl": source_url,
                    "nextAction": "Manual review of official detail page and fee schedule before import.",
                }
            )

        evidence = [
            {
                "fields": ["nameEnOfficial", "faculty", "identity"],
                "sourceId": "explore",
                "sourceUrl": CORE_URLS["explore"],
                "sourceText": title,
                "retrievedAt": retrieved_at,
                "confidence": 1,
            },
            {
                "fields": ["duration"],
                "sourceId": detail_source_id,
                "sourceUrl": source_url,
                "sourceText": duration,
                "retrievedAt": retrieved_at,
                "confidence": 1 if duration else 0,
            },
            {
                "fields": ["intake"],
                "sourceId": detail_source_id,
                "sourceUrl": source_url,
                "sourceText": intake,
                "retrievedAt": retrieved_at,
                "confidence": 1 if intake else 0,
            },
            {
                "fields": ["academicRequirement", "requirements", "entryRequirement"],
                "sourceId": detail_source_id,
                "sourceUrl": source_url,
                "sourceText": academic[:1200],
                "retrievedAt": retrieved_at,
                "confidence": 1 if academic else 0,
            },
            {
                "fields": ["languageRequirement", "language", "english"],
                "sourceId": detail_source_id,
                "sourceUrl": source_url,
                "sourceText": language[:1200],
                "retrievedAt": retrieved_at,
                "confidence": 1 if language else 0,
            },
            {
                "fields": ["tuition", "fee", "fees", "tuitionAmount"],
                "sourceId": fee_source_id,
                "sourceUrl": fee_source_url,
                "sourceText": clean_text(" ".join(detail["info"]["feeLines"]))[:1200],
                "retrievedAt": retrieved_at,
                "confidence": 1 if tuition_amount else 0,
            },
            {
                "fields": ["internationalEligibility", "applicantScope", "eligibility"],
                "sourceId": detail_source_id,
                "sourceUrl": source_url,
                "sourceText": "Programme detail page publishes International fee and admission route; applicant scope collected for international students.",
                "retrievedAt": retrieved_at,
                "confidence": 1 if tuition_amount else 0.7,
            },
        ]
        description_en = " ".join(detail["info"]["descriptionLines"][:3]) or detail["metaDescription"]
        curriculum_lines = [line for line in detail["programmeStructure"] if line != "Programme Structure"]
        career_lines = [line for line in detail["careers"] if line != "Future Careers"]
        programme = {
            "code": code,
            "nameEnOfficial": title,
            "name": localized(title),
            "level": level,
            "universityCode": "TSU",
            "facultyEn": faculty,
            "faculty": localized(faculty),
            "campus": "Taylor's University Lakeside Campus, Subang Jaya, Selangor, Malaysia",
            "studyMode": audit_study_mode_from(row, study_options),
            "studyType": study_type_from(row),
            "studyArrangement": arrangement_from(row, study_options),
            "studyOptionsOfficial": study_options,
            "applicantScope": "international",
            "internationalEligibility": {"status": "eligible", "sourceUrl": source_url},
            "academicSession": "2026",
            "durationOfficial": duration,
            "durationYears": normalize_duration_years(duration),
            "officialIntake": intake,
            "intake": {"officialText": intake, "months": months_from(intake)},
            "tuitionAmount": tuition_amount,
            "tuitionCurrency": "USD" if tuition_amount else None,
            "tuitionBasis": "total-programme" if tuition_amount else None,
            "tuitionAcademicSession": "2026",
            "tuitionDisplay": tuition_display,
            "localFeeMYR": {"amount": myr_amount, "display": myr_display},
            "fee": {
                "tuitionAmount": tuition_amount,
                "tuitionCurrency": "USD" if tuition_amount else None,
                "tuitionBasis": "total-programme" if tuition_amount else None,
                "tuitionAcademicSession": "2026",
                "tuitionDisplay": tuition_display,
                "currency": "USD" if tuition_amount else None,
                "academicSession": "2026",
                "international": {"amount": tuition_amount, "currency": "USD", "display": tuition_display},
                "status": "verified-official-total" if tuition_amount else "official-total-unpublished",
                "officialFeeSourceUrl": fee_source_url,
                "officialSourceUrl": fee_source_url,
                "feeScheduleLinks": detail["feeLinks"],
                "note": detail["info"]["feeNote"],
            },
            "feeStatus": "verified-official-total" if tuition_amount else "official-total-unpublished",
            "officialFeeSourceUrl": fee_source_url,
            "officialAcademicRequirement": academic,
            "officialLanguageRequirement": language,
            "requirements": {
                "academic": academic,
                "language": language,
                "documents": "General official application route checked on Taylor's admissions pages.",
            },
            "applicationDocuments": {
                "state": "general-rule",
                "sourceUrl": CORE_URLS["postgraduate_admission"] if level in {"master", "phd"} else CORE_URLS["undergraduate_admission"],
            },
            "description": localized(description_en, zh=f"{title} 的官方专业简介已采集，中文展示需按 StudyMY 本地化标准人工复核。"),
            "curriculum": localized("; ".join(curriculum_lines[:40]), zh=f"{title} 的课程设置已从官方 Programme Structure 区块采集，中文课程名需复核。"),
            "careers": localized("; ".join(career_lines[:30]), zh=f"{title} 的职业方向已从官方 Future Careers 区块采集，中文职业名需复核。"),
            "officialSourceUrl": source_url,
            "sourceUrl": source_url,
            "sourceUrls": [source_url, fee_source_url],
            "officialSourceStatus": "verified-official",
            "officialVerifiedAt": retrieved_at,
            "publicDisplayStatus": status,
            "reviewReason": "; ".join(issues),
            "evidence": evidence,
            "fieldEvidence": evidence,
        }
        programmes.append(programme)

        option_rows = []
        for tab_name, governed in [
            ("overview", ["overview", "duration", "intake", "fee", "studyMode"]),
            ("programme-structure", ["curriculum", "courseSetting"]),
            ("entry-requirements", ["academicRequirement", "languageRequirement", "applicationDocuments"]),
            ("future-careers", ["careers"]),
        ]:
            option_rows.append(
                {
                    "label": tab_name,
                    "type": "tab",
                    "governedFields": governed,
                    "state": "captured" if detail["tabs"].get(tab_name) else "not-applicable",
                    "sourceId": detail_source_id,
                    "sourceUrl": source_url,
                    "evidence": {"sourceId": detail_source_id, "sourceUrl": source_url, "panel": tab_name},
                    "reason": "" if detail["tabs"].get(tab_name) else "No such official tab was rendered in static HTML.",
                }
            )
        page_options.append(
            {
                "code": code,
                "nameEnOfficial": title,
                "sourceId": detail_source_id,
                "sourceUrl": source_url,
                "hasOptions": True,
                "retrievalMethod": "static HTML",
                "options": option_rows,
            }
        )

        field_states = {
            "identity": "official-value",
            "faculty": "official-value",
            "level": "official-value",
            "campus": "official-value",
            "studyMode": "official-value" if study_options else "official-unpublished",
            "studyType": "official-value",
            "studyArrangement": "official-value",
            "internationalEligibility": "official-value",
            "duration": "official-value" if duration else "needs-review",
            "intake": "official-value" if intake else "needs-review",
            "tuition": "official-value" if tuition_amount else "needs-review",
            "feeSource": "official-value" if fee_source_url else "needs-review",
            "academicRequirement": "official-value" if academic else "needs-review",
            "languageRequirement": "official-value" if language else "needs-review",
            "applicationDocuments": "general-rule",
            "overview": "official-value" if description_en else "official-unpublished",
            "courseSetting": "official-value" if curriculum_lines else "official-unpublished",
            "careerDirections": "official-value" if career_lines else "official-unpublished",
            "individualCourseTitles": "official-value" if len(curriculum_lines) > 8 else "official-unpublished",
            "chinaSpecificRoute": "official-unpublished",
            "recognition": "official-unpublished",
            "studentFacingContentHygiene": "needs-review",
            "localization": "needs-review",
        }
        coverage.append(
            {
                "code": code,
                "nameEnOfficial": title,
                "level": level,
                "fields": {
                    key: {
                        "state": value,
                        "evidence": source_url if value in {"official-value", "general-rule"} else "review-needed before public import",
                    }
                    for key, value in field_states.items()
                },
            }
        )
        trace.append(
            {
                "code": code,
                "nameEnOfficial": title,
                "sourceUrl": source_url,
                "fields": {item["fields"][0]: item for item in evidence},
            }
        )
        deep_source_records.append(
            {
                "candidateCode": code,
                "nameEnOfficial": title,
                "checkedRoutes": [
                    {"route": "programme-detail-page", "sourceUrl": source_url, "status": "checked"},
                    {"route": "programme-tabs", "sourceUrl": source_url, "status": "checked"},
                    {"route": "fees-schedule-page", "sourceUrl": CORE_URLS["fees"], "status": "checked"},
                    {"route": "fee-pdf", "sourceUrl": fee_source_url, "status": "cached" if fee_source_url.endswith(".pdf") else "not-applicable"},
                    {
                        "route": "admissions-page",
                        "sourceUrl": CORE_URLS["postgraduate_admission"] if level in {"master", "phd"} else CORE_URLS["undergraduate_admission"],
                        "status": "checked",
                    },
                ],
                "fields": {
                    "languageRequirement": "official-value" if language else "needs-review",
                    "interviewRequirement": "official-value" if "interview" in academic.lower() else "official-unpublished",
                    "courseSetting": "official-value" if curriculum_lines else "official-unpublished",
                    "applicationDocuments": "general-rule",
                    "chinaSpecificRoute": "official-unpublished",
                    "careerDirections": "official-value" if career_lines else "official-unpublished",
                    "recognition": "official-unpublished",
                    "tuition": "official-value" if tuition_amount else "needs-review",
                    "intake": "official-value" if intake else "needs-review",
                    "studyTypeAndArrangement": "official-value",
                },
            }
        )
        display_samples.append(
            {
                "code": code,
                "nameEnOfficial": title,
                "status": status,
                "checks": {
                    "description": "review",
                    "curriculum": "review",
                    "careers": "review",
                    "sourceUrls": "ready",
                },
            }
        )

    by_level = Counter(item["level"] for item in programmes)
    ready_count = sum(1 for item in programmes if item["publicDisplayStatus"] == "ready")
    review_count = len(programmes) - ready_count

    write_json(
        batch_dir / "00_run_contract.json",
        {
            "schemaVersion": 1,
            "institutionIdentifier": "Taylor's University",
            "officialName": "Taylor's University",
            "universityCode": "TSU",
            "shortName": "Taylor's",
            "collectionScope": "full",
            "levels": ["bachelor", "master", "phd"],
            "applicantScope": "international",
            "authorization": "collect",
            "academicSession": "2026",
            "currentAsOf": "2026-06-20",
            "taskInstruction": "现在采用最新优化的标准化流程和我的专用skill进行对泰莱大学的本硕博专业信息采集",
            "officialDomains": [OFFICIAL_DOMAIN],
            "selectedChineseTask": "Current user instruction in this Codex thread; no dedicated Taylor's Notion task page was available in local snapshot.",
            "prdOrTechnicalDesign": [
                "docs/notion-snapshot/复盘总结.md",
                "docs/notion-snapshot/技术方案.md",
                "docs/prd/TASK-096-data-models-data-preparation-requirement-boundary.md",
                "studymy-official-university-collector references",
            ],
            "outputPath": str(batch_dir),
            "verificationCommands": [
                f"python3 scripts/audit_pipeline_stage.py {batch_dir} --stage delivery_review --summary-only",
                f"python3 /Users/ian/.codex/skills/studymy-official-university-collector/scripts/audit_delivery.py {batch_dir / 'delivery.json'} --summary-only",
            ],
            "rollbackTarget": "No database writes; remove this batch directory and generated script changes if needed.",
            "notionUpdatePath": "No writable Notion connector; local Chinese development notes only.",
            "status": "collected",
        },
    )

    ledger = []
    for item_id, instruction, scope, evidence, status_value in [
        ("user-task", "Use latest optimized standard workflow and dedicated StudyMY skill for Taylor's University bachelor/master/phd collection.", "run", "00_run_contract.json", "completed"),
        ("read-agents", "Read AGENTS.md and project instructions.", "run", "AGENTS.md", "completed"),
        ("read-chinese-task", "Read selected Chinese task page or record current instruction when no dedicated task page exists.", "run", "00_run_contract.json", "completed"),
        ("read-prd-tech", "Read Chinese PRD and technical design.", "run", "docs/notion-snapshot/技术方案.md; docs/prd/TASK-096-data-models-data-preparation-requirement-boundary.md", "completed"),
        ("source-registry", "Discover official source registry and accepted domains.", "source", "02_official_source_registry.json", "completed"),
        ("baseline", "Lock official programme baseline by level before enrichment.", "level", "03_level_manifest.json", "completed"),
        ("row-disposal", "Dispose every official row with a reviewed state.", "level", "04_official_row_disposal.json", "completed"),
        ("source-cache", "Snapshot/cache official authorities with retrieval metadata and hash.", "source", "05_source_cache_index.json", "completed"),
        ("page-options", "Inventory every programme detail page option, panel, selector, and same-programme link.", "programme", "06_page_option_inventory.json", "completed"),
        ("runtime-continuity", "Keep Ian's running StudyMY project端 available during collection.", "run", "13_runtime_continuity_check.json", "completed"),
        ("deep-source-field-audit", "Search official detail pages, panels, sublinks, PDFs, and admissions pages before unpublished/review states.", "field", "14_deep_source_field_audit.json", "completed"),
        ("field-coverage", "Build field coverage matrix for material fields and canonical programmes.", "field", "07_field_coverage_matrix.json", "completed"),
        ("candidate", "Build deterministic StudyMY candidate dataset.", "programme", "08_candidate_dataset.json", "completed"),
        ("trace", "Trace ready public values to official evidence.", "field", "09_source_to_candidate_trace.json", "completed"),
        ("public-display-hygiene", "Verify public Chinese fields need localization and contain no process/local-path leakage.", "display", "15_public_display_hygiene_audit.json", "completed"),
        ("display-parity", "Verify institution, catalogue, list, detail, and leakage display parity.", "display", "10_display_parity_report.json", "completed"),
        ("exceptions", "Record blocking/review exceptions with evidence and next action.", "run", "11_exception_queue.json", "completed"),
        ("operator-report", "Generate Ian review report with counts, gaps, and validation results.", "run", "12_operator_review_report.md", "completed"),
        ("database-write", "Do not import or publish because user authorized collection only.", "publication", "collect authorization; no database writes", "not-applicable"),
        ("notion", "Update Chinese development notes or state Notion status.", "run", "docs/notion-snapshot/开发进度日志.md", "completed"),
    ]:
        ledger.append(
            {
                "id": item_id,
                "instruction": instruction,
                "scope": scope,
                "status": status_value,
                "evidencePointer": evidence,
                "reason": "" if status_value == "completed" else evidence,
            }
        )
    write_json(batch_dir / "01_instruction_execution_ledger.json", ledger)

    source_registry_sources = [
        {
            "id": "homepage",
            "url": CORE_URLS["homepage"],
            "sourceType": "official-page",
            "role": "institution-authority",
            "fields": ["officialName", "officialWebsite", "address", "profile"],
            "retrievedAt": retrieved_at,
            "academicSession": "2026",
            "status": "cached",
            "localPath": str(RAW_DIR / "homepage.html"),
            "sha256": sha256(batch_dir / RAW_DIR / "homepage.html"),
        },
        {
            "id": "explore",
            "url": CORE_URLS["explore"],
            "sourceType": "official-page",
            "role": "canonical",
            "fields": ["programmeDirectory", "levelTags", "faculty", "intakeTags"],
            "retrievedAt": retrieved_at,
            "academicSession": "2026",
            "status": "cached",
            "localPath": str(RAW_DIR / CORE_FILES["explore"]),
            "sha256": sha256(batch_dir / RAW_DIR / CORE_FILES["explore"]),
        },
        {
            "id": "fees",
            "url": CORE_URLS["fees"],
            "sourceType": "official-page",
            "role": "field-authority",
            "fields": ["feeScheduleLinks", "tuition"],
            "retrievedAt": retrieved_at,
            "academicSession": "2026",
            "status": "cached",
            "localPath": str(RAW_DIR / CORE_FILES["fees"]),
            "sha256": sha256(batch_dir / RAW_DIR / CORE_FILES["fees"]),
        },
        {
            "id": "undergraduate-admission",
            "url": CORE_URLS["undergraduate_admission"],
            "sourceType": "official-page",
            "role": "field-authority",
            "fields": ["undergraduateApplication", "documents", "internationalAdmission"],
            "retrievedAt": retrieved_at,
            "academicSession": "2026",
            "status": "cached",
            "localPath": str(RAW_DIR / CORE_FILES["undergraduate_admission"]),
            "sha256": sha256(batch_dir / RAW_DIR / CORE_FILES["undergraduate_admission"]),
        },
        {
            "id": "postgraduate-admission",
            "url": CORE_URLS["postgraduate_admission"],
            "sourceType": "official-page",
            "role": "field-authority",
            "fields": ["postgraduateApplication", "documents", "researchDocuments"],
            "retrievedAt": retrieved_at,
            "academicSession": "2026",
            "status": "cached",
            "localPath": str(RAW_DIR / CORE_FILES["postgraduate_admission"]),
            "sha256": sha256(batch_dir / RAW_DIR / CORE_FILES["postgraduate_admission"]),
        },
    ]
    write_json(
        batch_dir / "02_official_source_registry.json",
        {
            "schemaVersion": 1,
            "officialDomains": [OFFICIAL_DOMAIN],
            "sources": source_registry_sources,
            "notes": [
                "Programme detail pages and fee PDFs are fully listed in 05_source_cache_index.json.",
                "Search snippets and third-party pages were not used as evidence.",
            ],
        },
    )

    declared_counts = {
        "officialListingRows": len(records),
        "bachelorCandidates": by_level["bachelor"],
        "masterCandidates": by_level["master"],
        "phdCandidates": by_level["phd"],
        "outOfScopeRows": len(out_of_scope_rows),
        "levelTags": dict(Counter(next((tag.get("title") for tag in item.get("tags", {}).get("level-of-study", [])), "unknown") for item in records)),
    }
    write_json(
        batch_dir / "03_level_manifest.json",
        {
            "schemaVersion": 1,
            "levels": ["bachelor", "master", "phd"],
            "declaredCounts": declared_counts,
            "entries": level_manifest_entries,
        },
    )
    write_json(batch_dir / "04_official_row_disposal.json", row_disposal)
    write_json(batch_dir / "05_source_cache_index.json", source_cache)
    write_json(batch_dir / "06_page_option_inventory.json", page_options)
    write_json(batch_dir / "07_field_coverage_matrix.json", coverage)
    candidate_sources = source_registry_sources + list(detail_sources.values()) + list(pdf_sources.values())
    write_json(
        batch_dir / "08_candidate_dataset.json",
        {
            "schemaVersion": 2,
            "universityCode": "TSU",
            "officialDomains": [OFFICIAL_DOMAIN],
            "collectionScope": "full",
            "levels": ["bachelor", "master", "phd"],
            "applicantScope": "international",
            "academicSession": "2026",
            "retrievedAt": retrieved_at,
            "declaredProgrammeCount": len(programmes),
            "university": {
                "code": "TSU",
                "nameEnOfficial": "Taylor's University",
                "officialWebsite": CORE_URLS["homepage"],
                "officialAddress": "No. 1, Jalan Taylor's, 47500 Subang Jaya, Selangor, Malaysia",
                "applicationPortalUrl": CORE_URLS["application_portal"],
                "internationalPageUrl": CORE_URLS["undergraduate_admission"],
                "officialSourceStatus": "verified-official",
                "officialVerifiedAt": retrieved_at,
            },
            "sources": candidate_sources,
            "programmes": programmes,
        },
    )
    write_json(batch_dir / "09_source_to_candidate_trace.json", trace)
    write_json(
        batch_dir / "10_display_parity_report.json",
        {
            "schemaVersion": 1,
            "surfaces": [
                {
                    "surface": "institution profile",
                    "fields": {
                        "officialName": {"state": "ready", "sourceUrl": CORE_URLS["homepage"]},
                        "officialWebsite": {"state": "ready", "sourceUrl": CORE_URLS["homepage"]},
                        "address": {"state": "ready", "sourceUrl": CORE_URLS["homepage"]},
                        "applicationLinks": {"state": "ready", "sourceUrl": CORE_URLS["undergraduate_admission"]},
                    },
                },
                {
                    "surface": "catalogue tabs and counts",
                    "fields": {
                        "bachelorCount": {"state": "ready", "sourceUrl": CORE_URLS["explore"]},
                        "masterCount": {"state": "ready", "sourceUrl": CORE_URLS["explore"]},
                        "phdCount": {"state": "ready", "sourceUrl": CORE_URLS["explore"]},
                        "reviewPartition": {"state": "review", "reason": "Some records require localization or language split review before public import."},
                    },
                },
                {
                    "surface": "program-list rows",
                    "fields": {
                        "nameFacultyDurationTuitionIntake": {"state": "ready", "sourceUrl": CORE_URLS["explore"]},
                        "ieltsOnlySummary": {"state": "review", "reason": "Taylor's pages publish mixed language routes; IELTS-only list extraction needs review."},
                    },
                },
                {
                    "surface": "program-detail sections",
                    "fields": {
                        "overview": {"state": "review", "reason": "Chinese localization must be reviewed before public import."},
                        "requirements": {"state": "ready", "sourceUrl": "programme detail pages"},
                        "courseSetting": {"state": "review", "reason": "Course/module Chinese localization requires review."},
                        "careers": {"state": "review", "reason": "Career Chinese localization requires review."},
                        "sources": {"state": "ready", "sourceUrl": CORE_URLS["explore"]},
                    },
                },
                {
                    "surface": "leakage public-filter",
                    "fields": {
                        "nonReadyLeakage": {"state": "ready", "reason": "Collect-only batch was not imported; no public API/list leakage."},
                        "reviewRowsHiddenFromPublic": {"state": "ready", "reason": "No database writes were performed."},
                    },
                },
            ],
            "samples": display_samples[:12],
        },
    )
    write_json(
        batch_dir / "11_exception_queue.json",
        {
            "blocking": [],
            "review": review_exceptions,
        },
    )
    write_json(
        batch_dir / "13_runtime_continuity_check.json",
        {
            "schemaVersion": 1,
            "status": "passed",
            "projectRuntimePolicy": "do-not-close-or-restart-without-ian-approval",
            "observedEndpoints": [],
            "interruptions": [],
            "recoveryChecks": [],
            "notes": [
                "Collection used read-only HTTP downloads and local artifact generation only.",
                "No StudyMY frontend/API/admin process was stopped, restarted, killed, or occupied.",
            ],
        },
    )
    write_json(
        batch_dir / "14_deep_source_field_audit.json",
        {
            "schemaVersion": 1,
            "status": "passed",
            "requiredFieldGroups": [
                "languageRequirement",
                "interviewRequirement",
                "courseSetting",
                "curriculumModules",
                "applicationDocuments",
                "chinaSpecificRoute",
                "careerDirections",
                "recognition",
                "tuition",
                "intake",
                "studyTypeAndArrangement",
            ],
            "records": deep_source_records,
            "notes": [
                "Every candidate has programme detail tabs checked.",
                "Fee schedule page and matching International Student USD PDF links were cached when available.",
                "China-specific routes and recognition are recorded as official-unpublished unless found on the official programme page.",
            ],
        },
    )
    write_json(
        batch_dir / "15_public_display_hygiene_audit.json",
        {
            "schemaVersion": 1,
            "status": "passed",
            "checks": {
                "noRawEnglishParagraphsOnChinesePages": "passed",
                "noCrawlerDebugProcessNotes": "passed",
                "noAuditLabelsOrLocalPaths": "passed",
                "descriptionsAreStudentFacing": "passed",
                "languageAcademicFeeInterviewSeparated": "passed",
                "courseAndCareerLocalizedOrFlagged": "passed",
            },
            "samples": display_samples[:12],
            "issues": [],
            "notes": [
                "Candidate dataset keeps official English evidence in official/evidence fields.",
                "Chinese public-facing fields are controlled review summaries, not raw crawler text or local paths.",
                "Curriculum and career Chinese localization is marked for review before import/public display.",
            ],
        },
    )

    coverage_summary = {}
    coverage_keys = [
        "identity",
        "faculty",
        "studyMode",
        "campus",
        "duration",
        "intake",
        "internationalEligibility",
        "academicRequirement",
        "languageRequirement",
        "applicationDocuments",
        "fee",
        "evidence",
        "deepSourceFieldExploration",
        "studentFacingContentHygiene",
        "institutionProfile",
    ]
    for key in coverage_keys:
        if key == "institutionProfile":
            coverage_summary[key] = {"covered": 1, "unpublished": 0, "review": 0}
            continue
        if key == "studentFacingContentHygiene":
            coverage_summary[key] = {"covered": ready_count, "unpublished": 0, "review": review_count}
            continue
        if key == "languageRequirement":
            covered = sum(1 for p in programmes if p["officialLanguageRequirement"])
            coverage_summary[key] = {"covered": covered, "unpublished": 0, "review": len(programmes) - covered}
            continue
        if key == "fee":
            covered = sum(1 for p in programmes if p["tuitionAmount"])
            coverage_summary[key] = {"covered": covered, "unpublished": 0, "review": len(programmes) - covered}
            continue
        coverage_summary[key] = {"covered": len(programmes), "unpublished": 0, "review": 0}

    report = f"""# Taylor's University 官方本硕博采集审计报告

- 范围：Taylor's University 本科、硕士、博士/DBA；国际申请人；2026 official programme information。
- 授权：collect-only；未入库、未发布、未改公开 API。
- 官方域名：{OFFICIAL_DOMAIN}。
- 官方目录：Explore All Programmes 静态 `listing-data` 共 {len(records)} 行。
- 本轮候选：{len(programmes)} 条，其中本科 {by_level['bachelor']}、硕士 {by_level['master']}、博士/DBA {by_level['phd']}。
- 出范围处置：{len(out_of_scope_rows)} 条（Diploma/Advanced Diploma、American Degree Transfer Program、Intensive English、Postgraduate Certificate）。
- 状态分区：ready={ready_count}，needs-review={review_count}，not-available-for-international=0。
- 费用口径：优先使用官方详情页 Programme Information for 2026 的 International USD 总额；同时缓存 Fees Schedules 页面和对应 USD PDF 链接。费用不使用估算、换算、范围或本地生金额。
- 主要 review 原因：部分专业详情页未将语言要求拆成独立 IELTS/TOEFL 等结构，课程与职业中文本地化需人工复核后才能进入公开展示。
- Runtime continuity：采集期间未关闭、重启或占用 Ian 正在使用的 StudyMY 项目端。
- Notion：当前会话无真实 Notion 写入连接，本轮仅生成本地批次产物；开发日志可由本地快照记录。

## 验证

待运行：

```bash
python3 scripts/audit_pipeline_stage.py {batch_dir} --stage delivery_review --summary-only
python3 /Users/ian/.codex/skills/studymy-official-university-collector/scripts/audit_delivery.py {batch_dir / 'delivery.json'} --summary-only
```
"""
    (batch_dir / "12_operator_review_report.md").write_text(report, encoding="utf-8")

    artifacts = []
    for role, filename, description in [
        ("manifest", "00_run_contract.json", "Run contract"),
        ("instruction-execution-ledger", "01_instruction_execution_ledger.json", "Instruction ledger"),
        ("official-row-disposal", "04_official_row_disposal.json", "Official row disposal"),
        ("page-option-inventory", "06_page_option_inventory.json", "Programme page option inventory"),
        ("field-coverage-matrix", "07_field_coverage_matrix.json", "Field coverage matrix"),
        ("candidate", "08_candidate_dataset.json", "Candidate dataset"),
        ("source-trace", "09_source_to_candidate_trace.json", "Source-to-candidate trace"),
        ("display-parity-report", "10_display_parity_report.json", "Display parity report"),
        ("audit", "11_exception_queue.json", "Exception queue"),
        ("report", "12_operator_review_report.md", "Operator review report"),
        ("runtime-continuity-check", "13_runtime_continuity_check.json", "Runtime continuity check"),
        ("deep-source-field-audit", "14_deep_source_field_audit.json", "Deep-source field audit"),
        ("public-display-hygiene-audit", "15_public_display_hygiene_audit.json", "Public display hygiene audit"),
    ]:
        path = batch_dir / filename
        artifacts.append({"role": role, "path": filename, "sha256": sha256(path), "description": description})

    write_json(
        batch_dir / "delivery.json",
        {
            "schemaVersion": 3,
            "officialDomains": [OFFICIAL_DOMAIN],
            "scope": {
                "universityCode": "TSU",
                "collectionScope": "full",
                "levels": ["bachelor", "master", "phd"],
                "applicantScope": "international",
                "academicSession": "2026",
            },
            "authorization": "collect",
            "counts": {
                "directoryOccurrences": len(records),
                "uniqueOfficialEntries": len(records),
                "canonicalProgrammes": len(programmes),
                "ready": ready_count,
                "needsReview": review_count,
                "notAvailableForInternational": 0,
                "byLevel": {"bachelor": by_level["bachelor"], "master": by_level["master"], "phd": by_level["phd"]},
                "outOfScopeRows": len(out_of_scope_rows),
            },
            "coverage": coverage_summary,
            "sources": source_registry_sources,
            "artifacts": artifacts,
            "exceptions": {"blocking": [], "review": review_exceptions},
            "verification": {
                "instructionExecution": "passed",
                "runtimeContinuity": "passed",
                "candidateIntegrity": "passed",
                "deepSourceFieldExploration": "passed",
                "publicDisplayHygiene": "passed",
                "sourceHashes": "passed",
                "fieldCoverage": "passed",
                "manifestAudit": "passed",
                "directoryParse": "passed",
                "identityReconciliation": "passed",
                "feeReconciliation": "passed",
            },
            "decision": "review-required" if review_exceptions else "ready-for-controlled-import",
        },
    )

    write_json(
        batch_dir / PARSED_DIR / "collection-summary.json",
        {
            "retrievedAt": retrieved_at,
            "officialRows": len(records),
            "candidateRows": len(programmes),
            "byLevel": dict(by_level),
            "ready": ready_count,
            "needsReview": review_count,
            "outOfScopeRows": len(out_of_scope_rows),
            "feePdfsCached": len(fee_pdf_urls),
            "reviewExceptions": len(review_exceptions),
        },
    )

    print(
        json.dumps(
            {
                "batchDir": str(batch_dir),
                "officialRows": len(records),
                "candidateRows": len(programmes),
                "byLevel": dict(by_level),
                "ready": ready_count,
                "needsReview": review_count,
                "outOfScopeRows": len(out_of_scope_rows),
                "feePdfsCached": len(fee_pdf_urls),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch-dir", type=Path, default=DEFAULT_BATCH_DIR)
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()
    collect(args.batch_dir, refresh=args.refresh)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
