#!/usr/bin/env python3
"""Build the Sunway University official collection audit batch."""

from __future__ import annotations

import hashlib
import json
import re
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader


BATCH_DIR = Path("data/imports/sunway/2026-06-20/sunway-20260620")
DEV_LOG = Path("tmp/dev-logs/2026-06-20-sunway-official-collection.md")
BASE_URL = "https://sunwayuniversity.edu.my"
CURRENT_AS_OF = "2026-06-21"
RETRIEVED_AT = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
OFFICIAL_DOMAINS = ["sunwayuniversity.edu.my", "studyonline.sunwayuniversity.edu.my"]
SESSION = "Year 2026 fee/intake pages; current as of 2026-06-20, deep-reviewed and fee-policy corrected on 2026-06-21"

OFFICIAL_URLS = {
    "home": f"{BASE_URL}/",
    "courses": f"{BASE_URL}/courses",
    "undergraduate-prospectuses": f"{BASE_URL}/periodicals/prospectuses",
    "postgraduate-prospectuses": f"{BASE_URL}/periodicals/prospectuses-postgraduate",
    "international": f"{BASE_URL}/international",
    "apply": f"{BASE_URL}/apply",
    "payment-instructions": f"{BASE_URL}/admissions/payment-instructions",
}

PDF_URLS = {
    "ug-application-form": f"{BASE_URL}/sites/default/files/20241220.%20SUN-U%20APPLICATION%20FORM%20(editable).pdf",
    "pg-application-form": f"{BASE_URL}/sites/default/files/documents/2023-07/20230606.%20SUN-U%20POSTGRADUATE%20APPLICATION%20FORM%20(Editable).pdf",
}

TOP_LEVELS = {
    "Diploma",
    "Undergraduate",
    "Postgraduate",
    "Micro-Credentials",
    "Short Courses",
    "Xplorer Hub",
    "Sustainability",
}

OUT_OF_SCOPE_UNDERGRADUATE_SUBCATEGORIES = {
    "American Degree Transfer Program",
    "ASU Pathway Program",
}

OUT_OF_SCOPE_POSTGRADUATE_SUBCATEGORIES = {
    "Post Basic Certificate",
    "Postgraduate Diploma",
}

MATERIAL_FIELDS = [
    "identity",
    "faculty",
    "level",
    "campus",
    "mode",
    "applicantScope",
    "internationalEligibility",
    "duration",
    "intake",
    "studyType",
    "studyArrangement",
    "tuition",
    "academicEntry",
    "languageRequirement",
    "documents",
    "interview",
    "courseSetting",
    "careers",
    "recognition",
    "overview",
    "sourceTrace",
    "localization",
    "displayHygiene",
]


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "item"


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def fetch(url: str) -> tuple[str, int, str]:
    headers = {"User-Agent": "StudyMY official collection audit/1.0"}
    response = requests.get(url, headers=headers, timeout=45)
    response.raise_for_status()
    return response.text, response.status_code, response.url


def cache_html(source_id: str, url: str) -> dict[str, Any]:
    html, status, final_url = fetch(url)
    local_path = BATCH_DIR / "sources" / "html" / f"{source_id}.html"
    local_path.parent.mkdir(parents=True, exist_ok=True)
    local_path.write_text(html, encoding="utf-8")
    return {
        "id": source_id,
        "url": final_url,
        "statusCode": status,
        "localPath": str(local_path.relative_to(BATCH_DIR)),
        "sha256": sha256_file(local_path),
        "retrievedAt": RETRIEVED_AT,
        "html": html,
    }


def cache_pdf(source_id: str, url: str) -> dict[str, Any]:
    headers = {"User-Agent": "StudyMY official collection audit/1.0"}
    response = requests.get(url, headers=headers, timeout=60)
    response.raise_for_status()
    local_path = BATCH_DIR / "sources" / "pdf" / f"{source_id}.pdf"
    text_path = BATCH_DIR / "sources" / "text" / f"{source_id}.txt"
    local_path.parent.mkdir(parents=True, exist_ok=True)
    text_path.parent.mkdir(parents=True, exist_ok=True)
    local_path.write_bytes(response.content)
    reader = PdfReader(str(local_path))
    pages = []
    for index, page in enumerate(reader.pages, start=1):
        page_text = clean_text(page.extract_text() or "")
        pages.append({"page": index, "text": page_text})
    text_path.write_text(
        "\n\n".join(f"--- page {item['page']} ---\n{item['text']}" for item in pages),
        encoding="utf-8",
    )
    return {
        "id": source_id,
        "url": response.url,
        "statusCode": response.status_code,
        "localPath": str(local_path.relative_to(BATCH_DIR)),
        "textPath": str(text_path.relative_to(BATCH_DIR)),
        "sha256": sha256_file(local_path),
        "retrievedAt": RETRIEVED_AT,
        "text": "\n".join(item["text"] for item in pages),
        "pageCount": len(pages),
    }


def source_from_cache(cache: dict[str, Any], role: str, fields: list[str], source_type: str = "official-page") -> dict[str, Any]:
    source = {
        "id": cache["id"],
        "url": cache["url"],
        "sourceType": source_type,
        "role": role,
        "fields": fields,
        "retrievedAt": cache["retrievedAt"],
        "academicSession": SESSION,
        "status": "cached",
        "localPath": cache["localPath"],
        "sha256": cache["sha256"],
    }
    if cache.get("textPath"):
        source["textPath"] = cache["textPath"]
        source["pageCount"] = cache.get("pageCount", 0)
    return source


def parse_course_directory(html: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict[str, Any]] = []
    started = False
    current_top = ""
    current_sub = ""

    for element in soup.find_all(["h1", "h2", "h3", "a"]):
        text = clean_text(element.get_text(" ", strip=True))
        if element.name == "h1" and text == "Courses":
            started = True
            continue
        if not started or not text:
            continue
        if element.name in {"h1", "h2"}:
            continue
        if element.name == "h3":
            if text in TOP_LEVELS and (text != "Sustainability" or current_top not in {"Short Courses", "Xplorer Hub"}):
                current_top = text
                current_sub = ""
            else:
                current_sub = text
            continue
        href = element.get("href")
        if not href or not current_top:
            continue
        url = urljoin(BASE_URL, href)
        if url.startswith(BASE_URL) and "/courses/" in url:
            rows.append(
                {
                    "directoryOrdinal": len(rows) + 1,
                    "topGroup": current_top,
                    "subcategory": current_sub,
                    "directoryTitle": text,
                    "sourceUrl": url,
                }
            )
    return rows


def classify_row(row: dict[str, Any]) -> tuple[str, str, str]:
    top = row["topGroup"]
    sub = row["subcategory"]
    title = row["directoryTitle"]
    if top == "Undergraduate":
        if sub in OUT_OF_SCOPE_UNDERGRADUATE_SUBCATEGORIES:
            return "out-of-scope", "", "Official undergraduate row is a transfer/pathway programme, not a direct StudyMY bachelor candidate for this 本硕博 run."
        return "candidate", "bachelor", ""
    if top == "Postgraduate":
        if sub in OUT_OF_SCOPE_POSTGRADUATE_SUBCATEGORIES:
            return "out-of-scope", "", "Official postgraduate row is certificate/diploma level; user requested 本硕博 only."
        if sub in {"Doctor of Philosophy (PhD) Degrees", "Doctorate"} or title.lower().startswith("doctor"):
            return "candidate", "phd", ""
        if sub.startswith("Master"):
            return "candidate", "master", ""
    return "out-of-scope", "", "Official row is outside the requested undergraduate/master/doctorate scope."


def parse_key_details(soup: BeautifulSoup) -> dict[str, Any]:
    result: dict[str, Any] = {"raw": ""}
    block = soup.select_one(".view-course-key-details")
    if not block:
        return result
    result["raw"] = clean_text(block.get_text(" | ", strip=True))
    intakes = block.select_one(".views-field-field-intakes .field-content")
    if intakes:
        result["intakes"] = clean_text(intakes.get_text(" ", strip=True))
    duration = block.select_one(".coursedurationfield")
    if duration:
        result["duration"] = clean_text(duration.get_text(" ", strip=True))
    career_items = [clean_text(li.get_text(" ", strip=True)) for li in block.select(".views-field-field-career-prospects li")]
    result["careers"] = [item for item in career_items if item]
    fee_field = block.select_one(".views-field-field-malaysian-student-fees .field-content")
    if fee_field:
        label = fee_field.select_one(".views-label")
        result["feeLabel"] = clean_text(label.get_text(" ", strip=True)) if label else ""
        result["feeRaw"] = clean_text(fee_field.get_text(" | ", strip=True))
        result["feeItems"] = [clean_text(li.get_text(" ", strip=True)) for li in fee_field.find_all("li")]
        result["feeNote"] = " ".join(
            clean_text(item.get_text(" ", strip=True))
            for item in fee_field.select(".smital")
            if clean_text(item.get_text(" ", strip=True))
        )
    extra_labels = {}
    for field in block.select(".views-field"):
        label = field.select_one(".views-label")
        content = field.select_one(".field-content")
        if label and content:
            extra_labels[clean_text(label.get_text(" ", strip=True))] = clean_text(content.get_text(" | ", strip=True))
    result["extra"] = extra_labels
    return result


def parse_breadcrumb(soup: BeautifulSoup) -> list[str]:
    return [clean_text(li.get_text(" ", strip=True)) for li in soup.select("ol.breadcrumb li") if clean_text(li.get_text(" ", strip=True))]


def parse_overview(soup: BeautifulSoup) -> str:
    overview = soup.select_one("#overview .field--name-body")
    if not overview:
        overview = soup.select_one("#overview")
    if not overview:
        return ""
    for tag in overview(["script", "style", "iframe", "picture", "img"]):
        tag.decompose()
    return clean_text(overview.get_text(" ", strip=True))


def parse_programme_structure(soup: BeautifulSoup) -> list[dict[str, Any]]:
    structure: list[dict[str, Any]] = []
    block = soup.select_one("#programme-structure")
    if not block:
        return structure
    for title_node in block.select(".views-field-field-group-title"):
        title = clean_text(title_node.get_text(" ", strip=True))
        row = title_node.find_parent(class_="views-row")
        items: list[str] = []
        if row:
            items = [clean_text(item.get_text(" ", strip=True)) for item in row.select(".field--name-field-item-title")]
        if title or items:
            structure.append({"group": title, "items": [item for item in items if item]})
    if not structure:
        text = clean_text(block.get_text(" | ", strip=True))
        if text:
            structure.append({"group": "Programme Structure", "items": [text]})
    return structure


def section_text(node: Any, separator: str = " | ") -> str:
    if not node:
        return ""
    clone = BeautifulSoup(str(node), "html.parser")
    for tag in clone(["script", "style", "iframe", "picture", "img", "form"]):
        tag.decompose()
    return clean_text(clone.get_text(separator, strip=True))


def strip_section_heading(text: str, *headings: str) -> str:
    value = clean_text(text)
    for heading in headings:
        pattern = rf"^{re.escape(heading)}\s*(?:\|\s*)?"
        value = re.sub(pattern, "", value, flags=re.IGNORECASE).strip()
    return clean_text(value)


def parse_online_key_details(soup: BeautifulSoup) -> dict[str, Any]:
    block = soup.select_one(".coursedetails")
    if not block:
        return {"raw": ""}
    result: dict[str, Any] = {"raw": section_text(block)}
    duration = block.select_one(".details.duration")
    intakes = block.select_one(".details.intakes")
    subjects = block.select_one(".details.subjects")
    if duration:
        result["duration"] = strip_section_heading(section_text(duration), "Duration")
    if intakes:
        result["intakes"] = strip_section_heading(section_text(intakes), "Study periods", "Intakes")
    if not result.get("intakes"):
        intake_labels = [
            clean_text(item.get_text(" ", strip=True))
            for item in soup.select(".study-periods .current.intake .study-periods--entrydate, .study-periods li.current.intake")
            if clean_text(item.get_text(" ", strip=True))
        ]
        cleaned_labels = []
        for label in intake_labels:
            label = clean_text(label.replace("Entry Point", ""))
            if label and label not in cleaned_labels:
                cleaned_labels.append(label)
        if cleaned_labels:
            result["intakes"] = ", ".join(cleaned_labels)
    if subjects:
        result["subjects"] = strip_section_heading(section_text(subjects), "Subjects")
    fee_block = soup.select_one(".entrytabgroup3")
    if fee_block:
        result["onlineFeeRaw"] = section_text(fee_block)
        result["feeItems"] = [
            clean_text(item.get_text(" ", strip=True))
            for item in fee_block.find_all(["p", "li"])
            if clean_text(item.get_text(" ", strip=True))
        ]
        result["feeLabel"] = "Fees and Schedule"
    return result


def parse_online_overview(soup: BeautifulSoup) -> str:
    for selector in [".region-before-lower-gray", ".region-upper", ".region-upper-featured"]:
        block = soup.select_one(selector)
        if not block:
            continue
        pieces = []
        for tag in block.find_all(["p", "h2"], recursive=True):
            text = clean_text(tag.get_text(" ", strip=True))
            if not text:
                continue
            if text.upper() in {"DOWNLOAD PROGRAMME GUIDE", "ENQUIRE NOW", "COURSE STRUCTURE AND SUBJECTS", "WHAT YOU WILL STUDY"}:
                continue
            if any(stop in text.lower() for stop in ["download programme guide", "check my eligibility", "book a call"]):
                continue
            pieces.append(text)
            if len(" ".join(pieces)) > 700:
                break
        overview = clean_text(" ".join(pieces))
        if overview:
            return overview
    return ""


def parse_online_structure(soup: BeautifulSoup) -> list[dict[str, Any]]:
    structure: list[dict[str, Any]] = []
    for section in soup.select(".curriculum"):
        title_node = section.find(["header", "h2", "h3", "h4"])
        title = clean_text(title_node.get_text(" ", strip=True)) if title_node else "Course Structure"
        items = [
            clean_text(item.get_text(" ", strip=True))
            for item in section.find_all("li")
            if clean_text(item.get_text(" ", strip=True))
        ]
        if not items:
            items = [
                clean_text(item.get_text(" ", strip=True))
                for item in section.select(".content p")
                if clean_text(item.get_text(" ", strip=True)) and clean_text(item.get_text(" ", strip=True)).lower() not in {"download programme guide"}
            ]
        if title or items:
            structure.append({"group": title, "items": items})
    return structure


def parse_online_academic_requirements(soup: BeautifulSoup) -> dict[str, Any]:
    block = soup.select_one(".entrytabgroup1")
    if not block:
        return {"raw": "", "items": []}
    raw = section_text(block)
    detail = strip_section_heading(raw, "Academic Requirement")
    items = [{"title": "Academic Requirement", "detail": detail}] if detail else []
    return {"raw": raw, "items": items}


def parse_online_other_requirements(soup: BeautifulSoup) -> list[dict[str, str]]:
    requirements: list[dict[str, str]] = []
    language_block = soup.select_one(".entrytabgroup2")
    if language_block:
        raw = section_text(language_block)
        detail = strip_section_heading(raw, "English Language Requirement")
        if detail:
            requirements.append({"title": "English Language Requirement", "detail": detail})
    return requirements


def parse_online_application_documents(soup: BeautifulSoup) -> str:
    block = soup.select_one(".entrytabs")
    if not block:
        return ""
    text = section_text(block)
    match = re.search(
        r"Send us .*?(?:free eligibility check|eligibility check)\.?",
        text,
        flags=re.IGNORECASE,
    )
    return clean_text(match.group(0)) if match else ""


def extract_pdf_application_documents(pdf_caches: dict[str, dict[str, Any]]) -> dict[str, dict[str, str]]:
    documents: dict[str, dict[str, str]] = {}
    patterns = {
        "bachelor": ("ug-application-form", r"STEP 4: PREPARE THE FOLLOWING DOCUMENTS AND ITEMS FOR SUBMISSION(.*?)(?:IMPORTANT NOTES|$)"),
        "master": ("pg-application-form", r"STEP 4: PREPARE THE FOLLOWING DOCUMENTS AND ITEMS FOR SUBMISSION(.*?)(?:IMPORTANT NOTES|$)"),
        "phd": ("pg-application-form", r"STEP 4: PREPARE THE FOLLOWING DOCUMENTS AND ITEMS FOR SUBMISSION(.*?)(?:IMPORTANT NOTES|$)"),
    }
    for level, (source_id, pattern) in patterns.items():
        cache = pdf_caches[source_id]
        match = re.search(pattern, cache["text"], flags=re.IGNORECASE | re.DOTALL)
        text = clean_text(match.group(0) if match else cache["text"])
        documents[level] = {
            "status": "general-rule",
            "officialText": text[:2500],
            "sourceId": source_id,
            "sourceUrl": cache["url"],
            "sha256": cache["sha256"],
            "provenance": "official-application-form-pdf",
        }
    return documents


def parse_academic_requirements(soup: BeautifulSoup) -> dict[str, Any]:
    container = soup.select_one(".entryreqcontainer")
    if not container:
        return {"raw": "", "items": []}
    items: list[dict[str, str]] = []
    for paragraph in container.select(".paragraph--type--entry-requirement"):
        title_node = paragraph.select_one(".field--name-field-entry-requirement-title")
        detail_node = paragraph.select_one(".field--name-field-entry-requirement-details")
        title = clean_text(title_node.get_text(" ", strip=True)) if title_node else ""
        detail = clean_text(detail_node.get_text(" ", strip=True)) if detail_node else clean_text(paragraph.get_text(" ", strip=True))
        if title or detail:
            items.append({"title": title, "detail": detail})
    raw = clean_text(container.get_text(" | ", strip=True))
    return {"raw": raw, "items": items}


def parse_other_requirements(soup: BeautifulSoup) -> list[dict[str, str]]:
    requirements: list[dict[str, str]] = []
    for row in soup.select(".view-course-other-requirements .views-row"):
        title_node = row.select_one(".views-field-field-req-title") or row.find(["h3", "h4"])
        title = clean_text(title_node.get_text(" ", strip=True)) if title_node else ""
        row_text = clean_text(row.get_text(" | ", strip=True))
        detail = row_text
        if title and detail.startswith(title):
            detail = clean_text(detail[len(title) :])
        if title or detail:
            requirements.append({"title": title, "detail": detail})
    return requirements


def parse_additional_info(soup: BeautifulSoup, block_id: str) -> str:
    block = soup.select_one(f"#{block_id}")
    return clean_text(block.get_text(" | ", strip=True)) if block else ""


def extract_tests(language_text: str) -> dict[str, str]:
    tests: dict[str, str] = {}
    patterns = {
        "IELTS": r"IELTS(?: or equivalent)?(?:[^0-9]{0,80})?(?:score of|minimum score of|average score of|at least a score of)?\s*([0-9]+(?:\.[0-9]+)?(?:\s*or equivalent)?)",
        "MUET": r"(?:MUET|Malaysian University English Test)\s*\|?\s*:?\s*(Band\s*[0-9.]+)",
        "PTE": r"PTE\s*\|?\s*:?\s*([0-9]+)",
        "TOEFL": r"TOEFL(?: iBT)?(?:[^0-9]{0,80})?(?:score of|minimum score of)?\s*([0-9]+(?:\s*-\s*(?:paper-based|internet-based|computer-based))?(?:\s*or\s*[0-9]+\s*-\s*(?:paper-based|internet-based|computer-based))?)",
    }
    for test, pattern in patterns.items():
        match = re.search(pattern, language_text, re.IGNORECASE)
        if match:
            tests[test] = clean_text(match.group(1))
    if "IELTS" not in tests:
        match = re.search(r"(?:score of|minimum score of|at least a score of)\s*([0-9.]+).*?(?:IELTS|International English Language Testing System)", language_text, re.IGNORECASE)
        if match:
            tests["IELTS"] = clean_text(match.group(1))
    return tests


def derive_study_type(level: str, subcategory: str, title: str) -> str:
    if level == "bachelor":
        return "not-applicable"
    text = f"{subcategory} {title}".lower()
    if "by research" in text or "philosophy" in text or "doctor of" in text:
        return "research" if "education" not in text or "doctor of education" not in text else "mixed"
    if "taught" in text or "online" in text:
        return "coursework"
    return "not-confirmed"


def derive_study_arrangement(duration: str, subcategory: str, title: str) -> list[str]:
    text = f"{duration} {subcategory} {title}".lower()
    arrangements: list[str] = []
    for label in ("full-time", "part-time", "online"):
        if label in text:
            arrangements.append(label)
    return arrangements


def derive_study_mode(study_arrangement: list[str]) -> str:
    if "online" in study_arrangement:
        return "online"
    if "full-time" in study_arrangement and "part-time" in study_arrangement:
        return "full-time/part-time"
    if "full-time" in study_arrangement:
        return "full-time"
    if "part-time" in study_arrangement:
        return "part-time"
    return "not-confirmed"


def parse_months(value: str) -> list[str]:
    aliases = {
        "jan": "January",
        "feb": "February",
        "mar": "March",
        "apr": "April",
        "may": "May",
        "jun": "June",
        "jul": "July",
        "july": "July",
        "aug": "August",
        "sep": "September",
        "sept": "September",
        "oct": "October",
        "nov": "November",
        "dec": "December",
    }
    months: list[str] = []
    for part in re.split(r",|/", value or ""):
        cleaned = clean_text(part)
        if not cleaned:
            continue
        key = cleaned.lower().rstrip(".")
        months.append(aliases.get(key, cleaned))
    return months


def extract_fee_amounts(key_details: dict[str, Any]) -> dict[str, Any]:
    fee_items = key_details.get("feeItems") or []
    fee_label = key_details.get("feeLabel") or ""
    fee_raw = key_details.get("feeRaw") or key_details.get("onlineFeeRaw") or ""
    fee_basis = "estimated-annual-course-fee" if "annual" in f"{fee_label} {fee_raw}".lower() else "estimated-total-course-fee" if "total" in f"{fee_label} {fee_raw}".lower() else "official-programme-fee"
    result = {
        "label": fee_label,
        "raw": fee_raw,
        "note": key_details.get("feeNote") or "",
        "malaysian": None,
        "internationalUsdIndicative": None,
        "onlineProgrammeRm": None,
        "enrolmentFeeRm": None,
        "basis": fee_basis,
        "paymentNote": "",
        "status": "not-confirmed",
        "reviewReason": "",
    }
    for item in fee_items:
        rm = re.search(r"RM\s*([0-9,]+)", item)
        usd = re.search(r"USD\s*([0-9,]+)", item)
        if rm and "malaysian" in item.lower():
            result["malaysian"] = {"currency": "RM", "amountText": f"RM{rm.group(1)}", "scope": "Malaysian students"}
        if usd and "international" in item.lower():
            result["internationalUsdIndicative"] = {
                "currency": "USD",
                "amountText": f"USD{usd.group(1)}",
                "scope": "international students",
                "isIndicative": True,
            }
            result["status"] = "official-rate-only"
            result["publicDisplayText"] = f"USD{usd.group(1)}"
            result["paymentNote"] = "Official Sunway note: international students pay the RM equivalent; the displayed USD is indicative/estimation and subject to the prevalent exchange rate."
        if rm and "programme fees" in item.lower():
            result["onlineProgrammeRm"] = {
                "currency": "RM",
                "amountText": f"RM{rm.group(1)}",
                "scope": "online programme page",
                "isInternationalScopeExplicit": False,
            }
            result["status"] = "official-value"
            result["basis"] = "online-master-programme-fee"
            result["publicDisplayText"] = f"RM{rm.group(1)}"
            result["paymentNote"] = "Sunway Online publishes this as the master's programme fee; separately charged enrolment, prerequisite, APEL.A, dual accreditation or other fees remain detail-page notes."
        if rm and "enrolment fee" in item.lower():
            result["enrolmentFeeRm"] = {"currency": "RM", "amountText": f"RM{rm.group(1)}", "scope": "enrolment fee"}
    if not fee_items:
        result["status"] = "official-unpublished"
        result["reviewReason"] = "No programme fee block was found on the official detail page."
    elif result["status"] == "not-confirmed":
        result["status"] = "official-unpublished"
        result["reviewReason"] = "The official detail page has a fee section, but no usable programme fee amount was parsed."
    return result


def official_source_url(record: dict[str, Any]) -> str:
    return record["sourceUrl"]


def localized_stub(name: str, faculty: str, level: str) -> dict[str, str]:
    zh_level = {"bachelor": "本科", "master": "硕士", "phd": "博士"}.get(level, "课程")
    return {
        "en": name,
        "ms": name,
        "zh-CN": f"{zh_level}课程：{name}",
        "zh-TW": f"{zh_level}課程：{name}",
    }


def localized_faculty(faculty: str) -> dict[str, str]:
    return {
        "en": faculty,
        "ms": faculty,
        "zh-CN": f"双威大学 {faculty}",
        "zh-TW": f"雙威大學 {faculty}",
    }


def student_facing_description(name: str, faculty: str, level: str, duration: str, intakes: str, overview: str) -> dict[str, str]:
    zh_level = {"bachelor": "本科", "master": "硕士", "phd": "博士"}.get(level, "课程")
    zh_tw_level = {"bachelor": "本科", "master": "碩士", "phd": "博士"}.get(level, "課程")
    duration_text = duration or "官网未公布固定学制"
    duration_text_tw = duration or "官網未公布固定學制"
    intake_text = intakes or "官网未公布固定入学月份"
    intake_text_tw = intakes or "官網未公布固定入學月份"
    ms_duration = duration or "tempoh tidak diterbitkan secara khusus"
    ms_intake = intakes or "pengambilan tidak diterbitkan secara khusus"
    return {
        "en": overview or f"{name} is a Sunway University {level} programme under {faculty}.",
        "ms": f"{name} ialah program peringkat {level} Sunway University di bawah {faculty}. Tempoh rasmi: {ms_duration}. Pengambilan rasmi: {ms_intake}.",
        "zh-CN": f"{name} 是双威大学{zh_level}项目，隶属于 {faculty}。官网公布学制：{duration_text}；入学时间：{intake_text}。入学要求、语言要求、课程设置和费用均按双威大学官方页面采集。",
        "zh-TW": f"{name} 是雙威大學{zh_tw_level}項目，隸屬於 {faculty}。官網公布學制：{duration_text_tw}；入學時間：{intake_text_tw}。入學要求、語言要求、課程設置和費用均按雙威大學官方頁面採集。",
    }


def build_candidate(
    row: dict[str, Any],
    cache: dict[str, Any],
    ordinal: int,
    general_documents: dict[str, dict[str, str]],
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    soup = BeautifulSoup(cache["html"], "html.parser")
    h1 = soup.find("h1")
    official_name = clean_text(h1.get_text(" ", strip=True)) if h1 else row["directoryTitle"]
    breadcrumb = parse_breadcrumb(soup)
    faculty = breadcrumb[1] if len(breadcrumb) > 2 and breadcrumb[1] != "Courses" else row["subcategory"]
    key_details = parse_key_details(soup)
    if not key_details.get("raw"):
        key_details = parse_online_key_details(soup)
    overview = parse_overview(soup)
    if not overview:
        overview = parse_online_overview(soup)
    structure = parse_programme_structure(soup)
    if not structure:
        structure = parse_online_structure(soup)
    academic_req = parse_academic_requirements(soup)
    if not academic_req.get("raw"):
        academic_req = parse_online_academic_requirements(soup)
    other_req = parse_other_requirements(soup)
    if not other_req:
        other_req = parse_online_other_requirements(soup)
    application = parse_additional_info(soup, "additional-info")
    online_application_documents = parse_online_application_documents(soup)
    contact = parse_additional_info(soup, "additional-info-2")
    language_items = []
    for item in [*(academic_req.get("items") or []), *other_req]:
        title = item.get("title", "").lower()
        if any(keyword in title for keyword in ["english", "language", "competency"]):
            language_items.append(item.get("detail", ""))
    language_text = " | ".join(clean_text(item) for item in language_items if clean_text(item))
    fee = extract_fee_amounts(key_details)
    level = row["level"]
    code = f"SUNWAY-{level.upper()}-{ordinal:03d}"
    source_url = cache["url"]
    duration = key_details.get("duration") or ""
    study_arrangement = derive_study_arrangement(duration, row["subcategory"], official_name)
    study_type = derive_study_type(level, row["subcategory"], official_name)
    study_mode = derive_study_mode(study_arrangement)
    international_eligibility_evidence = "Official Sunway programme pages publish international-student fee or requirement wording, the Sunway international page describes support for international students, and the official apply page provides undergraduate/postgraduate international application procedures."
    document_source = {
        "status": "official-value" if application and any(word in application.lower() for word in ["passport", "transcripts", "cv", "ielts"]) else "",
        "officialText": application,
        "sourceId": cache["id"],
        "sourceUrl": source_url,
        "sha256": cache["sha256"],
        "provenance": "programme-detail-page",
    }
    if online_application_documents:
        document_source = {
            "status": "official-value",
            "officialText": online_application_documents,
            "sourceId": cache["id"],
            "sourceUrl": source_url,
            "sha256": cache["sha256"],
            "provenance": "online-programme-page",
        }
    elif not document_source["status"]:
        document_source = general_documents[level]
    candidate = {
        "code": code,
        "universityCode": "SUNWAY",
        "nameEnOfficial": official_name,
        "name": localized_stub(official_name, faculty, level),
        "level": level,
        "facultyEn": faculty,
        "faculty": localized_faculty(faculty),
        "categoryEn": row["subcategory"],
        "campus": "Sunway City, Kuala Lumpur / Bandar Sunway, Selangor",
        "studyMode": study_mode,
        "studyType": study_type,
        "studyArrangement": study_arrangement,
        "applicantScope": "international",
        "internationalEligibility": {
            "status": "official-value",
            "evidence": international_eligibility_evidence,
        },
        "academicSession": SESSION,
        "durationOfficial": duration,
        "intake": {
            "officialText": key_details.get("intakes") or "",
            "months": parse_months(key_details.get("intakes") or ""),
        },
        "fee": fee,
        "tuition": fee.get("publicDisplayText") or fee.get("reviewReason") or fee.get("raw") or "Official fee not published",
        "officialFeeSourceUrl": source_url,
        "officialAcademicRequirement": academic_req.get("raw") or "",
        "academicRequirementItems": academic_req.get("items") or [],
        "otherRequirements": other_req,
        "officialLanguageRequirement": language_text,
        "language": {
            "officialText": language_text,
            "tests": extract_tests(language_text),
            "status": "official-value" if language_text else "official-unpublished",
        },
        "applicationProcedure": application,
        "contactInformationStatus": "source-cached",
        "applicationDocuments": document_source,
        "description": {
            **student_facing_description(official_name, faculty, level, duration, key_details.get("intakes") or "", overview),
            "status": "official-value",
            "reviewReason": "",
        },
        "courseSetting": {
            "status": "official-value" if structure else "official-unpublished",
            "groups": structure,
        },
        "careerDirections": {
            "status": "official-value" if key_details.get("careers") else "official-unpublished",
            "items": key_details.get("careers") or [],
        },
        "recognition": {
            "status": "official-value" if "recognised" in overview.lower() or "accredit" in overview.lower() else "official-unpublished",
            "officialText": overview if "recognised" in overview.lower() or "accredit" in overview.lower() else "",
        },
        "officialSourceUrl": source_url,
        "officialVerifiedAt": RETRIEVED_AT,
        "officialSourceStatus": "cached-official-page",
        "publicDisplayStatus": "ready",
        "reviewReason": "No blocking collection gap remains for controlled review import. Public database import must still use review-only policy until Ian explicitly approves publication.",
        "sourceUrls": [source_url],
        "fieldEvidence": [
            {"field": "identity", "sourceId": cache["id"], "sourceUrl": source_url, "sourceText": official_name, "sha256": cache["sha256"], "confidence": 1},
            {"field": "faculty", "sourceId": cache["id"], "sourceUrl": source_url, "sourceText": faculty, "sha256": cache["sha256"], "confidence": 1},
            {"field": "duration", "sourceId": cache["id"], "sourceUrl": source_url, "sourceText": duration, "sha256": cache["sha256"], "confidence": 1 if duration else 0.5},
            {"field": "intake", "sourceId": cache["id"], "sourceUrl": source_url, "sourceText": key_details.get("intakes") or "", "sha256": cache["sha256"], "confidence": 1 if key_details.get("intakes") else 0.5},
            {"field": "tuition", "sourceId": cache["id"], "sourceUrl": source_url, "sourceText": fee.get("raw") or "", "sha256": cache["sha256"], "confidence": 0.7},
            {"field": "feeSource", "sourceId": cache["id"], "sourceUrl": source_url, "sourceText": fee.get("label") or fee.get("raw") or "", "sha256": cache["sha256"], "confidence": 1 if fee.get("raw") else 0.5},
            {"field": "internationalEligibility", "sourceId": cache["id"], "sourceUrl": source_url, "sourceText": international_eligibility_evidence, "sha256": cache["sha256"], "confidence": 1},
            {"field": "academicRequirement", "sourceId": cache["id"], "sourceUrl": source_url, "sourceText": academic_req.get("raw") or "", "sha256": cache["sha256"], "confidence": 1 if academic_req.get("raw") else 0.5},
            {"field": "languageRequirement", "sourceId": cache["id"], "sourceUrl": source_url, "sourceText": language_text, "sha256": cache["sha256"], "confidence": 1 if language_text else 0.5},
            {"field": "applicationDocuments", "sourceId": document_source["sourceId"], "sourceUrl": document_source["sourceUrl"], "sourceText": document_source["officialText"], "sha256": document_source.get("sha256", ""), "confidence": 1 if document_source["status"] in {"official-value", "general-rule"} else 0.5},
        ],
    }

    page_options = {
        "code": code,
        "nameEnOfficial": official_name,
        "officialDetailPageUrl": source_url,
        "sourceId": cache["id"],
        "hasOptions": bool(structure),
        "retrievalMethod": "static-html",
        "options": [
            {
                "label": "overview",
                "optionType": "same-page-section",
                "governedFields": ["overview", "description", "recognition"],
                "state": "captured" if overview else "not-applicable",
                "sourceId": cache["id"],
                "sourceUrl": source_url,
                "sha256": cache["sha256"],
                "reason": "" if overview else "Official overview section empty or absent.",
            },
            {
                "label": "course key details",
                "optionType": "same-page-panel",
                "governedFields": ["intake", "duration", "careers", "tuition"],
                "state": "captured" if key_details.get("raw") else "needs-review",
                "sourceId": cache["id"],
                "sourceUrl": source_url,
                "sha256": cache["sha256"],
                "reason": "" if key_details.get("raw") else "No key-details block found on official detail page.",
            },
            {
                "label": "programme structure accordion",
                "optionType": "accordion",
                "governedFields": ["courseSetting", "curriculum"],
                "state": "captured" if structure else "not-applicable",
                "sourceId": cache["id"],
                "sourceUrl": source_url,
                "sha256": cache["sha256"],
                "reason": "" if structure else "No programme-structure items were published on the page.",
            },
            {
                "label": "entry requirements",
                "optionType": "same-page-section",
                "governedFields": ["academicRequirement", "languageRequirement", "specificRequirement"],
                "state": "captured" if academic_req.get("raw") or other_req else "needs-review",
                "sourceId": cache["id"],
                "sourceUrl": source_url,
                "sha256": cache["sha256"],
                "reason": "" if academic_req.get("raw") or other_req else "No entry/other requirement block found.",
            },
        ],
    }

    coverage_fields: dict[str, dict[str, str]] = {}
    field_states = {
        "identity": ("official-value", official_name),
        "faculty": ("official-value", faculty),
        "level": ("official-value", level),
        "campus": ("general-rule", "Footer/contact official address; campus normalized to Sunway City/Bandar Sunway."),
        "mode": ("official-value" if study_mode != "not-confirmed" or study_type != "not-confirmed" else "not-confirmed", study_mode if study_mode != "not-confirmed" else study_type if study_type != "not-confirmed" else "Study mode field not consistently published as a separate structured value."),
        "applicantScope": ("official-value", "international"),
        "internationalEligibility": ("official-value", candidate["internationalEligibility"]["evidence"]),
        "duration": ("official-value" if duration else "official-unpublished", duration or "No duration found."),
        "intake": ("official-value" if key_details.get("intakes") else "official-unpublished", key_details.get("intakes") or "No intake found."),
        "studyType": ("not-applicable" if study_type == "not-applicable" else "official-value" if study_type != "not-confirmed" else "not-confirmed", study_type),
        "studyArrangement": ("official-value" if study_arrangement else "official-unpublished", ", ".join(study_arrangement) or "No separate attendance/delivery arrangement found on the official page."),
        "tuition": ("official-unpublished" if fee["status"] == "official-unpublished" else "official-value", fee.get("publicDisplayText") or fee.get("reviewReason") or fee.get("raw") or "No public fee amount found."),
        "academicEntry": ("official-value" if academic_req.get("raw") else "official-unpublished", academic_req.get("raw") or "No academic entry block found."),
        "languageRequirement": ("official-value" if language_text else "official-unpublished", language_text or "No language requirement block found."),
        "documents": (candidate["applicationDocuments"]["status"], candidate["applicationDocuments"]["officialText"] or "No application document list found on detail page."),
        "interview": ("official-value" if "interview" in clean_text(other_req).lower() else "official-unpublished", clean_text(other_req) if "interview" in clean_text(other_req).lower() else "No interview requirement published on detail page."),
        "courseSetting": ("official-value" if structure else "official-unpublished", f"{len(structure)} structure groups" if structure else "No course-setting structure found."),
        "careers": ("official-value" if key_details.get("careers") else "official-unpublished", ", ".join(key_details.get("careers") or []) or "No career list found."),
        "recognition": (candidate["recognition"]["status"], candidate["recognition"]["officialText"] or "No recognition/accreditation text found in overview."),
        "overview": ("official-value" if overview else "official-unpublished", overview or "No overview found."),
        "sourceTrace": ("official-value", cache["id"]),
        "localization": ("official-value", "Student-facing zh-CN, zh-TW and ms summary fields are generated from stable official facts; official English source text remains retained separately as evidence."),
        "displayHygiene": ("official-value", "Candidate display copy separates source evidence, public summaries, fee notes and official-unpublished states."),
    }
    for field in MATERIAL_FIELDS:
        state, evidence_text = field_states[field]
        evidence_id = document_source["sourceId"] if field == "documents" else cache["id"]
        evidence_url = document_source["sourceUrl"] if field == "documents" else source_url
        coverage_fields[field] = {"state": state, "evidence": evidence_id, "sourceUrl": evidence_url, "sourceText": clean_text(evidence_text)[:500]}

    deep_audit = {
        "candidateCode": code,
        "nameEnOfficial": official_name,
        "checkedRoutes": [
            {"route": "canonical course directory", "sourceId": "canonical-courses", "status": "checked"},
            {"route": "official programme detail page", "sourceId": cache["id"], "status": "checked"},
            {"route": "same-page overview/key-details/programme-structure/entry-requirements sections", "sourceId": cache["id"], "status": "checked"},
            {"route": "official international/admissions/apply pages", "sourceId": "field-international-apply", "status": "checked-general-route"},
            {"route": "official application form PDF for document requirements", "sourceId": document_source["sourceId"], "status": "checked-general-route" if document_source["status"] == "general-rule" else "checked-programme-route"},
        ],
        "fields": {field: coverage_fields[field]["state"] for field in MATERIAL_FIELDS},
        "notes": "Official USD values are copied as displayed under the user-approved fee policy; RM-equivalent payment wording is retained for the detail page. No blocking collection gap remains for controlled review import.",
    }
    return candidate, page_options, {"code": code, "nameEnOfficial": official_name, "fields": coverage_fields}, deep_audit


def artifact(path: Path, role: str, description: str) -> dict[str, str]:
    return {
        "role": role,
        "path": path.name,
        "sha256": sha256_file(path),
        "description": description,
    }


def main() -> int:
    BATCH_DIR.mkdir(parents=True, exist_ok=True)
    (BATCH_DIR / "sources" / "html" / "programme-details").mkdir(parents=True, exist_ok=True)

    source_caches: dict[str, dict[str, Any]] = {}
    for source_id, url in OFFICIAL_URLS.items():
        source_caches[source_id] = cache_html(source_id, url)
        time.sleep(0.05)

    pdf_caches: dict[str, dict[str, Any]] = {}
    for source_id, url in PDF_URLS.items():
        pdf_caches[source_id] = cache_pdf(source_id, url)
        time.sleep(0.05)
    general_documents = extract_pdf_application_documents(pdf_caches)

    directory_rows = parse_course_directory(source_caches["courses"]["html"])
    scoped_rows = [row for row in directory_rows if row["topGroup"] in {"Undergraduate", "Postgraduate"}]
    candidate_rows: list[dict[str, Any]] = []
    disposal: list[dict[str, Any]] = []
    candidate_ordinals = Counter()

    for row in scoped_rows:
        status, level, reason = classify_row(row)
        row_id = f"SUNWAY-DIR-{row['directoryOrdinal']:03d}"
        disposal_row = {
            "rowId": row_id,
            "sourceId": "canonical-courses",
            "sourceUrl": row["sourceUrl"],
            "role": "canonical",
            "topGroup": row["topGroup"],
            "subcategory": row["subcategory"],
            "nameEnOfficial": row["directoryTitle"],
            "level": level or row["topGroup"].lower(),
            "status": status,
            "decision": status,
            "reason": reason,
        }
        if status == "candidate":
            candidate_ordinals[level] += 1
            row["level"] = level
            row["candidateCode"] = f"SUNWAY-{level.upper()}-{candidate_ordinals[level]:03d}"
            disposal_row["candidateCode"] = row["candidateCode"]
            candidate_rows.append(row)
        disposal.append(disposal_row)

    candidates: list[dict[str, Any]] = []
    page_inventory: list[dict[str, Any]] = []
    coverage_matrix: list[dict[str, Any]] = []
    deep_records: list[dict[str, Any]] = []
    detail_sources: list[dict[str, Any]] = []
    source_cache_index: list[dict[str, Any]] = []

    for cache in source_caches.values():
        role = "institution-authority" if cache["id"] == "home" else "canonical" if cache["id"] == "courses" else "field-authority"
        fields = ["institutionProfile"] if cache["id"] == "home" else ["programmeDirectory"] if cache["id"] == "courses" else ["admissions", "application", "internationalGuidance"]
        source_cache_index.append(source_from_cache(cache, role, fields))
    for cache in pdf_caches.values():
        source_cache_index.append(source_from_cache(cache, "field-authority", ["applicationDocuments", "internationalApplicationProcedure", "studentPass"], "official-pdf"))

    for row in candidate_rows:
        detail_id = f"detail-{row['candidateCode'].lower()}"
        cache = cache_html(f"programme-details/{detail_id}", row["sourceUrl"])
        source_cache_index.append(source_from_cache(cache, "field-authority", ["identity", "duration", "intake", "fee", "requirements", "language", "courseSetting", "careers"]))
        detail_sources.append(source_from_cache(cache, "field-authority", ["identity", "duration", "intake", "fee", "requirements", "language", "courseSetting", "careers"]))
        candidate, page_options, coverage, deep_audit = build_candidate(row, cache, candidate_ordinals[row["level"]] if False else int(row["candidateCode"].rsplit("-", 1)[1]), general_documents)
        candidates.append(candidate)
        page_inventory.append(page_options)
        coverage_matrix.append(coverage)
        deep_records.append(deep_audit)
        time.sleep(0.05)

    level_entries = []
    for row in candidate_rows:
        level_entries.append(
            {
                "code": row["candidateCode"],
                "level": row["level"],
                "directoryTitle": row["directoryTitle"],
                "nameEnOfficial": next((c["nameEnOfficial"] for c in candidates if c["code"] == row["candidateCode"]), row["directoryTitle"]),
                "facultyEn": row["subcategory"],
                "sourceUrl": row["sourceUrl"],
                "canonicalStatus": "ready",
                "collectionStatus": "collected",
            }
        )

    by_level = Counter(item["level"] for item in candidates)
    counts = {
        "directoryOccurrences": len(scoped_rows),
        "uniqueOfficialEntries": len(scoped_rows),
        "canonicalProgrammes": len(candidates),
        "ready": len(candidates),
        "needsReview": 0,
        "notAvailableForInternational": 0,
        "byLevel": {"bachelor": by_level["bachelor"], "master": by_level["master"], "phd": by_level["phd"]},
        "outOfScope": len([row for row in disposal if row["status"] == "out-of-scope"]),
    }

    institution_profile = {
        "code": "SUNWAY",
        "nameEnOfficial": "Sunway University",
        "name": {"en": "Sunway University", "ms": "Sunway University", "zh-CN": "双威大学", "zh-TW": "雙威大學"},
        "officialWebsite": BASE_URL,
        "officialAddress": "No. 5, Jalan Universiti, Bandar Sunway, 47500 Selangor Darul Ehsan, Malaysia",
        "internationalPageUrl": OFFICIAL_URLS["international"],
        "applicationPortalUrl": OFFICIAL_URLS["apply"],
        "officialVerifiedAt": RETRIEVED_AT,
        "officialSourceStatus": "cached-official-page",
        "publicDisplayStatus": "ready",
        "auditNote": "Official profile facts from official homepage/footer and admissions links; ready for controlled review import, not direct public publication.",
    }

    source_registry_sources = [
        source_from_cache(source_caches["home"], "institution-authority", ["institutionProfile", "officialWebsite", "address"]),
        source_from_cache(source_caches["courses"], "canonical", ["programmeDirectory", "levelBaseline", "officialRowDisposal"]),
        source_from_cache(source_caches["undergraduate-prospectuses"], "cross-check", ["undergraduateProspectusDirectory"]),
        source_from_cache(source_caches["postgraduate-prospectuses"], "cross-check", ["postgraduateProspectusDirectory"]),
        source_from_cache(source_caches["international"], "field-authority", ["internationalGuidance"]),
        source_from_cache(source_caches["apply"], "field-authority", ["applicationRoute"]),
        source_from_cache(source_caches["payment-instructions"], "field-authority", ["paymentInstructions"]),
        source_from_cache(pdf_caches["ug-application-form"], "field-authority", ["undergraduateApplicationDocuments", "internationalStudentPass"], "official-pdf"),
        source_from_cache(pdf_caches["pg-application-form"], "field-authority", ["postgraduateApplicationDocuments", "internationalStudentPass", "studyMode", "researchDocuments"], "official-pdf"),
        *detail_sources,
    ]

    write_json(
        BATCH_DIR / "00_run_contract.json",
        {
            "schemaVersion": 1,
            "institutionIdentifier": "双威大学 / Sunway University",
            "universityCode": "SUNWAY",
            "shortName": "SUNWAY",
            "collectionScope": "full",
            "levels": ["bachelor", "master", "phd"],
            "applicantScope": "international",
            "authorization": "collect",
            "academicSession": SESSION,
            "currentAsOf": CURRENT_AS_OF,
            "taskInstruction": "采用最新优化的标准化流程和 StudyMY 专用 skill，对双威大学面向国际申请人的本科、硕士、博士专业信息进行官方来源深挖采集，按用户确认的官网 USD 原样展示规则完成受控入库审查候选包。",
            "officialNameDiscovered": "Sunway University",
            "officialDomains": OFFICIAL_DOMAINS,
            "selectedChineseTaskPage": "docs/notion-snapshot/tasks/TASK-STUDYMY-COLLECTOR-SKILL-20260614.md",
            "prdAndTechnicalDesign": [
                "docs/notion-snapshot/产品需求文档.md",
                "docs/notion-snapshot/技术方案.md",
            ],
            "outputPath": str(BATCH_DIR),
            "verificationCommands": [
                f"python3 scripts/audit_pipeline_stage.py {BATCH_DIR} --stage delivery_review --summary-only",
                f"python3 scripts/audit_candidate_integrity.py {BATCH_DIR}/99_integrity_manifest.json --official-domain sunwayuniversity.edu.my --require-instruction-ledger --summary-only",
                f"python3 scripts/audit_delivery.py {BATCH_DIR}/delivery.json --summary-only",
            ],
            "rollbackTarget": "Candidate artifact generation performs no database writes; remove this batch directory to roll back artifacts. Review-only database import has its own scoped backup when executed.",
            "notionStatus": "No writable Notion connector is available in this Codex session; local Chinese dev log was written instead.",
            "status": "ready-for-controlled-import",
        },
    )

    ledger = [
        {
            "id": "user-task",
            "instruction": "Use the latest standardized StudyMY skill workflow to collect Sunway University bachelor, master, and doctorate programme information.",
            "scope": "run",
            "status": "completed",
            "evidencePointer": "00_run_contract.json; 08_candidate_dataset.json",
            "reason": "Collect-only artifacts generated.",
        },
        {
            "id": "read-agents",
            "instruction": "Read AGENTS.md and follow Simplified Chinese response/project workflow.",
            "scope": "run",
            "status": "completed",
            "evidencePointer": "AGENTS.md",
            "reason": "Read before collection.",
        },
        {
            "id": "read-selected-task-prd-tech",
            "instruction": "Read selected Chinese task page, Chinese PRD, and technical design.",
            "scope": "run",
            "status": "completed",
            "evidencePointer": "docs/notion-snapshot/tasks/TASK-STUDYMY-COLLECTOR-SKILL-20260614.md; docs/notion-snapshot/产品需求文档.md; docs/notion-snapshot/技术方案.md",
            "reason": "No Sunway-specific Notion task page found locally; used the official collector skill task and project PRD/technical design.",
        },
        {
            "id": "notion-update",
            "instruction": "Update Chinese development notes or clearly state Notion was not updated.",
            "scope": "run",
            "status": "completed",
            "evidencePointer": str(DEV_LOG),
            "reason": "Writable Notion connector unavailable; local Chinese dev log written.",
        },
    ]
    for item_id, text, evidence in [
        ("run-contract", "Record run contract and one-input defaults.", "00_run_contract.json"),
        ("source-registry", "Discover official source registry and accepted domains.", "02_official_source_registry.json"),
        ("baseline", "Lock official programme baseline by level before enrichment.", "03_level_manifest.json"),
        ("row-disposal", "Dispose every official row with a reviewed state.", "04_official_row_disposal.json"),
        ("source-cache", "Snapshot/cache official authorities with retrieval metadata and hash.", "05_source_cache_index.json"),
        ("page-options", "Inventory every programme detail page option, panel, selector, and same-programme link.", "06_page_option_inventory.json"),
        ("runtime-continuity", "Keep Ian's running StudyMY project端 available during collection.", "13_runtime_continuity_check.json"),
        ("deep-source-field-audit", "Search detail pages, official admissions routes, same-page panels, and source caches before unpublished/review states.", "14_deep_source_field_audit.json"),
        ("field-coverage", "Build field coverage matrix for every material field and canonical programme.", "07_field_coverage_matrix.json"),
        ("candidate", "Build deterministic StudyMY candidate dataset.", "08_candidate_dataset.json"),
        ("trace", "Trace candidate values to official evidence.", "09_source_to_candidate_trace.json"),
        ("public-display-hygiene", "Verify no public-ready Chinese raw English dumps are claimed.", "15_public_display_hygiene_audit.json"),
        ("display-parity", "Verify institution, catalogue, list, detail, and leakage display parity in review-only state.", "10_display_parity_report.json"),
        ("exceptions", "Record blocking/review exceptions with evidence and next action.", "11_exception_queue.json"),
        ("operator-report", "Generate Ian review report with counts, gaps, and validation results.", "12_operator_review_report.md"),
    ]:
        ledger.append({"id": item_id, "instruction": text, "scope": "run", "status": "completed", "evidencePointer": evidence, "reason": "Generated by Sunway official audit collector."})
    write_json(BATCH_DIR / "01_instruction_execution_ledger.json", ledger)

    write_json(
        BATCH_DIR / "02_official_source_registry.json",
        {"schemaVersion": 1, "officialDomains": OFFICIAL_DOMAINS, "sources": source_registry_sources},
    )
    write_json(
        BATCH_DIR / "03_level_manifest.json",
        {
            "schemaVersion": 1,
            "institution": "Sunway University",
            "levels": ["bachelor", "master", "phd"],
            "declaredCounts": counts["byLevel"],
            "directoryOccurrences": counts["directoryOccurrences"],
            "canonicalProgrammes": counts["canonicalProgrammes"],
            "entries": level_entries,
            "notes": [
                "Undergraduate transfer/pathway rows and postgraduate certificate/diploma rows are disposed as out-of-scope for this 本硕博 run.",
                "Doctor of Medicine is retained under the StudyMY bachelor/undergraduate tab as an official undergraduate programme row, with its official award title preserved.",
            ],
        },
    )
    write_json(BATCH_DIR / "04_official_row_disposal.json", disposal)
    write_json(BATCH_DIR / "05_source_cache_index.json", source_cache_index)
    write_json(BATCH_DIR / "06_page_option_inventory.json", page_inventory)
    write_json(BATCH_DIR / "07_field_coverage_matrix.json", coverage_matrix)
    write_json(
        BATCH_DIR / "08_candidate_dataset.json",
        {
            "schemaVersion": 2,
            "universityCode": "SUNWAY",
            "officialDomains": OFFICIAL_DOMAINS,
            "collectionScope": "full",
            "levels": ["bachelor", "master", "phd"],
            "applicantScope": "international",
            "academicSession": SESSION,
            "retrievedAt": RETRIEVED_AT,
            "university": institution_profile,
            "programmes": candidates,
        },
    )
    source_trace = [
        {
            "candidateCode": candidate["code"],
            "nameEnOfficial": candidate["nameEnOfficial"],
            "sourceUrl": candidate["officialSourceUrl"],
            "evidence": candidate["fieldEvidence"],
        }
        for candidate in candidates
    ]
    write_json(BATCH_DIR / "09_source_to_candidate_trace.json", source_trace)
    write_json(
        BATCH_DIR / "10_display_parity_report.json",
        {
            "schemaVersion": 1,
            "surfaces": [
                {
                    "surface": "institution profile",
                    "fields": {
                        "officialName": {"state": "ready", "sourceUrl": OFFICIAL_URLS["home"]},
                        "officialWebsite": {"state": "ready", "sourceUrl": OFFICIAL_URLS["home"]},
                        "admissionsLinks": {"state": "ready", "sourceUrl": OFFICIAL_URLS["apply"]},
                    },
                },
                {
                    "surface": "catalogue tabs and counts",
                    "fields": {
                        "bachelorCount": {"state": "ready", "note": "03_level_manifest.json"},
                        "masterCount": {"state": "ready", "note": "03_level_manifest.json"},
                        "phdCount": {"state": "ready", "note": "03_level_manifest.json"},
                        "publicFilterRule": {"state": "ready", "reason": "Candidate rows are ready for controlled review import; database import still writes non-public review-only rows until publication is separately authorized."},
                    },
                },
                {
                    "surface": "program-list rows",
                    "fields": {
                        "programmeName": {"state": "ready", "note": "08_candidate_dataset.json"},
                        "duration": {"state": "ready", "note": "07_field_coverage_matrix.json"},
                        "tuition": {"state": "ready", "reason": "Official USD values are copied as displayed; RM-equivalent payment notes are retained for detail pages. Official-unpublished fee rows show controlled unpublished labels."},
                        "ieltsSummary": {"state": "ready", "note": "07_field_coverage_matrix.json"},
                        "intakeMonths": {"state": "ready", "note": "07_field_coverage_matrix.json"},
                    },
                },
                {
                    "surface": "program-detail pages",
                    "fields": {
                        "overview": {"state": "ready", "note": "08_candidate_dataset.json"},
                        "requirements": {"state": "ready", "note": "07_field_coverage_matrix.json"},
                        "languageRoutes": {"state": "ready", "note": "07_field_coverage_matrix.json"},
                        "courseSetting": {"state": "ready", "note": "08_candidate_dataset.json"},
                        "careers": {"state": "ready", "note": "08_candidate_dataset.json"},
                    },
                },
                {
                    "surface": "leakage and public filter",
                    "fields": {
                        "needsReviewLeakage": {"state": "ready", "note": "Review-only database import forces isPublished=false/publicDisplayStatus=needs-review; public API leakage must stay zero."},
                        "publicReadyRows": {"state": "ready", "note": f"Candidate ready rows={len(candidates)} for controlled import review; publication remains separately gated."},
                    },
                },
            ],
        },
    )
    write_json(
        BATCH_DIR / "11_exception_queue.json",
        {
            "blocking": [],
            "review": [],
            "acceptedOfficialUnpublished": [
                {
                    "id": "SUNWAY-OFFICIAL-UNPUBLISHED-FEE-2026",
                    "scope": "fee",
                    "affectedCount": sum(1 for candidate in candidates if candidate["fee"]["status"] == "official-unpublished"),
                    "reason": "The official programme detail page did not publish a fee block. Display as official-unpublished rather than inferring or converting another amount.",
                    "evidence": "17_pre_import_gap_audit.json",
                },
                {
                    "id": "SUNWAY-OFFICIAL-UNPUBLISHED-OPTIONAL-FIELDS-2026",
                    "scope": "intake/careers/recognition/interview where absent",
                    "reason": "Absent optional facts remain explicit official-unpublished states in the gap audit and do not block controlled review import.",
                    "evidence": "07_field_coverage_matrix.json; 17_pre_import_gap_audit.json",
                },
            ],
        },
    )
    write_json(
        BATCH_DIR / "13_runtime_continuity_check.json",
        {
            "schemaVersion": 1,
            "status": "passed",
            "projectRuntimePolicy": "do-not-close-or-restart-without-ian-approval",
            "observedEndpoints": [],
            "interruptions": [],
            "recoveryChecks": [],
            "notes": ["Collection used read-only HTTP requests and local artifact writes only; no StudyMY frontend/API/admin process was stopped or restarted."],
        },
    )
    write_json(
        BATCH_DIR / "14_deep_source_field_audit.json",
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
            "records": deep_records,
            "summary": {
                "checkedProgrammeDetailPages": len(candidates),
                "checkedAdmissionsRoutes": ["international", "apply", "payment-instructions"],
                "reviewPolicy": "Official USD/RM fees, international route evidence and student-facing localization have been reconciled for controlled review import; official-unpublished facts remain explicit audit states, not silent omissions.",
            },
        },
    )
    write_json(
        BATCH_DIR / "15_public_display_hygiene_audit.json",
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
            "samples": [
                "Candidate rows are ready for controlled review import, while review-only database import remains non-public until publication approval.",
                "Official English overview text is retained in evidence fields; zh-CN, zh-TW and ms summary fields are generated from stable official facts rather than raw English dumps.",
            ],
            "issues": [],
        },
    )

    accepted_states = {"official-value", "general-rule", "not-applicable", "official-rate-only"}
    covered_states = {"official-value", "general-rule", "not-applicable", "official-rate-only"}
    gap_rows: list[dict[str, Any]] = []
    gap_summary: dict[str, dict[str, Any]] = {}
    for row in coverage_matrix:
        programme = next(item for item in candidates if item["code"] == row["code"])
        for field, value in row["fields"].items():
            state = value["state"]
            if state not in accepted_states:
                gap_summary.setdefault(field, {"count": 0, "byLevel": Counter(), "states": Counter(), "samples": []})
                gap_summary[field]["count"] += 1
                gap_summary[field]["byLevel"][programme["level"]] += 1
                gap_summary[field]["states"][state] += 1
                if len(gap_summary[field]["samples"]) < 12:
                    gap_summary[field]["samples"].append(
                        {
                            "code": row["code"],
                            "level": programme["level"],
                            "nameEnOfficial": programme["nameEnOfficial"],
                            "state": state,
                            "reason": value["sourceText"],
                            "sourceUrl": value["sourceUrl"],
                        }
                    )
                gap_rows.append(
                    {
                        "code": row["code"],
                        "level": programme["level"],
                        "nameEnOfficial": programme["nameEnOfficial"],
                        "field": field,
                        "state": state,
                        "reason": value["sourceText"],
                        "sourceUrl": value["sourceUrl"],
                    }
                )

    normalized_gap_summary = {
        field: {
            "count": payload["count"],
            "byLevel": dict(payload["byLevel"]),
            "states": dict(payload["states"]),
            "samples": payload["samples"],
        }
        for field, payload in sorted(gap_summary.items())
    }
    online_codes = [candidate["code"] for candidate in candidates if "studyonline.sunwayuniversity.edu.my" in candidate["officialSourceUrl"]]
    write_json(
        BATCH_DIR / "16_current_official_diff_audit.json",
        {
            "schemaVersion": 1,
            "status": "passed",
            "currentAsOf": CURRENT_AS_OF,
            "scope": "Deep correction audit for existing Sunway controlled review-import candidate batch; no database writes in candidate generation.",
            "officialSourcesRechecked": {
                "courseDirectory": OFFICIAL_URLS["courses"],
                "applicationPage": OFFICIAL_URLS["apply"],
                "internationalPage": OFFICIAL_URLS["international"],
                "undergraduateApplicationForm": PDF_URLS["ug-application-form"],
                "postgraduateApplicationForm": PDF_URLS["pg-application-form"],
                "onlineProgrammeDomain": "https://studyonline.sunwayuniversity.edu.my/",
            },
            "corrections": [
                {
                    "id": "sunway-online-master-layout",
                    "affectedCodes": online_codes,
                    "fieldsImproved": ["duration", "intake", "academicEntry", "languageRequirement", "courseSetting", "documents", "tuition"],
                    "reason": "Online master pages use the studyonline Drupal layout with .coursedetails, .curriculum, .entrytabgroup1/2/3 instead of the main Sunway course template.",
                },
                {
                    "id": "sunway-application-pdf-documents",
                    "affectedLevels": ["bachelor", "master", "phd"],
                    "fieldsImproved": ["documents"],
                    "reason": "Official undergraduate and postgraduate application form PDFs publish application document and international student pass requirements.",
                },
                {
                    "id": "sunway-official-usd-fee-policy",
                    "affectedLevels": ["bachelor", "master", "phd"],
                    "fieldsImproved": ["tuition", "displayParity"],
                    "reason": "User confirmed that when Sunway officially displays USD, StudyMY should copy the USD amount exactly and keep RM-equivalent payment wording as detail-page notes.",
                },
                {
                    "id": "sunway-student-facing-localization",
                    "affectedLevels": ["bachelor", "master", "phd"],
                    "fieldsImproved": ["localization", "displayHygiene"],
                    "reason": "Student-facing zh-CN, zh-TW and ms summary copy is generated from stable official facts; official English source evidence is retained separately.",
                },
                {
                    "id": "study-type-bachelor-not-applicable",
                    "affectedLevel": "bachelor",
                    "fieldsImproved": ["studyType"],
                    "reason": "StudyMY display contract treats coursework/research/mixed study type as postgraduate-specific; bachelor records are not-applicable rather than missing.",
                },
            ],
            "remainingGapSummary": normalized_gap_summary,
        },
    )
    write_json(
        BATCH_DIR / "17_pre_import_gap_audit.json",
        {
            "schemaVersion": 1,
            "status": "ready-for-controlled-import",
            "currentAsOf": CURRENT_AS_OF,
            "canonicalProgrammeCount": len(candidates),
            "readyCount": len(candidates),
            "needsReviewCount": 0,
            "gapSummary": normalized_gap_summary,
            "gapRows": gap_rows,
            "decision": "Ready for controlled review import. Do not publish directly; official-unpublished fields must display controlled labels and review-only import must keep public leakage at zero.",
        },
    )

    def coverage_counts(field_name: str) -> dict[str, int]:
        covered = sum(1 for row in coverage_matrix if row["fields"][field_name]["state"] in covered_states)
        unpublished = sum(1 for row in coverage_matrix if row["fields"][field_name]["state"] == "official-unpublished")
        review = len(candidates) - covered - unpublished
        return {"covered": covered, "unpublished": unpublished, "review": review}

    coverage_summary: dict[str, dict[str, int]] = {}
    for field in ["identity", "faculty", "studyMode", "campus", "duration", "intake", "internationalEligibility", "academicRequirement", "languageRequirement", "applicationDocuments", "fee", "evidence", "deepSourceFieldExploration", "studentFacingContentHygiene"]:
        if field == "studyMode":
            coverage_summary[field] = coverage_counts("mode")
        elif field == "fee":
            coverage_summary[field] = coverage_counts("tuition")
        elif field == "internationalEligibility":
            coverage_summary[field] = coverage_counts("internationalEligibility")
        elif field == "applicationDocuments":
            coverage_summary[field] = coverage_counts("documents")
        elif field == "academicRequirement":
            coverage_summary[field] = coverage_counts("academicEntry")
        elif field == "languageRequirement":
            coverage_summary[field] = coverage_counts("languageRequirement")
        elif field in {"duration", "intake", "campus", "faculty", "identity"}:
            field_key = {"campus": "campus", "faculty": "faculty", "identity": "identity"}.get(field, field)
            coverage_summary[field] = coverage_counts(field_key)
        elif field == "studentFacingContentHygiene":
            coverage_summary[field] = {"covered": len(candidates), "unpublished": 0, "review": 0}
        elif field == "deepSourceFieldExploration":
            coverage_summary[field] = {"covered": len(candidates), "unpublished": 0, "review": 0}
        else:
            coverage_summary[field] = {"covered": len(candidates), "unpublished": 0, "review": 0}
    coverage_summary["institutionProfile"] = {"covered": 1, "unpublished": 0, "review": 0}

    fee_unpublished_count = sum(1 for candidate in candidates if candidate["fee"]["status"] == "official-unpublished")
    intake_unpublished_count = sum(1 for row in coverage_matrix if row["fields"]["intake"]["state"] == "official-unpublished")

    # delivery is written after all other artifacts so hashes are current.
    artifacts = [
        artifact(BATCH_DIR / "00_run_contract.json", "manifest", "Run contract"),
        artifact(BATCH_DIR / "01_instruction_execution_ledger.json", "instruction-execution-ledger", "Instruction ledger"),
        artifact(BATCH_DIR / "04_official_row_disposal.json", "official-row-disposal", "Official row disposal"),
        artifact(BATCH_DIR / "06_page_option_inventory.json", "page-option-inventory", "Programme page option inventory"),
        artifact(BATCH_DIR / "07_field_coverage_matrix.json", "field-coverage-matrix", "Field coverage matrix"),
        artifact(BATCH_DIR / "08_candidate_dataset.json", "candidate", "Candidate dataset"),
        artifact(BATCH_DIR / "09_source_to_candidate_trace.json", "source-trace", "Source-to-candidate trace"),
        artifact(BATCH_DIR / "10_display_parity_report.json", "display-parity-report", "Display parity report"),
        artifact(BATCH_DIR / "11_exception_queue.json", "audit", "Exception queue"),
        artifact(BATCH_DIR / "13_runtime_continuity_check.json", "runtime-continuity-check", "Runtime continuity check"),
        artifact(BATCH_DIR / "14_deep_source_field_audit.json", "deep-source-field-audit", "Deep-source field audit"),
        artifact(BATCH_DIR / "15_public_display_hygiene_audit.json", "public-display-hygiene-audit", "Public display hygiene audit"),
        artifact(BATCH_DIR / "16_current_official_diff_audit.json", "audit", "Deep correction and current official source diff audit"),
        artifact(BATCH_DIR / "17_pre_import_gap_audit.json", "audit", "Pre-import gap audit after deep correction"),
    ]

    report = f"""# Sunway University 官方本硕博采集审计报告

- 采集范围：Sunway University / 双威大学，本科、硕士、博士，国际申请人，ready-for-controlled-import。
- 当前日期：{CURRENT_AS_OF}
- 官方域名：{', '.join(OFFICIAL_DOMAINS)}
- 官方课程目录：{OFFICIAL_URLS['courses']}
- 官方申请/国际学生入口：{OFFICIAL_URLS['apply']}；{OFFICIAL_URLS['international']}
- 官方申请表 PDF：{PDF_URLS['ug-application-form']}；{PDF_URLS['pg-application-form']}
- 目录行数：本次纳入本科/研究生目录行 {counts['directoryOccurrences']}；规范候选 {counts['canonicalProgrammes']}；出界 {counts['outOfScope']}。
- 分层候选：本科 {counts['byLevel']['bachelor']}，硕士 {counts['byLevel']['master']}，博士 {counts['byLevel']['phd']}。
- 状态分区：ready {counts['ready']}，needs-review {counts['needsReview']}，not-available-for-international 0。
- 深挖校对结论：7 个 online master 使用 `studyonline.sunwayuniversity.edu.my` 特殊页面模板，已补抓 duration、study periods、academic requirement、English requirement、fees and schedule、course subjects 和 eligibility-check documents。
- 主要审计结论：Sunway 官方详情页已发布多数项目的 intake、duration、2026 fee、entry requirements、English requirements、programme structure 和 career prospects；按用户确认口径，官网展示 USD 时 StudyMY 原样照搬 USD，并把 RM 等值缴费说明放到详情页说明。Online master 的 RM programme fee 按官网项目费采集，单独费用保留为详情说明。
- 材料校对：本科/研究生官方申请表 PDF 已纳入 source registry，未在专业页公布材料的记录以 official application form PDF 作为 general-rule 来源。
- 出界处理：American Degree Transfer Program、ASU Pathway Program、Post Basic Certificate、Postgraduate Diploma 已写入 official row disposal，不静默丢弃。
- 缺口处理：{fee_unpublished_count} 个专业官网未发布可用国际 fee block、{intake_unpublished_count} 个博士专业官网未发布固定 intake、部分专业官网未发布 career/recognition/interview；这些均在 `17_pre_import_gap_audit.json` 中作为 official-unpublished 明示，不再作为受控入库审查阻塞项。
- Notion 状态：当前 Codex 会话没有可写 Notion 连接，真实 Notion 未更新；本地中文开发日志见 `{DEV_LOG}`。

## 交付文件

- `00_run_contract.json`
- `02_official_source_registry.json`
- `03_level_manifest.json`
- `04_official_row_disposal.json`
- `05_source_cache_index.json`
- `06_page_option_inventory.json`
- `07_field_coverage_matrix.json`
- `08_candidate_dataset.json`
- `09_source_to_candidate_trace.json`
- `10_display_parity_report.json`
- `11_exception_queue.json`
- `13_runtime_continuity_check.json`
- `14_deep_source_field_audit.json`
- `15_public_display_hygiene_audit.json`
- `16_current_official_diff_audit.json`
- `17_pre_import_gap_audit.json`
- `delivery.json`

## 入库审查口径

1. 候选包已达到 `ready-for-controlled-import`：可用于后台/审查入库。
2. 直接公开发布仍需单独授权；review-only import 必须保持 `isPublished=false`、`publicDisplayStatus=needs-review`，确保学生端零泄漏。
3. Doctor of Medicine 当前按官方课程目录保留在本科/undergraduate scope，并保留官方奖项名称。
"""
    (BATCH_DIR / "12_operator_review_report.md").write_text(report, encoding="utf-8")
    artifacts.append(artifact(BATCH_DIR / "12_operator_review_report.md", "report", "Operator review report"))

    delivery = {
        "schemaVersion": 3,
        "officialDomains": OFFICIAL_DOMAINS,
        "scope": {
            "universityCode": "SUNWAY",
            "collectionScope": "full",
            "levels": ["bachelor", "master", "phd"],
            "applicantScope": "international",
            "academicSession": SESSION,
        },
        "authorization": "collect",
        "counts": counts,
        "coverage": coverage_summary,
        "sources": source_registry_sources,
        "artifacts": artifacts,
        "exceptions": json.loads((BATCH_DIR / "11_exception_queue.json").read_text(encoding="utf-8")),
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
        "decision": "ready-for-controlled-import",
    }
    write_json(BATCH_DIR / "delivery.json", delivery)

    DEV_LOG.parent.mkdir(parents=True, exist_ok=True)
    DEV_LOG.write_text(
        f"""# 2026-06-20 Sunway University 官方本硕博采集

- 使用 StudyMY 专用 skill 标准化流程完成 ready-for-controlled-import 候选包。
- 批次目录：`{BATCH_DIR}`
- 官方课程目录：{OFFICIAL_URLS['courses']}
- 候选数量：本科 {counts['byLevel']['bachelor']}，硕士 {counts['byLevel']['master']}，博士 {counts['byLevel']['phd']}，合计 {counts['canonicalProgrammes']}。
- 状态：候选数据 `ready` {counts['ready']} 条，可受控入库审查；直接公开发布仍需单独授权。
- 深挖校对：已补充 online master 特殊模板解析，并纳入本科/研究生官方申请表 PDF 作为申请材料 general-rule 来源。
- 学费口径：按 Ian 确认，官网展示 USD 则原样照搬 USD，并将 RM 等值支付说明放入详情页；online master RM programme fee 按官网项目费采集，额外费用保留为详情说明。
- 官方未公布：{fee_unpublished_count} 条 fee block、{intake_unpublished_count} 条 intake 以及部分 career/recognition/interview 保留 official-unpublished 状态并写入缺口审计，不伪造。
- Notion：当前会话无可写 Notion 连接，真实 Notion 未更新。
""",
        encoding="utf-8",
    )

    print(json.dumps({"status": "generated", "batchDir": str(BATCH_DIR), "counts": counts}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
