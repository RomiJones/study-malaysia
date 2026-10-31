#!/usr/bin/env python3
"""Collect and audit SEGi University official programme data.

This script is intentionally audit-only. It reads the current local database,
fetches SEGi University official programme pages, and writes comparison
artifacts without mutating application data.
"""

from __future__ import annotations

import csv
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data/imports/segi/2026-06-16/official-audit"
RAW_DIR = OUT_DIR / "raw"
COURSE_SEARCH_URL = "https://university.segi.edu.my/course-search/"
USER_AGENT = "Mozilla/5.0 (StudyMY SEGi official audit; contact: local-dev)"
RUN_DATE = "2026-06-16"


@dataclass
class CacheEntry:
    url: str
    localPath: str
    sha256: str
    statusCode: int
    byteLength: int
    fetchedAt: str


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def compact(text: str | None) -> str:
    return " ".join((text or "").replace("\xa0", " ").split())


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"https?://", "", value)
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")[:130] or "page"


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def fetch_html(url: str, cache_name: str, cache: list[CacheEntry]) -> str:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    response = requests.get(url, timeout=45, headers={"User-Agent": USER_AGENT})
    response.raise_for_status()
    html = response.text
    sha = hashlib.sha256(response.content).hexdigest()
    local_path = RAW_DIR / f"{cache_name}.html"
    local_path.write_text(html, encoding="utf-8")
    cache.append(
        CacheEntry(
            url=url,
            localPath=str(local_path.relative_to(ROOT)),
            sha256=f"sha256:{sha}",
            statusCode=response.status_code,
            byteLength=len(response.content),
            fetchedAt=now_iso(),
        )
    )
    return html


def parse_directory_page(html: str, page_url: str, page_number: int) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    records: list[dict[str, Any]] = []
    for item in soup.select("div.gdlr-core-course-item-list"):
        link = item.find("a", href=True, string=lambda value: value and "More Detail" in value)
        title_node = item.select_one("h3.gdlr-core-course-item-title")
        if not link or not title_node:
            continue

        id_node = title_node.select_one(".gdlr-core-course-item-id")
        course_id = compact(id_node.get_text(" ", strip=True)) if id_node else ""
        if id_node:
            id_node.extract()
        title = compact(title_node.get_text(" ", strip=True))

        info: dict[str, str] = {}
        for info_node in item.select(".gdlr-core-course-item-info"):
            head = info_node.select_one(".gdlr-core-head")
            tail = info_node.select_one(".gdlr-core-tail")
            if head and tail:
                key = compact(head.get_text(" ", strip=True)).replace(":", "").strip()
                info[key] = compact(tail.get_text(" ", strip=True))

        records.append(
            {
                "sourceListPage": page_url,
                "sourceListPageNumber": page_number,
                "title": title,
                "courseId": course_id,
                "fieldOfInterest": info.get("Field of Interest", ""),
                "campus": info.get("Campus", ""),
                "levelOfStudyRaw": info.get("Level of Study", ""),
                "detailUrl": link["href"],
            }
        )
    return records


def parse_detail_page(html: str, url: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    title = compact(soup.find("h1").get_text(" ", strip=True) if soup.find("h1") else "")
    info: dict[str, str] = {}
    for column in soup.select(".gdlr-core-course-info-item-inner .gdlr-core-pbf-column"):
        head = column.select_one(".gdlr-core-head")
        tail = column.select_one(".gdlr-core-tail")
        if head and tail:
            info[compact(head.get_text(" ", strip=True))] = compact(tail.get_text(" ", strip=True))

    accordions: dict[str, str] = {}
    for tab in soup.select(".gdlr-core-accordion-item-tab"):
        heading = tab.select_one(".gdlr-core-accordion-item-title")
        content = tab.select_one(".gdlr-core-accordion-item-content")
        if heading and content:
            accordions[compact(heading.get_text(" ", strip=True))] = compact(content.get_text(" ", strip=True))

    body_text = compact(soup.get_text(" ", strip=True))
    intake_text = next(
        (value for key, value in accordions.items() if "intake" in key.lower() and "orientation" in key.lower()),
        "",
    )
    entry_text = next((value for key, value in accordions.items() if "entry" in key.lower()), "")
    english_text = next((value for key, value in accordions.items() if "english" in key.lower()), "")
    programme_structure_text = next(
        (
            value
            for key, value in accordions.items()
            if "programme structure" in key.lower() or "program structure" in key.lower() or "module" in key.lower()
        ),
        "",
    )
    career_text = next((value for key, value in accordions.items() if "career" in key.lower()), "")
    accreditation_text = next((value for key, value in accordions.items() if "accreditation" in key.lower()), "")
    overview_text = ""
    overview_candidates = [
        compact(node.get_text(" ", strip=True))
        for node in soup.select(".gdlr-core-text-box-item-content")
        if compact(node.get_text(" ", strip=True))
    ]
    for candidate in overview_candidates:
        lower = candidate.lower()
        if not any(token in lower for token in ["get more info", "one programme", "download brochure"]):
            overview_text = candidate
            break
    mqa_links = [
        link["href"]
        for link in soup.find_all("a", href=True)
        if "mqa" in compact(link.get_text(" ", strip=True)).lower() or "mqa" in link["href"].lower()
    ]

    return {
        "detailUrl": url,
        "detailTitle": title,
        "detailInfo": info,
        "accordionSections": accordions,
        "overviewText": overview_text,
        "entryRequirementsText": entry_text,
        "englishRequirementsText": english_text,
        "programmeStructureText": programme_structure_text,
        "careerText": career_text,
        "intakeText": intake_text,
        "accreditationText": accreditation_text,
        "mqaLinks": mqa_links,
        "hasTuitionOnPage": bool(re.search(r"\b(tuition|course fee|programme fee|program fee)\b", body_text, re.I)),
        "hasDurationOnPage": bool(re.search(r"\b(duration|full[- ]?time duration|study duration)\b", body_text, re.I)),
        "ieltsMention": extract_ielts(entry_text or body_text),
    }


def extract_ielts(text: str) -> str:
    match = re.search(r"IELTS[^.;\n]{0,80}", text, re.I)
    return compact(match.group(0)) if match else ""


def classify_level(title: str, raw_level: str) -> str:
    value = f"{title} {raw_level}".lower()
    if raw_level == "Bachelor Degree":
        return "bachelor"
    if "postgraduate certificate" in value:
        return "postgraduate-certificate"
    if re.search(r"\b(doctor|phd|dba)\b", value):
        return "phd"
    if re.search(r"\bmaster\b", value):
        return "master"
    return "other"


def delivery_mode(title: str) -> str:
    lower = title.lower()
    if "odl" in lower or "online mode" in lower:
        return "online-or-odl"
    return "conventional-or-unspecified"


def normalize_title(title: str) -> str:
    value = title.lower()
    value = value.replace("&", " and ")
    value = re.sub(r"\bhons\b", "honours", value)
    value = re.sub(r"\bhonors\b", "honours", value)
    value = re.sub(r"\bwith honours\b", "honours", value)
    value = re.sub(r"\bhonours?\b", "honours", value)
    value = re.sub(r"\bll\.?m\b", "llm", value)
    value = re.sub(r"\bm\.?b\.?b\.?s\.?\b", "mbbs", value)
    value = re.sub(r"\bby research\b", "research", value)
    value = re.sub(r"\bcoursework\b", "coursework", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return compact(value)


def title_score(left: str, right: str) -> float:
    left_norm = normalize_title(left)
    right_norm = normalize_title(right)
    seq = SequenceMatcher(None, left_norm, right_norm).ratio()
    left_tokens = set(left_norm.split())
    right_tokens = set(right_norm.split())
    if not left_tokens or not right_tokens:
        return seq
    jaccard = len(left_tokens & right_tokens) / len(left_tokens | right_tokens)
    return round((seq * 0.7) + (jaccard * 0.3), 4)


def run_mysql_query() -> list[dict[str, Any]]:
    query = """
SELECT
  id,
  code,
  slug,
  JSON_UNQUOTE(JSON_EXTRACT(name, '$.en')) AS name_en,
  nameEnOfficial,
  level,
  category,
  campus,
  CAST(durationYears AS CHAR),
  durationOfficial,
  IFNULL(CAST(tuitionAmount AS CHAR), ''),
  tuitionCurrency,
  IFNULL(CAST(officialTuitionMYR AS CHAR), ''),
  officialIntake,
  officialSourceUrl,
  publicDisplayStatus,
  officialSourceStatus,
  officialFeeAuditStatus
FROM programs
WHERE universityId = (SELECT id FROM universities WHERE code = 'SEGI' LIMIT 1)
  AND publicDisplayStatus = 'ready'
ORDER BY FIELD(level, 'bachelor', 'master', 'phd'), name_en;
""".strip()
    mysql_bin = os.environ.get("MYSQL_BIN", "/usr/local/mysql/bin/mysql")
    command = [
        mysql_bin,
        f"-u{os.environ.get('MYSQL_USER', 'root')}",
        f"-p{os.environ.get('MYSQL_PASSWORD', '123456')}",
        "-h",
        os.environ.get("MYSQL_HOST", "127.0.0.1"),
        "-P",
        os.environ.get("MYSQL_PORT", "3306"),
        "-D",
        os.environ.get("MYSQL_DATABASE", "study_malaysia"),
        "--batch",
        "--raw",
        "--skip-column-names",
        "-e",
        query,
    ]
    result = subprocess.run(command, cwd=ROOT, check=True, capture_output=True, text=True)
    rows: list[dict[str, Any]] = []
    for parsed in csv.reader(result.stdout.splitlines(), delimiter="\t"):
        if not parsed:
            continue
        rows.append(
            {
                "id": parsed[0],
                "code": parsed[1],
                "slug": parsed[2],
                "nameEn": parsed[3],
                "nameEnOfficial": parsed[4],
                "level": parsed[5],
                "category": parsed[6],
                "campus": parsed[7],
                "durationYears": parsed[8],
                "durationOfficial": parsed[9],
                "tuitionAmount": parsed[10],
                "tuitionCurrency": parsed[11],
                "officialTuitionMYR": parsed[12],
                "officialIntake": parsed[13],
                "officialSourceUrl": parsed[14],
                "publicDisplayStatus": parsed[15],
                "officialSourceStatus": parsed[16],
                "officialFeeAuditStatus": parsed[17],
                "deliveryMode": delivery_mode(parsed[4] or parsed[3]),
            }
        )
    return rows


def best_match(record: dict[str, Any], candidates: list[dict[str, Any]]) -> tuple[int | None, float]:
    best_index: int | None = None
    best_score = 0.0
    for index, candidate in enumerate(candidates):
        if record["level"] != candidate["standardLevel"]:
            continue
        score = title_score(record["nameEnOfficial"] or record["nameEn"], candidate["title"])
        if record["deliveryMode"] != candidate["deliveryMode"]:
            score -= 0.08
        if score > best_score:
            best_index = index
            best_score = round(score, 4)
    return best_index, best_score


def compare_records(current_rows: list[dict[str, Any]], official_rows: list[dict[str, Any]]) -> dict[str, Any]:
    unmatched_official = list(range(len(official_rows)))
    unmatched_current = list(range(len(current_rows)))
    matches: list[dict[str, Any]] = []

    for current_index, current in enumerate(current_rows):
        for official_index in list(unmatched_official):
            official = official_rows[official_index]
            if current["level"] != official["standardLevel"]:
                continue
            if normalize_title(current["nameEnOfficial"] or current["nameEn"]) == normalize_title(official["title"]):
                matches.append(make_match(current, official, 1.0, "normalized-title-exact"))
                unmatched_current.remove(current_index)
                unmatched_official.remove(official_index)
                break

    changed = True
    while changed:
        changed = False
        best_pair: tuple[int, int, float] | None = None
        for current_index in unmatched_current:
            current = current_rows[current_index]
            candidates = [official_rows[i] for i in unmatched_official]
            local_index, score = best_match(current, candidates)
            if local_index is None or score < 0.84:
                continue
            official_index = unmatched_official[local_index]
            if best_pair is None or score > best_pair[2]:
                best_pair = (current_index, official_index, score)
        if best_pair:
            current_index, official_index, score = best_pair
            matches.append(make_match(current_rows[current_index], official_rows[official_index], score, "fuzzy-title-review"))
            unmatched_current.remove(current_index)
            unmatched_official.remove(official_index)
            changed = True

    current_only = []
    for index in unmatched_current:
        current = current_rows[index]
        official_candidates = [row for row in official_rows if row["standardLevel"] == current["level"]]
        best_idx, best_score = best_match(current, official_candidates)
        current_only.append(
            {
                "current": current,
                "bestOfficialCandidate": official_candidates[best_idx] if best_idx is not None else None,
                "bestScore": best_score,
            }
        )

    official_only = []
    for index in unmatched_official:
        official = official_rows[index]
        current_candidates = [row for row in current_rows if row["level"] == official["standardLevel"]]
        best_current = None
        best_score = 0.0
        for current in current_candidates:
            score = title_score(current["nameEnOfficial"] or current["nameEn"], official["title"])
            if current["deliveryMode"] != official["deliveryMode"]:
                score -= 0.08
            if score > best_score:
                best_current = current
                best_score = round(score, 4)
        official_only.append({"official": official, "bestCurrentCandidate": best_current, "bestScore": best_score})

    return {"matches": matches, "currentOnly": current_only, "officialOnly": official_only}


def make_match(current: dict[str, Any], official: dict[str, Any], score: float, method: str) -> dict[str, Any]:
    return {
        "matchMethod": method,
        "score": score,
        "current": current,
        "official": official,
        "titleChanged": normalize_title(current["nameEnOfficial"] or current["nameEn"]) != normalize_title(official["title"]),
        "sourceNeedsUpdate": not str(current.get("officialSourceUrl", "")).startswith("https://university.segi.edu.my/"),
        "officialFeePublishedOnDetailPage": official.get("detail", {}).get("hasTuitionOnPage", False),
        "officialDurationPublishedOnDetailPage": official.get("detail", {}).get("hasDurationOnPage", False),
    }


def build_exception_queue(diff: dict[str, Any], official_candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    queue: list[dict[str, Any]] = []
    for item in diff["officialOnly"]:
        official = item["official"]
        queue.append(
            {
                "type": "official-programme-missing-in-project",
                "severity": "high",
                "level": official["standardLevel"],
                "title": official["title"],
                "detailUrl": official["detailUrl"],
                "bestCurrentCandidate": item["bestCurrentCandidate"]["nameEnOfficial"] if item["bestCurrentCandidate"] else None,
                "bestScore": item["bestScore"],
                "recommendedAction": "人工确认是否将该官网当前专业新增到 SEGi University 板块；ODL/Online Mode 不应自动合并到普通授课版本。",
            }
        )
    for item in diff["currentOnly"]:
        current = item["current"]
        queue.append(
            {
                "type": "project-programme-not-found-on-official-directory",
                "severity": "high",
                "level": current["level"],
                "title": current["nameEnOfficial"] or current["nameEn"],
                "code": current["code"],
                "bestOfficialCandidate": item["bestOfficialCandidate"]["title"] if item["bestOfficialCandidate"] else None,
                "bestScore": item["bestScore"],
                "recommendedAction": "复核 2026 PDF 与官网目录命名差异；若官网已改名，先更新官方详情来源和标题后再发布。",
            }
        )
    for match in diff["matches"]:
        if match["titleChanged"]:
            queue.append(
                {
                    "type": "title-variant-needs-human-review",
                    "severity": "medium",
                    "level": match["current"]["level"],
                    "currentTitle": match["current"]["nameEnOfficial"] or match["current"]["nameEn"],
                    "officialTitle": match["official"]["title"],
                    "detailUrl": match["official"]["detailUrl"],
                    "score": match["score"],
                    "recommendedAction": "将官网标题作为英文官方名候选；中文名和商业展示名需单独确认。",
                }
            )
    missing_fee = [row for row in official_candidates if not row.get("detail", {}).get("hasTuitionOnPage")]
    if missing_fee:
        queue.append(
            {
                "type": "official-detail-pages-do-not-publish-tuition",
                "severity": "medium",
                "affectedProgrammes": len(missing_fee),
                "source": "SEGi official programme detail pages",
                "recommendedAction": "费用字段继续以用户提供的 2026 fee sheet 或官方可下载 fee document 为费用证据；官网详情页只能作为专业、入学、英语与认证来源。",
            }
        )
    return queue


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    cache: list[CacheEntry] = []
    fetched_at = now_iso()

    directory_rows: list[dict[str, Any]] = []
    for page in range(1, 11):
        url = COURSE_SEARCH_URL if page == 1 else f"https://university.segi.edu.my/course-search/page/{page}/"
        html = fetch_html(url, f"course-search-page-{page}", cache)
        rows = parse_directory_page(html, url, page)
        directory_rows.extend(rows)
        time.sleep(0.2)

    seen_urls = set()
    official_all: list[dict[str, Any]] = []
    for row in directory_rows:
        if row["detailUrl"] in seen_urls:
            continue
        seen_urls.add(row["detailUrl"])
        parsed_url = urlparse(row["detailUrl"])
        cache_name = "course-" + slugify(parsed_url.path)
        detail_html = fetch_html(row["detailUrl"], cache_name, cache)
        detail = parse_detail_page(detail_html, row["detailUrl"])
        standard_level = classify_level(row["title"], row["levelOfStudyRaw"])
        official_all.append(
            {
                **row,
                "standardLevel": standard_level,
                "deliveryMode": delivery_mode(row["title"]),
                "detail": detail,
            }
        )
        time.sleep(0.2)

    official_candidates = [row for row in official_all if row["standardLevel"] in {"bachelor", "master", "phd"}]
    current_rows = run_mysql_query()
    diff = compare_records(current_rows, official_candidates)
    exception_queue = build_exception_queue(diff, official_candidates)

    level_manifest = {
        "institution": "SEGi University",
        "institutionCode": "SEGI",
        "runDate": RUN_DATE,
        "fetchedAt": fetched_at,
        "officialDirectoryUrl": COURSE_SEARCH_URL,
        "scope": "Bachelor, Master, PhD programmes published under Campus = SEGi University",
        "officialDirectoryTotal": len(official_all),
        "officialDegreeCandidateTotal": len(official_candidates),
        "officialCountsByStandardLevel": count_by(official_candidates, "standardLevel"),
        "officialCountsByRawLevel": count_by(official_all, "levelOfStudyRaw"),
        "currentProjectReadyTotal": len(current_rows),
        "currentProjectCountsByLevel": count_by(current_rows, "level"),
        "matchedCount": len(diff["matches"]),
        "officialOnlyCount": len(diff["officialOnly"]),
        "currentOnlyCount": len(diff["currentOnly"]),
        "titleVariantMatchCount": sum(1 for item in diff["matches"] if item["titleChanged"]),
    }

    run_contract = {
        "institution": "SEGi University",
        "institutionCode": "SEGI",
        "requestedByUser": "现在开始对世纪大学的本硕博信息与官方公布的最新数据进行标准化的校对",
        "mode": "audit-only",
        "noDatabaseMutation": True,
        "currentAsOf": RUN_DATE,
        "timezone": "Asia/Kuala_Lumpur",
        "sourcePolicy": "Use SEGi official public programme directory and detail pages as current programme source; use existing project DB only for comparison.",
        "selectedChineseTaskContext": "TASK-096 数据模型和数据准备技术边界",
        "outputDirectory": str(OUT_DIR.relative_to(ROOT)),
        "blockingGateBeforeImport": "Do not import until official-only/current-only and ODL/Online Mode scope are manually approved.",
    }

    pre_import_gap_audit = {
        "status": "not-import-ready",
        "reason": "This run is a standardized official audit. It found scope and title gaps that require human confirmation before any write/publish action.",
        "blockingItems": {
            "officialOnlyProgrammes": len(diff["officialOnly"]),
            "currentOnlyProgrammes": len(diff["currentOnly"]),
            "titleVariantMatches": sum(1 for item in diff["matches"] if item["titleChanged"]),
            "officialDetailPagesWithoutTuition": sum(
                1 for row in official_candidates if not row.get("detail", {}).get("hasTuitionOnPage")
            ),
        },
        "recommendedNextStep": "Confirm whether SEGi University Online / ODL variants should be separate public programmes, then prepare a reviewed import candidate.",
    }

    write_json(OUT_DIR / "run_contract.json", run_contract)
    write_json(OUT_DIR / "source_cache_index.json", [asdict(item) for item in cache])
    write_json(OUT_DIR / "level_manifest.json", level_manifest)
    write_json(OUT_DIR / "candidate_dataset.json", official_candidates)
    write_json(OUT_DIR / "current_official_diff_audit.json", diff)
    write_json(OUT_DIR / "exception_queue.json", exception_queue)
    write_json(OUT_DIR / "pre_import_gap_audit.json", pre_import_gap_audit)
    write_json(OUT_DIR / "official_directory_all.json", official_all)

    summary = {
        "artifacts": [
            "run_contract.json",
            "source_cache_index.json",
            "level_manifest.json",
            "candidate_dataset.json",
            "current_official_diff_audit.json",
            "exception_queue.json",
            "pre_import_gap_audit.json",
            "official_directory_all.json",
        ],
        "levelManifest": level_manifest,
        "preImportGate": pre_import_gap_audit,
    }
    write_json(OUT_DIR / "summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


def count_by(rows: list[dict[str, Any]], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for row in rows:
        value = str(row.get(key) or "")
        counts[value] = counts.get(value, 0) + 1
    return dict(sorted(counts.items()))


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise
    except Exception as exc:
        print(f"SEGi official audit failed: {exc}", file=sys.stderr)
        raise
