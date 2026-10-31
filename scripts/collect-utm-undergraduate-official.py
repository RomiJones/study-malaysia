#!/usr/bin/env python3
"""Collect audited UTM undergraduate official candidate data.

This script is intentionally read-only: it snapshots official sources,
normalizes catalogue counts, and writes candidate/audit JSON artifacts without
touching the StudyMY database.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

import pdfplumber
from bs4 import BeautifulSoup


OFFICIAL_SOURCES = {
    "undergraduate-international": "https://admission.utm.my/undergraduate-international/",
    "offered-allcourses-international": "https://admission.utm.my/offered-allcourses-international/",
    "programme-fees-ug-international": "https://admission.utm.my/programme-fees-ug-international/",
    "entry-requirements-ug-international": "https://admission.utm.my/entry-requirements-ug-international/",
    "english-language-requirements": "https://admission.utm.my/english-language-requirements-3/",
    "latest-ug-programme-sept-2026-intake": (
        "https://admission.utm.my/wp-content/uploads/sites/461/2026/03/"
        "LATEST-UG-PROGRAMME-SEPT-2026-INTAKE.pdf"
    ),
}

SUPPLEMENTAL_PDF_SOURCES = {
    "fke-biomedical-booklet-2025-2026": {
        "url": "https://fke.utm.my/wp-content/uploads/2025/09/SKEB-Booklet-20252026-Both-Intake.pdf",
        "programmes": ["Bachelor of Biomedical Engineering with Honours"],
        "pageWindows": [[1, 18]],
    },
    "fke-electrical-booklet-2025-2026": {
        "url": "https://fke.utm.my/wp-content/uploads/2025/09/SKEEH-Booklet-20252026-50825.pdf",
        "programmes": ["Bachelor of Electrical Engineering with Honours"],
        "pageWindows": [[1, 18]],
    },
    "fke-electronic-booklet-2025-2026": {
        "url": "https://fke.utm.my/wp-content/uploads/2025/10/Booklet-SKELH-20252026_REV1.pdf",
        "programmes": ["Bachelor of Electronic Engineering with Honours"],
        "pageWindows": [[1, 18]],
    },
    "fke-mechatronics-handbook-2025-2026": {
        "url": "https://fke.utm.my/wp-content/uploads/2026/05/SKEMH-Handbook-20252026-22-May-2026.pdf",
        "programmes": ["Bachelor of Engineering (Electrical-Mechatronics) with Honours"],
        "pageWindows": [[1, 20]],
    },
    "fkt-undergraduate-guidebook-2025-2026": {
        "url": "https://fkt.utm.my/wp-content/uploads/2026/01/GUIDEBOOK-UG-FKT-2025-2026-1.pdf",
        "programmes": [
            "Bachelor of Chemical Engineering with Honours",
            "Bachelor of Nuclear Engineering with Honours",
            "Bachelor of Chemical Engineering (Bioprocess) with Honours",
            "Bachelor of Chemical Engineering (Gas) with Honours",
            "Bachelor of Petroleum Engineering with Honours",
        ],
        "pageWindows": [[1, 40]],
    },
    "mechanical-undergraduate-handbook-2023-2024": {
        "url": "https://mech.utm.my/wp-content/uploads/2023/10/UNDERGRADUATE-HANDBOOK-FACULTY-OF-MECHANICAL-ENGINEERING-SESSION-20232024.pdf",
        "programmes": [
            "Bachelor of Mechanical Engineering with Honours",
            "Bachelor of Mechanical Engineering (Manufacturing) with Honours",
            "Bachelor of Naval Architecture & Offshore Engineering with Honours",
            "Bachelor of Mechanical Engineering (Aeronautics) with Honours",
        ],
        "pageWindows": [[1, 40], [70, 85], [95, 106], [142, 153]],
    },
    "science-academic-handbook-2025-2026": {
        "url": "https://science.utm.my/undergraduate/wp-content/uploads/sites/584/2025/09/UGFS-Academic-Handbook-20252026-v2.pdf",
        "programmes": [
            "Bachelor of Science (Physics) with Honours",
            "Bachelor of Science (Industrial Physics) with Honours",
            "Bachelor of Science (Chemistry) with Honours",
            "Bachelor of Science (Industrial Chemistry) with Honours",
            "Bachelor of Science (Mathematics) with Honours",
            "Bachelor of Science (Industrial Mathematics) with Honours",
            "Bachelor of Science (Biology) with Honours",
            "Bachelor of Science in Biotechnology with Honours",
        ],
        "pageWindows": [[1, 40]],
    },
    "mjiit-undergraduate-guideline-2025-2026": {
        "url": "https://mjiit.utm.my/wp-content/uploads/2025/09/Final-Guideline-Book-UG-20252026.pdf",
        "programmes": [
            "Bachelor in Software Engineering with Honours",
            "Bachelor of Science (Industrial Mathematics) with Honours",
            "Bachelor of Electronic Systems Engineering with Honours",
            "Bachelor of Mechanical Precision Engineering with Honours",
            "Bachelor of Chemical Process Engineering with Honours",
        ],
        "pageWindows": [[45, 62], [116, 132], [148, 166], [192, 210]],
    },
    "utm-admission-undergraduate-international-brochure-2025": {
        "url": "https://admission.utm.my/wp-content/uploads/sites/461/2025/09/FINAL-APPROVED-NEW-BROCHURE-UG-INTER-8-x-8-in-1.pdf",
        "programmes": ["Bachelor of Science in Geoinformatics with Honours"],
        "pageWindows": [[1, 16]],
    },
}

FACULTY_SHARED_DURATION_EVIDENCE = {
    "https://comp.utm.my/undergraduate/": {
        "duration": {
            "status": "programme-specific",
            "officialText": "Programme Specification Study Duration: Minimum 8 Semesters / Maximum 12 Semesters.",
            "semesters": 8,
            "minYears": 4,
            "maxYears": 6,
        },
        "note": "Shared Faculty of Computing undergraduate page programme-specification block.",
    },
}

SUPPLEMENTAL_DURATION_OVERRIDES_BY_PROGRAMME = {
    "Bachelor of Mechanical Engineering (Manufacturing) with Honours": {
        "sourceId": "mechanical-undergraduate-handbook-2023-2024",
        "duration": {
            "status": "programme-specific",
            "officialText": (
                "The Bachelor of Mechanical Engineering (Manufacturing) with Honours Programme Specifications state: "
                "Study Duration Minimum: 4 years; Maximum: 6 years; Normal 8 semesters."
            ),
            "semesters": 8,
            "minYears": 4,
            "maxYears": 6,
        },
    },
}

FEE_CATEGORY_BY_PROGRAMME = {
    "Bachelor in Accounting with Honours": "Accountancy",
    "Bachelor in Digital Marketing with Honours": "HRD/ Management Technology",
    "Bachelor of Management with Honours": "Management",
    "Bachelor of Science (Human Resource Development) with Honours": "HRD/ Management Technology",
    "Bachelor in Human Resource Development with Honours": "HRD/ Management Technology",
    "Bachelor of Psychology with Human Resource Development with Honours": "HRD/ Management Technology",
    "Bachelor of Science in Architecture with Honours": "Architecture",
    "Bachelor of Quantity Surveying with Honours": "Quantity Survey, Landscape Architecture, Industrial Design",
    "Bachelor of Landscape Architecture with Honours": "Quantity Survey, Landscape Architecture, Industrial Design",
    "Bachelor of Science with Honours (Industrial Design)": "Quantity Survey, Landscape Architecture, Industrial Design",
    "Bachelor of Geomatics Engineering with Honours": "Geoinformation/ Property Management",
    "Bachelor of Science in Geoinformatics with Honours": "Geoinformation/ Property Management",
    "Bachelor of Science in Land Administration and Development with Honours": "Geoinformation/ Property Management",
    "Bachelor of Real Estate with Honours": "Geoinformation/ Property Management",
    "Bachelor of Science in Construction with Honours": "Quantity Survey, Landscape Architecture, Industrial Design",
    "Bachelor of Urban and Regional Planning with Honours": "Quantity Survey, Landscape Architecture, Industrial Design",
    "Bachelor in Artificial Intelligence with Honours": "Artificial Intelligence",
    "Bachelor in Software Engineering with Honours": "Computer / IT",
    "Bachelor of Computer Science (Computer Networks and Security) with Honours": "Computer / IT",
    "Bachelor of Computer Science (Graphics and Multimedia Software) with Honours": "Computer / IT",
    "Bachelor of Science (Physics) with Honours": "Sciences",
    "Bachelor of Science (Industrial Physics) with Honours": "Sciences",
    "Bachelor of Science (Chemistry) with Honours": "Sciences",
    "Bachelor of Science (Industrial Chemistry) with Honours": "Sciences",
    "Bachelor of Science (Mathematics) with Honours": "Sciences",
    "Bachelor of Science (Industrial Mathematics) with Honours": "Sciences",
    "Bachelor of Science (Biology) with Honours": "Sciences",
    "Bachelor of Science Biology with Honours": "Sciences",
    "Bachelor of Science in Biotechnology with Honours": "Sciences",
}

MJIIT_PROGRAMMES = {
    "Bachelor of Electronic Systems Engineering with Honours",
    "Bachelor of Mechanical Precision Engineering with Honours",
    "Bachelor of Chemical Process Engineering with Honours",
}

PROGRAMME_DETAIL_URL_OVERRIDES_BY_NAME = {
    "Bachelor in Accounting with Honours": "https://management.utm.my/accounting/",
    "Bachelor in Digital Marketing with Honours": "https://management.utm.my/management-marketing/",
    "Bachelor of Management with Honours": "https://management.utm.my/management-2/",
}

DETAIL_URL_OVERRIDES = {
    "http://builtsurvey.utm.my/academics/undergraduate/urban-regional-planning/": {
        "url": "https://builtsurvey.utm.my/academic/undergraduate/urban-regional-planning/",
        "reason": "The current All Courses row uses an older /academics/ path that timed out; the same official faculty domain exposes the active page under /academic/undergraduate/.",
        "reviewedAt": "2026-06-16",
    },
    "https://builtsurvey.utm.my/academic/bachelor-of-property-management/": {
        "url": "https://builtsurvey.utm.my/fabu2024/academic/bachelor-of-property-management/",
        "reason": "The current All Courses row links to a 404 path; the same official faculty domain exposes the active property management detail page under /fabu2024/.",
        "reviewedAt": "2026-06-16",
    }
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


def source_slug_from_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    value = f"{parsed.netloc}{parsed.path}"
    return slugify(value)[:110] or "source"


def normalize_name(value: str) -> str:
    value = clean(value)
    value = value.replace("–", "-")
    value = value.replace("Electrical - Mechatronics", "Electrical-Mechatronics")
    value = value.replace("Electrical- Mechatronics", "Electrical-Mechatronics")
    value = value.replace("Aeronatics", "Aeronautics")
    value = value.replace("Contruction", "Construction")
    value = value.replace("Bachelor of Science Biology", "Bachelor of Science (Biology)")
    value = value.replace("Bachelor of Science (Human Resource Development)", "Bachelor in Human Resource Development")
    return value


def name_key(value: str) -> str:
    value = normalize_name(value)
    value = value.replace("&", "and")
    value = re.sub(r"[^a-z0-9]+", " ", value.lower())
    return clean(value)


def fetch(url: str, path: Path, timeout: int = 45) -> dict[str, Any]:
    path.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "StudyMY official collector"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        final_url = response.geturl()
        content = response.read()
    path.write_bytes(content)
    return {
        "url": url,
        "finalUrl": final_url,
        "localPath": str(path),
        "sha256": sha256(path),
        "bytes": len(content),
        "retrievedAt": now_iso(),
        "status": "verified",
    }


def fetch_or_error(url: str, path: Path, timeout: int = 45) -> dict[str, Any]:
    try:
        return fetch(url, path, timeout=timeout)
    except Exception as error:  # noqa: BLE001 - preserve transport exception in artifact.
        path.parent.mkdir(parents=True, exist_ok=True)
        marker = f"TRANSPORT_ERROR {type(error).__name__}: {error}\nURL: {url}\n"
        path.write_text(marker)
        return {
            "url": url,
            "finalUrl": url,
            "localPath": str(path),
            "sha256": sha256(path),
            "bytes": path.stat().st_size,
            "retrievedAt": now_iso(),
            "status": "transport-error",
            "error": f"{type(error).__name__}: {error}",
        }


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[dict[str, Any]]] = []
        self._row: list[dict[str, Any]] | None = None
        self._cell: dict[str, Any] | None = None
        self._in_cell = False
        self._link_stack: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        if tag == "tr":
            self._row = []
        elif tag in {"td", "th"} and self._row is not None:
            self._cell = {"text": "", "links": []}
            self._in_cell = True
        elif tag == "a" and self._in_cell:
            href = attrs_dict.get("href") or ""
            self._link_stack.append(href)
            if self._cell is not None and href:
                self._cell["links"].append(href)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._link_stack:
            self._link_stack.pop()
        elif tag in {"td", "th"} and self._cell is not None and self._row is not None:
            self._cell["text"] = clean(self._cell["text"])
            self._row.append(self._cell)
            self._cell = None
            self._in_cell = False
        elif tag == "tr" and self._row is not None:
            if any(cell["text"] for cell in self._row):
                self.rows.append(self._row)
            self._row = None

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell["text"] += data


def parse_tables(path: Path) -> list[list[dict[str, Any]]]:
    parser = TableParser()
    parser.feed(path.read_text(errors="ignore"))
    return parser.rows


def parse_catalogue(path: Path) -> list[dict[str, Any]]:
    records = []
    for row in parse_tables(path):
        cells = [cell["text"] for cell in row]
        if not cells or "Bachelor" not in cells[0]:
            continue
        detail_links = [
            link
            for cell in row
            for link in cell["links"]
            if "utm.my" in link and not any(token in link for token in ["smart.utm.my", "wp-content/uploads"])
        ]
        status_text = cells[5] if len(cells) > 5 else ""
        intake_text = cells[4] if len(cells) > 4 else ""
        detail_url = urllib.parse.urljoin("https://admission.utm.my/", detail_links[-1]) if detail_links else None
        name = normalize_name(cells[0])
        detail_url = PROGRAMME_DETAIL_URL_OVERRIDES_BY_NAME.get(name, detail_url)
        records.append(
            {
                "ordinal": len(records) + 1,
                "nameEnOfficial": name,
                "facultyEn": clean(cells[1] if len(cells) > 1 else ""),
                "intakeText": intake_text,
                "intakeMonths": re.findall(r"September|February", intake_text),
                "applicationStatus": "closed" if status_text.lower() == "closed" or "not offered" in intake_text.lower() else "open",
                "detailUrl": detail_url,
                "applicationUrl": "http://smart.utm.my/admission/",
                "sourceRole": "official-all-courses-row",
            }
        )
    return records


def parse_fees(path: Path) -> dict[str, dict[str, Any]]:
    rows = parse_tables(path)
    fees: dict[str, dict[str, Any]] = {}
    for row in rows:
        cells = [cell["text"] for cell in row]
        if len(cells) < 4 or cells[0] in {"Programme Field", ""}:
            continue
        if "Tuition Fees Semester" in cells[1]:
            continue
        amounts = []
        for cell in cells[1:4]:
            match = re.search(r"RM\s*([\d,]+)", cell)
            amounts.append(int(match.group(1).replace(",", "")) if match else None)
        if all(amount is not None for amount in amounts):
            fees[cells[0]] = {
                "feeCategory": cells[0],
                "semester1MYR": amounts[0],
                "semester2To8MYR": amounts[1],
                "totalTuitionMYR": amounts[2],
                "sourceRole": "official-international-fee-table",
            }
    return fees


def parse_pdf_programmes(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    faculty = ""
    campus = "UTM Johor Bahru"
    with pdfplumber.open(str(path)) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            lines = [clean(line) for line in (page.extract_text() or "").splitlines() if clean(line)]
            i = 0
            while i < len(lines):
                line = lines[i]
                if "PROGRAM OFFERED AT UTM KUALA LUMPUR" in line:
                    campus = "UTM Kuala Lumpur"
                if line.startswith("FACULTY ") or line.startswith("MALAYSIA - JAPAN"):
                    faculty = clean(line.title().replace(" And ", " and ").replace(" Of ", " of "))
                if line.startswith("Bachelor"):
                    name = line
                    if "with Honours" not in name and i + 1 < len(lines) and lines[i + 1] == "with Honours":
                        name = f"{name} with Honours"
                        i += 1
                    records.append(
                        {
                            "nameEnOfficial": normalize_name(name),
                            "facultyEn": faculty,
                            "campus": campus,
                            "sourcePage": page_number,
                        }
                    )
                i += 1
    return records


def extract_general_requirements(path: Path) -> dict[str, Any]:
    text = clean(" ".join(parse_visible_text(path)))
    academic = re.search(
        r"A Senior High School Certificate.*?Pass the UTM interview.*?\)\.",
        text,
        flags=re.IGNORECASE,
    )
    return {
        "academicRequirementSummary": clean(academic.group(0)) if academic else "official-page-present-but-summary-not-parsed",
        "languageRequirementStatus": "official-linked-page-not-parsed",
        "countryRequirementStatus": "official-country-table-present",
        "chinaRequirementByField": {
            "Engineering": "Senior Secondary School Graduation Certificate, or Graduation Certificate from a Vocational / Technical Secondary School (Zhixiao / Zhigao) or Skilled Worker School (Jixiao); scores of at least 70% in Mathematics and Physics, plus Chemistry or Biology.",
            "Social Science": "Senior Secondary School Graduation Certificate, or Graduation Certificate from a Vocational / Technical Secondary School (Zhixiao / Zhigao) or Skilled Worker School (Jixiao); scores of at least 70% in any three accepted subjects, including Mathematics, Physics, Biology, Chemistry, Geography, Economy, Accounting, Business Management, ICT, Computer Science, Programming, Computing, Art and Design, or Visual Arts.",
        },
        "healthRequirementStatus": "official-linked-form-present",
    }


def parse_visible_text(path: Path) -> list[str]:
    class TextParser(HTMLParser):
        def __init__(self) -> None:
            super().__init__()
            self.hidden = 0
            self.parts: list[str] = []

        def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
            if tag in {"script", "style"}:
                self.hidden += 1

        def handle_endtag(self, tag: str) -> None:
            if tag in {"script", "style"} and self.hidden:
                self.hidden -= 1

        def handle_data(self, data: str) -> None:
            if not self.hidden and clean(data):
                self.parts.append(clean(data))

    parser = TextParser()
    parser.feed(path.read_text(errors="ignore"))
    return parser.parts


def canonical_detail_url(url: str | None) -> str | None:
    if not url:
        return None
    parsed = urllib.parse.urlparse(url)
    path = parsed.path.replace("/./", "/")
    if path.endswith("/."):
        path = path[:-1]
    path = re.sub(r"/+", "/", path)
    canonical = urllib.parse.urlunparse((parsed.scheme or "https", parsed.netloc, path, "", "", ""))
    return DETAIL_URL_OVERRIDES.get(canonical, {}).get("url", canonical)


def programme_aliases(name: str) -> list[str]:
    aliases = {name, normalize_name(name)}
    aliases.add(name.replace("&", "and"))
    aliases.add(name.replace("and", "&"))
    aliases.add(re.sub(r"\s+with Honours$", "", name, flags=re.IGNORECASE))
    aliases.add(name.replace("Bachelor in Human Resource Development", "Bachelor of Science (Human Resource Development)"))
    aliases.add(name.replace("Bachelor of Naval Architecture & Offshore Engineering", "Bachelor of Naval Architecture and Offshore Engineering"))
    engineering_map = {
        "Bachelor of Chemical Engineering with Honours": "Bachelor of Engineering (Chemical)",
        "Bachelor of Chemical Engineering (Bioprocess) with Honours": "Bachelor of Engineering (Chemical-Bioprocess)",
        "Bachelor of Chemical Engineering (Gas) with Honours": "Bachelor of Engineering (Chemical-Gas)",
        "Bachelor of Petroleum Engineering with Honours": "Bachelor of Engineering (Petroleum)",
        "Bachelor of Civil Engineering with Honours": "Bachelor of Engineering (Civil)",
    }
    if name in engineering_map:
        aliases.add(engineering_map[name])
    return [clean(alias) for alias in aliases if clean(alias)]


def text_tokens(value: str) -> set[str]:
    stop = {"bachelor", "honours", "honors", "with", "of", "in", "and", "the", "engineering", "science"}
    return {token for token in re.findall(r"[a-z0-9]+", value.lower()) if len(token) > 2 and token not in stop}


def match_score(programme_name: str, text: str) -> float:
    text_key = name_key(text)
    for alias in programme_aliases(programme_name):
        alias_key = name_key(alias)
        if alias_key and alias_key in text_key:
            return 1.0
    programme_tokens = text_tokens(programme_name)
    text_token_set = text_tokens(text)
    if not programme_tokens:
        return 0
    return len(programme_tokens & text_token_set) / len(programme_tokens)


def first_long_text(parts: list[str], min_len: int = 90) -> str | None:
    skip = {
        "home",
        "about",
        "undergraduate",
        "postgraduate",
        "apply",
        "search",
        "contact us",
        "facebook",
        "rss",
    }
    for part in parts:
        lowered = part.lower()
        if len(part) >= min_len and not any(lowered == item for item in skip):
            return part
    return None


SECTION_STOP_RE = re.compile(
    r"^(Bachelor|Faculty|Programme Specifications|Programme Structure|Program Structure|Entry requirement|"
    r"Entry Requirements|Career opportunities|Career Opportunity|Career Prospects|Curriculum|Apply Now|How To Apply|"
    r"Contact Us|Quicklinks|Other Related Links)$",
    flags=re.IGNORECASE,
)


def section_after_keyword(parts: list[str], keywords: list[str], max_parts: int = 12) -> str | None:
    for index, part in enumerate(parts):
        if any(keyword.lower() in part.lower() for keyword in keywords):
            section = []
            for candidate in parts[index + 1 : index + 1 + max_parts]:
                if SECTION_STOP_RE.match(candidate):
                    if section:
                        break
                if len(candidate) > 25:
                    section.append(candidate)
            if section:
                return clean(" ".join(section))
    return None


def parse_duration(segment_text: str) -> dict[str, Any]:
    result: dict[str, Any] = {"status": "not-confirmed"}
    match = re.search(
        r"Minimum\s+Duration\s*:?\s*(\d+(?:\.\d+)?)\s*years?.{0,80}?Maximum\s+Duration\s*:?\s*(\d+(?:\.\d+)?)\s*years?",
        segment_text,
        flags=re.IGNORECASE,
    )
    if match:
        return {
            "status": "programme-specific",
            "officialText": clean(match.group(0)),
            "minYears": float(match.group(1)),
            "maxYears": float(match.group(2)),
        }
    match = re.search(
        r"Minimum\s*:?\s*(\d+(?:\.\d+)?)\s*(?:yrs?|years?).{0,60}?Maximum\s*:?\s*(\d+(?:\.\d+)?)\s*(?:yrs?|years?)",
        segment_text,
        flags=re.IGNORECASE,
    )
    if match:
        return {
            "status": "programme-specific",
            "officialText": clean(match.group(0)),
            "minYears": float(match.group(1)),
            "maxYears": float(match.group(2)),
        }
    match = re.search(
        r"(?:lasts|duration of study).{0,180}?four\s*\(4\)\s*years.{0,180}?six\s*\(6\)\s*years",
        segment_text,
        flags=re.IGNORECASE,
    )
    if match:
        return {
            "status": "programme-specific",
            "officialText": clean(match.group(0)),
            "minYears": 4,
            "maxYears": 6,
        }
    match = re.search(
        r"(?:Study\s+Duration|Duration|Programme\s+Duration).{0,80}?Minimum\s*:?\s*(\d+)\s*semesters?.{0,80}?Maximum\s*:?\s*(\d+)\s*semesters?",
        segment_text,
        flags=re.IGNORECASE,
    )
    if match:
        semesters = int(match.group(1))
        return {
            "status": "programme-specific",
            "officialText": clean(match.group(0)),
            "semesters": semesters,
            "minYears": semesters / 2,
            "maxYears": int(match.group(2)) / 2,
        }
    match = re.search(r"(\d+(?:\.\d+)?)\s*-\s*year\s+(?:Bachelor|programme|program)", segment_text, flags=re.IGNORECASE)
    if match:
        return {
            "status": "programme-specific",
            "officialText": clean(match.group(0)),
            "minYears": float(match.group(1)),
        }
    match = re.search(r"(\d+)\s*years?\s+(?:Bachelor|programme|program)", segment_text, flags=re.IGNORECASE)
    if match:
        return {
            "status": "programme-specific",
            "officialText": clean(match.group(0)),
            "minYears": float(match.group(1)),
        }
    match = re.search(r"four-year\s+program(?:me)?|four\s*\(4\)\s*years", segment_text, flags=re.IGNORECASE)
    if match:
        return {
            "status": "programme-specific",
            "officialText": clean(match.group(0)),
            "minYears": 4,
        }
    if re.search(r"\beighth semester\b", segment_text, flags=re.IGNORECASE):
        return {
            "status": "programme-specific",
            "officialText": "The official page states that the eighth semester is used for industrial training.",
            "semesters": 8,
            "minYears": 4,
        }
    match = re.search(r"(\d+)\s+semesters?", segment_text, flags=re.IGNORECASE)
    if match:
        semesters = int(match.group(1))
        start = max(match.start() - 70, 0)
        end = min(match.end() + 70, len(segment_text))
        context = segment_text[start:end]
        if semesters < 6 or re.search(r"each academic year|per academic year", context, flags=re.IGNORECASE):
            return result
        return {
            "status": "programme-specific",
            "officialText": clean(match.group(0)),
            "semesters": semesters,
            "minYears": semesters / 2,
        }
    return result


def parse_language_scores(path: Path) -> dict[str, Any]:
    scores: dict[str, Any] = {"status": "official-general-rule", "sourceText": None, "scores": {}}
    soup = BeautifulSoup(path.read_text(errors="ignore"), "html.parser")
    table = soup.find("table")
    rows = table.find_all("tr") if table else []
    for row in rows:
        cells = [clean(cell.get_text(" ", strip=True)) for cell in row.find_all(["td", "th"])]
        if len(cells) < 2:
            continue
        test_name = cells[0]
        general_score = cells[1]
        match = re.search(r"(\d+(?:\.\d+)?)", general_score)
        if not match:
            continue
        value = float(match.group(1)) if "." in match.group(1) else int(match.group(1))
        if "MUET" in test_name:
            scores["scores"]["MUET"] = value
        elif "IELTS" in test_name:
            scores["scores"]["IELTS"] = value
        elif "TOEFL" in test_name:
            scores["scores"]["TOEFL_iBT"] = value
        elif "Pearson" in test_name or "PTE" in test_name:
            scores["scores"]["PTE_Academic"] = value
        elif "Cambridge" in test_name or "Linguaskill" in test_name:
            scores["scores"]["Cambridge_Linguaskill"] = value
        elif "CIEP" in test_name or "ELS" in test_name:
            scores["scores"]["ELS_CIEP"] = value
    scores["sourceText"] = (
        "Undergraduate candidates joining UTM from September 2023 must meet one English language route; "
        "the general undergraduate table applies to all programmes except TESL."
    )
    if not scores["scores"]:
        scores["status"] = "official-page-parsed-score-not-found"
    return scores


def fetch_detail_sources(
    programmes: list[dict[str, Any]], raw_dir: Path, should_fetch: bool, delay: float
) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    detail_dir = raw_dir / "programme-details"
    detail_sources: dict[str, dict[str, Any]] = {}
    source_records = []
    unique_urls = sorted(
        {
            canonical_detail_url(item.get("detailUrl"))
            for item in programmes
            if item["canonicalDecision"]["currentCycleStatus"] in {"ready-for-detail-enrichment", "current-cycle-not-open"}
            and canonical_detail_url(item.get("detailUrl"))
        }
    )
    for ordinal, url in enumerate(unique_urls, start=1):
        assert url is not None
        path = detail_dir / f"{ordinal:03d}-{source_slug_from_url(url)}.html"
        if should_fetch or not path.exists():
            source = fetch_or_error(url, path, timeout=45)
            if delay > 0:
                time.sleep(delay)
        else:
            source = {
                "url": url,
                "finalUrl": url,
                "localPath": str(path),
                "sha256": sha256(path),
                "bytes": path.stat().st_size,
                "retrievedAt": now_iso(),
                "status": "verified-cache",
            }
        source.update(
            {
                "id": f"programme-detail-{ordinal:03d}",
                "sourceRole": "programme-detail",
                "officialDomain": urllib.parse.urlparse(url).netloc,
                "fields": [
                    "overview",
                    "duration",
                    "studyMode",
                    "languageOfInstruction",
                    "curriculum",
                    "career",
                    "accreditation",
                ],
            }
        )
        detail_sources[url] = source
        source_records.append(source)
    return detail_sources, source_records


def fetch_supplemental_sources(raw_dir: Path, should_fetch: bool, delay: float) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    supplemental_dir = raw_dir / "supplemental-pdfs"
    supplemental_sources: dict[str, dict[str, Any]] = {}
    source_records = []
    for source_id, config in SUPPLEMENTAL_PDF_SOURCES.items():
        url = config["url"]
        path = supplemental_dir / Path(urllib.parse.urlparse(url).path).name
        if should_fetch or not path.exists():
            source = fetch_or_error(url, path, timeout=75)
            if delay > 0:
                time.sleep(delay)
        else:
            source = {
                "url": url,
                "finalUrl": url,
                "localPath": str(path),
                "sha256": sha256(path),
                "bytes": path.stat().st_size,
                "retrievedAt": now_iso(),
                "status": "verified-cache",
            }
        source.update(
            {
                "id": source_id,
                "sourceRole": "supplemental-programme-handbook",
                "officialDomain": urllib.parse.urlparse(url).netloc,
                "fields": ["duration", "studyMode", "programmeStructure", "entryRequirements"],
                "relatedProgrammes": config["programmes"],
                "pageWindows": config.get("pageWindows", []),
            }
        )
        supplemental_sources[source_id] = source
        source_records.append(source)
    return supplemental_sources, source_records


def extract_pdf_text(path: Path, max_pages: int | None = None, page_windows: list[list[int]] | None = None) -> str:
    chunks: list[str] = []
    with pdfplumber.open(str(path)) as pdf:
        if page_windows:
            page_indexes: list[int] = []
            for start, end in page_windows:
                page_indexes.extend(range(max(start - 1, 0), min(end, len(pdf.pages))))
            pages = [pdf.pages[index] for index in sorted(set(page_indexes))]
        else:
            pages = pdf.pages if max_pages is None else pdf.pages[:max_pages]
        for page in pages:
            try:
                chunks.append(page.extract_text() or "")
            except Exception:
                continue
    return clean(" ".join(chunks))


def parse_supplemental_duration(source: dict[str, Any]) -> dict[str, Any]:
    if source.get("status") == "transport-error":
        return {"status": "not-confirmed"}
    try:
        text = extract_pdf_text(Path(source["localPath"]), max_pages=60, page_windows=source.get("pageWindows") or None)
    except Exception as error:  # noqa: BLE001 - record parser issue as non-blocking source evidence.
        return {"status": "not-confirmed", "parserError": f"{type(error).__name__}: {error}"}
    duration = parse_duration(text)
    if duration["status"] == "not-confirmed":
        match = re.search(
            r"minimum duration of the programme is (?:four\s*\(4\)|four|4)\s*years?.{0,80}?8\s*semesters?",
            text,
            flags=re.IGNORECASE,
        )
        if match:
            duration = {
                "status": "programme-specific",
                "officialText": clean(match.group(0)),
                "semesters": 8,
                "minYears": 4,
            }
    if duration["status"] == "programme-specific":
        duration["sourceId"] = source["id"]
        duration["sourceUrl"] = source.get("finalUrl") or source["url"]
        duration["sourcePath"] = source["localPath"]
    return duration


def build_supplemental_duration_by_programme(supplemental_sources: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    duration_by_programme: dict[str, dict[str, Any]] = {}
    for source_id, source in supplemental_sources.items():
        duration = parse_supplemental_duration(source)
        if duration.get("status") != "programme-specific":
            continue
        for programme_name in SUPPLEMENTAL_PDF_SOURCES[source_id]["programmes"]:
            duration_by_programme[programme_name] = dict(duration)
    for programme_name, override in SUPPLEMENTAL_DURATION_OVERRIDES_BY_PROGRAMME.items():
        source = supplemental_sources.get(override["sourceId"])
        if not source or source.get("status") == "transport-error":
            continue
        duration = dict(override["duration"])
        duration["sourceId"] = source["id"]
        duration["sourceUrl"] = source.get("finalUrl") or source["url"]
        duration["sourcePath"] = source["localPath"]
        duration_by_programme[programme_name] = duration
    return duration_by_programme


def parse_programme_detail(
    programme: dict[str, Any], detail_source: dict[str, Any] | None, shared_detail_count: int = 1
) -> dict[str, Any]:
    if not detail_source:
        return {"status": "detail-url-missing"}
    if detail_source.get("status") == "transport-error":
        return {
            "status": "transport-error",
            "sourceId": detail_source["id"],
            "sourceUrl": detail_source["url"],
            "error": detail_source.get("error"),
        }
    path = Path(detail_source["localPath"])
    soup = BeautifulSoup(path.read_text(errors="ignore"), "html.parser")
    parts = parse_visible_text(path)
    title = clean(soup.title.get_text(" ", strip=True) if soup.title else "")
    best_index = None
    best_score = 0.0
    best_quality = -1
    anchor_keywords = [
        "overview",
        "description",
        "programme specification",
        "programme specifications",
        "program specification",
        "study duration",
        "mode of study",
        "career",
        "entry requirement",
        "programme structure",
        "program structure",
        "curriculum",
    ]
    for index, part in enumerate(parts):
        score = match_score(programme["nameEnOfficial"], part)
        context = " ".join(parts[index : index + 90]).lower()
        quality = sum(1 for keyword in anchor_keywords if keyword in context)
        if score > best_score or (score == best_score and quality > best_quality) or (
            score == best_score and quality == best_quality and best_index is not None and index > best_index
        ):
            best_score = score
            best_quality = quality
            best_index = index
    if best_index is None or best_score < 0.45:
        segment_parts = parts[:160]
        status = "source-parsed-programme-anchor-not-found"
    else:
        segment_parts = []
        for part in parts[best_index : best_index + 140]:
            if (
                segment_parts
                and part.startswith("Bachelor")
                and "Honours" in part
                and match_score(programme["nameEnOfficial"], part) < 0.5
            ):
                break
            segment_parts.append(part)
        status = "official-detail-parsed"
    segment_text = clean(" ".join(segment_parts))
    full_page_text = clean(" ".join(parts))
    overview = first_long_text(segment_parts)
    curriculum = section_after_keyword(
        segment_parts,
        [
            "Curriculum",
            "Program Structure",
            "Programme Structure",
            "Programme structures and features",
            "award requirements",
            "course structure",
            "course offered",
        ],
        max_parts=18,
    )
    career = section_after_keyword(
        segment_parts,
        [
            "Career opportunities",
            "Career Opportunity",
            "Career Prospects",
            "career choices",
            "graduates",
            "job opportunities",
            "employment",
        ],
        max_parts=14,
    )
    entry_requirement = section_after_keyword(
        segment_parts,
        [
            "Entry Requirements",
            "Entry requirement",
            "Admission Requirements",
            "University General Requirements",
            "Programme Specific Requirements",
        ],
        max_parts=20,
    )
    duration = parse_duration(segment_text)
    if duration["status"] == "not-confirmed" and shared_detail_count == 1:
        duration = parse_duration(full_page_text)
    if not curriculum and shared_detail_count == 1:
        curriculum = section_after_keyword(
            parts,
            [
                "Curriculum",
                "Program Structure",
                "Programme Structure",
                "Programme structures and features",
                "award requirements",
                "course structure",
                "course offered",
                "Classification of Courses",
            ],
            max_parts=22,
        )
    if not career and shared_detail_count == 1:
        career = section_after_keyword(
            parts,
            [
                "Career opportunities",
                "Career Opportunity",
                "Career Prospects",
                "career choices",
                "graduates",
                "job opportunities",
                "employment",
            ],
            max_parts=16,
        )
    if not entry_requirement and shared_detail_count == 1:
        entry_requirement = section_after_keyword(
            parts,
            [
                "Entry Requirements",
                "Entry requirement",
                "Admission Requirements",
                "University General Requirements",
                "Programme Specific Requirements",
            ],
            max_parts=26,
        )
    language_instruction = None
    lang_match = re.search(r"Language\(s\) of Instruction\s+([A-Za-z ]+(?:and [A-Za-z ]+)?)", segment_text)
    if lang_match:
        language_instruction = clean(lang_match.group(1))
    elif "English and Bahasa Melayu" in segment_text:
        language_instruction = "English and Bahasa Melayu"
    mqa_codes = sorted(set(re.findall(r"MQA/[A-Z0-9]+", segment_text)))
    accreditation = []
    for token in ["Engineering Accreditation Council", "Board of Engineers Malaysia", "MQA"]:
        if token.lower() in segment_text.lower():
            accreditation.append(token)
    return {
        "status": status,
        "sourceId": detail_source["id"],
        "sourceUrl": detail_source.get("finalUrl") or detail_source["url"],
        "sourcePath": detail_source["localPath"],
        "anchorScore": round(best_score, 3),
        "officialDetailTitle": title,
        "overviewText": overview,
        "duration": duration,
        "studyMode": "Full Time" if re.search(r"\bFull Time\b", segment_text, re.IGNORECASE) else "not-confirmed",
        "languageOfInstruction": language_instruction or "not-confirmed",
        "mqaCodes": mqa_codes,
        "accreditation": accreditation,
        "entryRequirementText": entry_requirement,
        "curriculumText": curriculum,
        "careerText": career,
        "evidenceText": segment_text[:4000],
    }


def resolve_fee(record: dict[str, Any], fees: dict[str, dict[str, Any]]) -> tuple[dict[str, Any] | None, str]:
    name = record["nameEnOfficial"]
    if name in MJIIT_PROGRAMMES and name in fees:
        return fees[name], "programme-specific"
    category = FEE_CATEGORY_BY_PROGRAMME.get(name)
    if not category:
        faculty = record["facultyEn"]
        if "Engineering" in faculty:
            category = "Engineering"
        elif "Computing" in faculty:
            category = "Computer / IT"
        elif "Science" in faculty:
            category = "Sciences"
    if category and category in fees:
        fee = dict(fees[category])
        fee["feeCategory"] = category
        return fee, "field-category"
    return None, "unmapped"


def build_outputs(args: argparse.Namespace) -> dict[str, Any]:
    raw_dir = args.raw_dir
    raw_dir.mkdir(parents=True, exist_ok=True)
    source_index = []
    for source_id, url in OFFICIAL_SOURCES.items():
        suffix = ".pdf" if url.lower().endswith(".pdf") else ".html"
        path = raw_dir / f"{source_id}{suffix}"
        if args.fetch or not path.exists():
            source = fetch(url, path)
        else:
            source = {
                "url": url,
                "finalUrl": url,
                "localPath": str(path),
                "sha256": sha256(path),
                "bytes": path.stat().st_size,
                "retrievedAt": now_iso(),
                "status": "verified-cache",
            }
        source.update(
            {
                "id": source_id,
                "sourceRole": {
                    "undergraduate-international": "level-entry",
                    "offered-allcourses-international": "level-catalogue",
                    "programme-fees-ug-international": "fee-table",
                    "entry-requirements-ug-international": "entry-requirements",
                    "english-language-requirements": "language-requirements",
                    "latest-ug-programme-sept-2026-intake": "current-intake-pdf",
                }[source_id],
                "officialDomain": "admission.utm.my",
            }
        )
        source_index.append(source)

    catalogue = parse_catalogue(raw_dir / "offered-allcourses-international.html")
    fees = parse_fees(raw_dir / "programme-fees-ug-international.html")
    pdf_programmes = parse_pdf_programmes(raw_dir / "latest-ug-programme-sept-2026-intake.pdf")
    requirements = extract_general_requirements(raw_dir / "entry-requirements-ug-international.html")
    language_requirements = parse_language_scores(raw_dir / "english-language-requirements.html")
    pdf_names = {item["nameEnOfficial"] for item in pdf_programmes}
    pdf_keys = {name_key(item["nameEnOfficial"]) for item in pdf_programmes}

    campus_by_key: dict[str, list[str]] = {}
    pdf_pages_by_key: dict[str, list[int]] = {}
    for item in pdf_programmes:
        key = name_key(item["nameEnOfficial"])
        campus_by_key.setdefault(key, [])
        if item["campus"] not in campus_by_key[key]:
            campus_by_key[key].append(item["campus"])
        pdf_pages_by_key.setdefault(key, [])
        if item["sourcePage"] not in pdf_pages_by_key[key]:
            pdf_pages_by_key[key].append(item["sourcePage"])

    programmes = []
    exceptions = []
    for record in catalogue:
        fee, fee_basis = resolve_fee(record, fees)
        is_open = record["applicationStatus"] == "open"
        key = name_key(record["nameEnOfficial"])
        in_pdf = key in pdf_keys
        status = "ready-for-detail-enrichment" if is_open and in_pdf and fee else "needs-review"
        if not is_open:
            status = "current-cycle-not-open"
        if is_open and not in_pdf:
            exceptions.append(
                {
                    "programme": record["nameEnOfficial"],
                    "severity": "blocking",
                    "type": "catalogue-pdf-mismatch",
                    "message": "Open HTML catalogue row is absent from September 2026 intake PDF.",
                }
            )
        if is_open and not fee:
            exceptions.append(
                {
                    "programme": record["nameEnOfficial"],
                    "severity": "blocking",
                    "type": "fee-unmapped",
                    "message": "No official fee category mapping was resolved.",
                }
            )
        if record["detailUrl"] is None:
            exceptions.append(
                {
                    "programme": record["nameEnOfficial"],
                    "severity": "review",
                    "type": "detail-url-missing",
                    "message": "The official catalogue row did not expose a detail URL.",
                }
            )
        programmes.append(
            {
                **record,
                "slug": f"utm-bachelor-{slugify(record['nameEnOfficial'])}",
                "level": "bachelor",
                "applicantScope": "international",
                "canonicalDecision": {
                    "isCanonicalProgramme": True,
                    "currentCycleStatus": status,
                    "campuses": campus_by_key.get(key, ["UTM Johor Bahru"]),
                    "pdfSourcePages": pdf_pages_by_key.get(key, []),
                },
                "tuition": fee
                if fee
                else {
                    "status": "needs-review",
                    "feeCategory": None,
                    "sourceRole": "official-fee-table-unmapped",
                },
                "tuitionMappingBasis": fee_basis,
                "generalRequirements": requirements,
                "languageRequirements": language_requirements,
                "sourceUrls": {
                    "catalogue": OFFICIAL_SOURCES["offered-allcourses-international"],
                    "currentIntakePdf": OFFICIAL_SOURCES["latest-ug-programme-sept-2026-intake"],
                    "fees": OFFICIAL_SOURCES["programme-fees-ug-international"],
                    "entryRequirements": OFFICIAL_SOURCES["entry-requirements-ug-international"],
                    "languageRequirements": OFFICIAL_SOURCES["english-language-requirements"],
                    "detail": record["detailUrl"],
                },
                "fieldCoverage": {
                    "identity": "official-catalogue-and-current-intake-pdf",
                    "detailPage": "url-captured-not-yet-parsed",
                    "tuition": "official-total" if fee else "needs-review",
                    "entryRequirements": "general-rule-and-country-table-present",
                    "languageRequirements": language_requirements["status"],
                    "curriculum": "detail-page-pending",
                    "careers": "official-unpublished",
                    "localization": "pending-after-fact-lock",
                },
            }
        )

    detail_sources_by_url, detail_source_records = fetch_detail_sources(
        programmes, raw_dir, args.fetch_details or args.fetch, args.request_delay
    )
    supplemental_sources_by_id, supplemental_source_records = fetch_supplemental_sources(
        raw_dir, args.fetch_details or args.fetch, args.request_delay
    )
    supplemental_duration_by_programme = build_supplemental_duration_by_programme(supplemental_sources_by_id)
    detail_url_counts: dict[str, int] = {}
    for item in programmes:
        if item["canonicalDecision"]["currentCycleStatus"] not in {"ready-for-detail-enrichment", "current-cycle-not-open"}:
            continue
        detail_url = canonical_detail_url(item.get("detailUrl"))
        if detail_url:
            detail_url_counts[detail_url] = detail_url_counts.get(detail_url, 0) + 1
    source_index.extend(detail_source_records)
    source_index.extend(supplemental_source_records)
    for programme in programmes:
        detail_url = canonical_detail_url(programme.get("detailUrl"))
        detail = parse_programme_detail(
            programme,
            detail_sources_by_url.get(detail_url) if detail_url else None,
            detail_url_counts.get(detail_url, 1) if detail_url else 1,
        )
        if detail.get("duration", {}).get("status") != "programme-specific":
            supplemental_duration = supplemental_duration_by_programme.get(programme["nameEnOfficial"])
            if supplemental_duration:
                detail["duration"] = supplemental_duration
                detail["supplementalDurationEvidence"] = {
                    "sourceId": supplemental_duration["sourceId"],
                    "sourceUrl": supplemental_duration["sourceUrl"],
                    "sourcePath": supplemental_duration["sourcePath"],
                    "sourceRole": "supplemental-programme-handbook",
                }
            elif detail_url in FACULTY_SHARED_DURATION_EVIDENCE:
                evidence = FACULTY_SHARED_DURATION_EVIDENCE[detail_url]
                detail["duration"] = dict(evidence["duration"])
                detail["supplementalDurationEvidence"] = {
                    "sourceId": "faculty-shared-detail-page",
                    "sourceUrl": detail_url,
                    "sourcePath": detail.get("sourcePath"),
                    "sourceRole": evidence["note"],
                }
        programme["programmeDetail"] = detail
        programme["fieldCoverage"]["detailPage"] = detail["status"]
        programme["fieldCoverage"]["duration"] = detail.get("duration", {}).get("status", "not-confirmed")
        programme["fieldCoverage"]["languageOfInstruction"] = (
            "programme-specific" if detail.get("languageOfInstruction") not in {None, "not-confirmed"} else "official-unpublished"
        )
        programme["fieldCoverage"]["programmeSpecificAcademicRequirements"] = (
            "programme-specific" if detail.get("entryRequirementText") else "general-rule"
        )
        programme["fieldCoverage"]["curriculum"] = "programme-specific" if detail.get("curriculumText") else "official-unpublished"
        programme["fieldCoverage"]["careers"] = "programme-specific" if detail.get("careerText") else "official-unpublished"

    open_programmes = [item for item in programmes if item["applicationStatus"] == "open"]
    closed_programmes = [item for item in programmes if item["applicationStatus"] != "open"]
    ready = [item for item in programmes if item["canonicalDecision"]["currentCycleStatus"] == "ready-for-detail-enrichment"]
    review = [item for item in programmes if item["canonicalDecision"]["currentCycleStatus"] == "needs-review"]
    current_cycle_not_open = [item for item in programmes if item["canonicalDecision"]["currentCycleStatus"] == "current-cycle-not-open"]

    pdf_unique_names = sorted({item["nameEnOfficial"] for item in pdf_programmes})
    html_keys = {name_key(item["nameEnOfficial"]) for item in catalogue}
    for name in sorted(name for name in set(pdf_unique_names) if name_key(name) not in html_keys):
        exceptions.append(
            {
                "programme": name,
                "severity": "review",
                "type": "pdf-not-in-html-catalogue",
                "message": "Programme appears in September 2026 PDF but not in the current All Courses HTML catalogue.",
            }
        )

    run_contract = {
        "institutionIdentifier": "UTM",
        "institutionNameOfficial": "Universiti Teknologi Malaysia",
        "collectionScope": "programmes",
        "requestedLevel": "bachelor",
        "applicantScope": "international",
        "academicSession": "September 2026 intake / 2026-2027 application cycle where published",
        "currentAsOfDate": args.current_as_of,
        "authorization": "collect",
        "selectedChineseTask": "Current user instruction; no dedicated UTM Notion snapshot task found locally.",
        "prdAndTechnicalDesign": [
            "docs/notion-snapshot/产品需求文档.md",
            "docs/notion-snapshot/技术方案.md",
            "docs/prd/USM-master-official-collection-technical-design.md",
        ],
        "outputPath": str(args.output_dir),
        "verificationCommands": [
            f"python3 {Path(__file__).as_posix()} --verify --output-dir {args.output_dir.as_posix()}",
        ],
        "rollbackTarget": "No database mutation; remove generated UTM artifact directory if needed.",
        "notionOrLocalNoteUpdatePath": "docs/notion-snapshot/开发进度日志.md (not updated automatically in this run)",
    }

    level_manifest = {
        "universityCode": "UTM",
        "officialDomains": ["utm.my", "admission.utm.my"],
        "level": "bachelor",
        "applicantScope": "international",
        "academicSession": run_contract["academicSession"],
        "retrievedAt": now_iso(),
        "officialLevelSources": [
            OFFICIAL_SOURCES["offered-allcourses-international"],
            OFFICIAL_SOURCES["latest-ug-programme-sept-2026-intake"],
        ],
        "directoryOccurrences": len(catalogue),
        "uniqueHtmlEntries": len({item["nameEnOfficial"] for item in catalogue}),
        "currentIntakePdfOccurrences": len(pdf_programmes),
        "currentIntakePdfUniqueEntries": len(pdf_unique_names),
        "canonicalCount": len(programmes),
        "publicCandidateCount": len(ready),
        "needsReviewCount": len(review),
        "currentCycleNotOpenCount": len(current_cycle_not_open),
        "internationalUnavailableCount": 0,
        "detailSourceCount": len(detail_source_records),
        "detailTransportErrorCount": sum(1 for item in detail_source_records if item["status"] == "transport-error"),
        "programmeOrder": [
            {
                "ordinal": item["ordinal"],
                "nameEnOfficial": item["nameEnOfficial"],
                "facultyEn": item["facultyEn"],
                "status": item["canonicalDecision"]["currentCycleStatus"],
                "detailUrl": item["detailUrl"],
            }
            for item in programmes
        ],
    }

    gap_audit = {
        "checkedRecords": len(programmes),
        "officialValueRecords": {
            "identity": len(programmes),
            "faculty": sum(1 for item in programmes if item["facultyEn"]),
            "intake": sum(1 for item in programmes if item["intakeMonths"]),
            "tuitionTotal": sum(1 for item in programmes if item["fieldCoverage"]["tuition"] == "official-total"),
            "detailUrl": sum(1 for item in programmes if item["detailUrl"]),
            "detailPageParsed": sum(1 for item in programmes if item["fieldCoverage"]["detailPage"] == "official-detail-parsed"),
            "duration": sum(1 for item in programmes if item["fieldCoverage"]["duration"] == "programme-specific"),
            "entryRequirements": len(programmes),
            "programmeSpecificAcademicRequirements": sum(
                1 for item in programmes if item["fieldCoverage"].get("programmeSpecificAcademicRequirements") == "programme-specific"
            ),
            "languageRequirements": len(programmes) if language_requirements["scores"] else 0,
            "curriculum": sum(1 for item in programmes if item["fieldCoverage"]["curriculum"] == "programme-specific"),
            "careers": sum(1 for item in programmes if item["fieldCoverage"]["careers"] == "programme-specific"),
            "localization": 0,
        },
        "missingOrWeakFields": {
            "languageRequirements": 0 if language_requirements["scores"] else len(programmes),
            "duration": sum(1 for item in programmes if item["fieldCoverage"]["duration"] != "programme-specific"),
            "curriculum": sum(1 for item in programmes if item["fieldCoverage"]["curriculum"] != "programme-specific"),
            "programmeSpecificAcademicRequirements": sum(
                1 for item in programmes if item["fieldCoverage"].get("programmeSpecificAcademicRequirements") != "programme-specific"
            ),
            "careers": sum(1 for item in programmes if item["fieldCoverage"]["careers"] != "programme-specific"),
            "fourLocaleLocalization": len(programmes),
        },
        "sourceNotes": [
            "The current All Courses HTML governs live catalogue rows and current application status.",
            "The September 2026 PDF governs the current advertised intake list and application dates.",
            "The international fee page publishes field-level totals and selected programme-level MJIIT totals.",
            "Faculty detail pages govern programme overview, duration, curriculum, accreditation, and careers when parsed.",
        ],
    }

    diff_audit = {
        "htmlOpenCount": len(open_programmes),
        "htmlClosedCurrentCycleCount": len(closed_programmes),
        "pdfUniqueCurrentIntakeCount": len(pdf_unique_names),
        "htmlOpenNotInPdf": sorted(
            item["nameEnOfficial"] for item in open_programmes if name_key(item["nameEnOfficial"]) not in pdf_keys
        ),
        "pdfNotInHtmlCatalogue": sorted(name for name in set(pdf_unique_names) if name_key(name) not in html_keys),
        "duplicatePdfNames": sorted(
            name for name in pdf_unique_names if sum(1 for item in pdf_programmes if item["nameEnOfficial"] == name) > 1
        ),
        "detailCoverage": {
            "detailSources": len(detail_source_records),
            "transportErrors": [
                {"sourceId": item["id"], "url": item["url"], "error": item.get("error")}
                for item in detail_source_records
                if item["status"] == "transport-error"
            ],
            "programmeAnchorNotFound": [
                item["nameEnOfficial"]
                for item in programmes
                if item.get("programmeDetail", {}).get("status") == "source-parsed-programme-anchor-not-found"
            ],
        },
        "closedHtmlRows": [
            {
                "nameEnOfficial": item["nameEnOfficial"],
                "facultyEn": item["facultyEn"],
                "intakeText": item["intakeText"],
            }
            for item in closed_programmes
        ],
    }

    return {
        "run_contract": run_contract,
        "level_manifest": level_manifest,
        "source_cache_index": source_index,
        "candidate_dataset": {
            "universityCode": "UTM",
            "institutionNameOfficial": "Universiti Teknologi Malaysia",
            "officialDomains": ["utm.my", "admission.utm.my"],
            "level": "bachelor",
            "applicantScope": "international",
            "academicSession": run_contract["academicSession"],
            "programmeCount": len(programmes),
            "programmes": programmes,
        },
        "exception_queue": exceptions,
        "pre_import_gap_audit": gap_audit,
        "current_official_diff_audit": diff_audit,
        "post_import_display_audit": {
            "status": "not-applicable",
            "reason": "Collect-only run; no database/API/UI mutation authorized.",
        },
    }


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


def verify(output_dir: Path) -> list[str]:
    issues: list[str] = []
    required = [
        "run-contract.json",
        "level-manifest.json",
        "source-cache-index.json",
        "candidate-dataset.json",
        "exception-queue.json",
        "pre-import-gap-audit.json",
        "current-official-diff-audit.json",
        "post-import-display-audit.json",
    ]
    for name in required:
        if not (output_dir / name).exists():
            issues.append(f"missing artifact: {name}")
    if issues:
        return issues
    manifest = json.loads((output_dir / "level-manifest.json").read_text())
    candidate = json.loads((output_dir / "candidate-dataset.json").read_text())
    sources = json.loads((output_dir / "source-cache-index.json").read_text())
    if manifest["directoryOccurrences"] != 44:
        issues.append(f"expected 44 HTML directory rows, got {manifest['directoryOccurrences']}")
    if manifest["currentIntakePdfUniqueEntries"] != 40:
        issues.append(f"expected 40 unique current-intake PDF programmes, got {manifest['currentIntakePdfUniqueEntries']}")
    if manifest["publicCandidateCount"] != 40:
        issues.append(f"expected 40 public candidate rows, got {manifest['publicCandidateCount']}")
    if manifest.get("currentCycleNotOpenCount") != 4:
        issues.append(
            f"expected 4 current-cycle not-open HTML rows, got {manifest.get('currentCycleNotOpenCount')}"
        )
    if manifest["internationalUnavailableCount"] != 0:
        issues.append(f"expected 0 international unavailable rows, got {manifest['internationalUnavailableCount']}")
    if manifest.get("detailSourceCount", 0) < 30:
        issues.append(f"expected at least 30 unique programme detail sources, got {manifest.get('detailSourceCount', 0)}")
    if manifest.get("detailTransportErrorCount", 0) != 0:
        issues.append(f"expected 0 detail transport errors, got {manifest.get('detailTransportErrorCount', 0)}")
    if len(candidate["programmes"]) != manifest["canonicalCount"]:
        issues.append("candidate programme count does not match manifest canonical count")
    if not all(re.fullmatch(r"[a-f0-9]{64}", item.get("sha256", "")) for item in sources):
        issues.append("one or more source hashes are not SHA-256")
    if any(item["level"] != "bachelor" for item in candidate["programmes"]):
        issues.append("candidate contains non-bachelor records")
    if any(item["applicantScope"] != "international" for item in candidate["programmes"]):
        issues.append("candidate contains non-international records")
    public_records = [
        item
        for item in candidate["programmes"]
        if item["canonicalDecision"]["currentCycleStatus"] in {"ready-for-detail-enrichment", "current-cycle-not-open"}
    ]
    parsed_details = [
        item for item in public_records if item.get("programmeDetail", {}).get("status") == "official-detail-parsed"
    ]
    if len(parsed_details) < 38:
        issues.append(f"expected at least 38 parsed visible programme details, got {len(parsed_details)}")
    if not any(item.get("languageRequirements", {}).get("scores") for item in candidate["programmes"]):
        issues.append("general English language scores were not parsed")
    official_duration_records = [
        item
        for item in candidate["programmes"]
        if item.get("programmeDetail", {}).get("duration", {}).get("status") == "programme-specific"
        and item.get("programmeDetail", {}).get("duration", {}).get("officialText")
        and (
            item.get("programmeDetail", {}).get("duration", {}).get("minYears")
            or item.get("programmeDetail", {}).get("duration", {}).get("semesters")
        )
    ]
    if len(official_duration_records) != 44:
        issues.append(f"expected 44 official duration records, got {len(official_duration_records)}")
    first_scores = candidate["programmes"][0].get("languageRequirements", {}).get("scores", {})
    expected_scores = {"IELTS": 5.5, "TOEFL_iBT": 46, "MUET": 4.0, "PTE_Academic": 51}
    for key, expected in expected_scores.items():
        if first_scores.get(key) != expected:
            issues.append(f"expected English score {key}={expected}, got {first_scores.get(key)}")
    return issues


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=Path("data/imports/utm/2026-06-16/undergraduate"))
    parser.add_argument("--raw-dir", type=Path, default=Path("data/imports/utm/2026-06-16/undergraduate/sources"))
    parser.add_argument("--current-as-of", default="2026-06-16")
    parser.add_argument("--fetch", action="store_true")
    parser.add_argument("--fetch-details", action="store_true")
    parser.add_argument("--request-delay", type=float, default=0.35)
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()

    if args.verify:
        issues = verify(args.output_dir)
        if issues:
            for issue in issues:
                print(f"VERIFY FAIL: {issue}", file=sys.stderr)
            return 1
        print("VERIFY PASS: UTM undergraduate collect-only artifacts are internally consistent.")
        return 0

    outputs = build_outputs(args)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    names = {
        "run_contract": "run-contract.json",
        "level_manifest": "level-manifest.json",
        "source_cache_index": "source-cache-index.json",
        "candidate_dataset": "candidate-dataset.json",
        "exception_queue": "exception-queue.json",
        "pre_import_gap_audit": "pre-import-gap-audit.json",
        "current_official_diff_audit": "current-official-diff-audit.json",
        "post_import_display_audit": "post-import-display-audit.json",
    }
    for key, name in names.items():
        write_json(args.output_dir / name, outputs[key])
    print(json.dumps(outputs["level_manifest"], ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
