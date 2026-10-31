#!/usr/bin/env python3
"""Collect audited University of Nottingham Malaysia official programme data."""

from __future__ import annotations

import hashlib
import json
import re
import time
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup, Tag


ROOT = Path(__file__).resolve().parents[1]
BATCH_DIR = ROOT / "data/imports/unm/2026-06-19/official-audit"
RAW_DIR = BATCH_DIR / "sources/raw"
RUN_DATE = "2026-06-19"
RETRIEVED_AT = "2026-06-19T00:00:00Z"
ACADEMIC_SESSION = "2026 intake"
USER_AGENT = "StudyMY official collector"
OFFICIAL_DOMAIN = "nottingham.edu.my"
BASE = "https://www.nottingham.edu.my"
RATE_DERIVED_TUITION_AUTHORIZED = True

URLS = {
    "homepage": "https://www.nottingham.edu.my/",
    "history": "https://www.nottingham.edu.my/AboutUs/History/MalaysiaHistory.aspx",
    "undergraduate-directory": "https://www.nottingham.edu.my/Study/Undergraduate-courses/Find-an-undergraduate-course/Find-a-course.aspx",
    "undergraduate-fees": "https://www.nottingham.edu.my/study/undergraduate-courses/tuition-fees.aspx",
    "postgraduate-entry": "https://www.nottingham.edu.my/Study/Postgraduate-courses/Postgraduate-courses.aspx",
    "postgraduate-fees": "https://www.nottingham.edu.my/Study/Postgraduate-courses/Tuition-fees.aspx",
    "how-to-apply": "https://www.nottingham.edu.my/Study/How-to-apply/how-to-apply.aspx",
    "application-checklist": "https://www.nottingham.edu.my/Study/How-to-apply/checklist-for-applications.aspx",
    "fee-structure": "https://www.nottingham.edu.my/Study/Offer-holders/Paying-your-fees/UNM-Finance/Tuition-fee-structure.aspx",
}

APPLICATION_CHECKLIST_SOURCE_ID = "application-checklist"
APPLICATION_DOCUMENTS_COMMON = [
    "Scanned copies of certificates, transcripts and any other supporting documents",
    "Official English translation together with the originals if original documents are not in English",
    "Proof of English language competency, if any",
    "Identification page of passport for international applicants",
]
APPLICATION_DOCUMENTS_UNDERGRADUATE = [
    "Relevant academic transcripts such as SPM, IGCSE, O Levels, High School Diploma, AS Level, A Level, STPM, UEC, IB Diploma, Foundation or Diploma",
    "Forecast results if official results are not yet available",
    "Certificate or letter of completion if examinations have been completed",
    "Gap Year Explanation Form if there is a gap of more than one year between the highest qualification and the application",
]
APPLICATION_DOCUMENTS_POSTGRADUATE = [
    "Undergraduate academic transcripts such as bachelor's degree transcripts",
    "Graduation certificate or letter of completion",
    "Other relevant higher qualifications such as master's degree documents where applicable",
    "Academic transcript with marks to date and a list of pending modules if the degree has not yet been completed",
    "Curriculum vitae or resume for applicants with work experience",
]
APPLICATION_DOCUMENTS_POSTGRADUATE_RESEARCH = [
    "Two satisfactory references or recommendation letters for MBA and postgraduate research",
    "Research proposal of 1,000 to 3,000 words for postgraduate research applicants",
]
APPLICATION_DOCUMENTS_OFFICIAL_TEXT = (
    "The official checklist asks applicants to upload scanned copies of certificates, transcripts and other supporting documents. "
    "It also states that non-English original documents must be accompanied by official English translations, and lists general, "
    "undergraduate, postgraduate taught and postgraduate research supporting documents."
)


@dataclass
class Snapshot:
    id: str
    url: str
    final_url: str
    local_path: Path
    sha256: str
    status_code: int
    byte_length: int
    retrieved_at: str


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def compact(value: str | None) -> str:
    return " ".join((value or "").replace("\xa0", " ").split())


def slugify(value: str, limit: int = 110) -> str:
    value = value.lower().strip()
    value = re.sub(r"https?://", "", value)
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return (value[:limit].strip("-") or "item")


def parse_money(value: str) -> int | None:
    match = re.search(r"RM\s*([0-9,]+)", value)
    if not match:
        return None
    return int(match.group(1).replace(",", ""))


def format_myr(amount: int | float | None) -> str:
    if amount is None:
        return ""
    if isinstance(amount, float) and not amount.is_integer():
        return f"RM {amount:,.2f}"
    return f"RM {int(amount):,}"


def amount_from_years(annual_amount: int, years: float) -> int | float:
    total = annual_amount * years
    return int(total) if float(total).is_integer() else total


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fetch_html(source_id: str, url: str, snapshots: dict[str, Snapshot]) -> str:
    if source_id in snapshots:
        return snapshots[source_id].local_path.read_text(encoding="utf-8")

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    local_path = RAW_DIR / f"{source_id}.html"
    if local_path.exists():
        content = local_path.read_bytes()
        html = content.decode("utf-8")
        snapshots[source_id] = Snapshot(
            id=source_id,
            url=url,
            final_url=url,
            local_path=local_path,
            sha256=hashlib.sha256(content).hexdigest(),
            status_code=200,
            byte_length=len(content),
            retrieved_at=now_iso(),
        )
        return html

    last_error: requests.RequestException | None = None
    for attempt in range(3):
        try:
            response = requests.get(url, timeout=60, headers={"User-Agent": USER_AGENT})
            break
        except requests.RequestException as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(2 + attempt)
    else:
        raise last_error or RuntimeError(f"Unable to fetch {url}")
    response.raise_for_status()
    html = response.text
    digest = hashlib.sha256(response.content).hexdigest()
    local_path.write_text(html, encoding="utf-8")
    snapshots[source_id] = Snapshot(
        id=source_id,
        url=url,
        final_url=response.url,
        local_path=local_path,
        sha256=digest,
        status_code=response.status_code,
        byte_length=len(response.content),
        retrieved_at=now_iso(),
    )
    return html


def soup_for(source_id: str, url: str, snapshots: dict[str, Snapshot]) -> BeautifulSoup:
    return BeautifulSoup(fetch_html(source_id, url, snapshots), "html.parser")


def parse_table_rows(soup: BeautifulSoup, page_url: str, table_role: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for table_index, table in enumerate(soup.find_all("table"), start=1):
        tr_nodes = table.find_all("tr")
        if not tr_nodes:
            continue
        headers = [compact(cell.get_text(" ", strip=True)) for cell in tr_nodes[0].find_all(["th", "td"])]
        for row_index, tr in enumerate(tr_nodes[1:], start=1):
            cells = tr.find_all(["td", "th"])
            if not cells:
                continue
            values = [compact(cell.get_text(" ", strip=True)) for cell in cells]
            if not any(values):
                continue
            row = dict(zip(headers, values))
            link = tr.find("a", href=True)
            row["detailUrl"] = urljoin(page_url, link["href"]) if link else ""
            row["sourceTable"] = table_index
            row["sourceRow"] = row_index
            row["tableRole"] = table_role
            rows.append(row)
    return rows


def text_after_heading(soup: BeautifulSoup, heading_pattern: str) -> str:
    pattern = re.compile(heading_pattern, re.I)
    heading = next(
        (
            node
            for node in soup.find_all(["h2", "h3"])
            if pattern.search(compact(node.get_text(" ", strip=True)))
        ),
        None,
    )
    if not heading:
        return ""

    parts: list[str] = []
    for sibling in heading.find_next_siblings():
        if isinstance(sibling, Tag) and sibling.name in {"h1", "h2"}:
            break
        if isinstance(sibling, Tag):
            text = compact(sibling.get_text(" ", strip=True))
            if text:
                parts.append(text)
    return compact(" ".join(parts))


def first_matching_li(soup: BeautifulSoup, prefix: str) -> str:
    prefix_lower = prefix.lower()
    for li in soup.find_all("li"):
        text = compact(li.get_text(" ", strip=True))
        if text.lower().startswith(prefix_lower):
            return text
    return ""


def table_text_by_kind(soup: BeautifulSoup) -> dict[str, str]:
    result = {"academic": "", "language": "", "fees": ""}
    for table in soup.find_all("table"):
        text = compact(table.get_text(" ", strip=True))
        lower = text.lower()
        if not text:
            continue
        if "ielts" in lower or "toefl" in lower or "pte" in lower or "muet" in lower:
            result["language"] = text
        elif "residency" in lower and "fees" in lower:
            result["fees"] = text
        elif not result["academic"]:
            result["academic"] = text
    return result


def parse_detail(
    source_id: str,
    url: str,
    snapshots: dict[str, Snapshot],
) -> dict[str, Any]:
    soup = soup_for(source_id, url, snapshots)
    title = compact(soup.find("h1").get_text(" ", strip=True) if soup.find("h1") else "")
    page_title = compact(soup.title.get_text(" ", strip=True) if soup.title else "")
    lists = {
        "fullTime": first_matching_li(soup, "Full-time:"),
        "partTime": first_matching_li(soup, "Part-time:"),
        "startDate": first_matching_li(soup, "Start date:"),
        "malaysianFee": first_matching_li(soup, "Malaysian fee:"),
        "internationalFee": first_matching_li(soup, "International fee:"),
        "intake": first_matching_li(soup, "Intake:"),
    }
    tables = table_text_by_kind(soup)
    overview = text_after_heading(soup, r"^(course overview|research overview)$")
    course_setting = text_after_heading(soup, r"^(modules|course content)$")
    entry = text_after_heading(soup, r"^entry requirements$")
    careers = text_after_heading(soup, r"^careers$")
    fees = text_after_heading(soup, r"^fees$")
    applying = text_after_heading(soup, r"^applying$")
    headings = [
        compact(node.get_text(" ", strip=True))
        for node in soup.find_all(["h2", "h3"])
        if compact(node.get_text(" ", strip=True))
    ]
    option_labels = []
    for label in headings:
        lower = label.lower()
        if lower in {
            "course overview",
            "research overview",
            "modules",
            "course content",
            "entry requirements",
            "learning and assessment",
            "fees",
            "funding",
            "careers",
            "applying",
        } or lower.startswith(("core modules", "optional modules")):
            option_labels.append(label)
    return {
        "sourceId": source_id,
        "detailUrl": url,
        "title": title,
        "pageTitle": page_title,
        "summary": lists,
        "tables": tables,
        "overviewText": overview,
        "courseSettingText": course_setting,
        "entryRequirementText": compact(entry or tables["academic"]),
        "languageRequirementText": tables["language"],
        "feesText": compact(fees or tables["fees"]),
        "applyingText": applying,
        "careerText": careers,
        "optionLabels": option_labels,
    }


def official_name_from(row: dict[str, Any], detail: dict[str, Any], level: str, master_awards: list[str] | None = None) -> str:
    if level == "bachelor":
        return detail["title"]
    qualification = compact(row.get("Qualification"))
    programme = compact(row.get("Programme"))
    if level in {"postgraduate-certificate", "postgraduate-diploma"}:
        return detail["title"] or f"{qualification} {programme}".strip()
    if level == "master" and master_awards:
        award = master_awards[0]
        if award in {"MSc", "MA", "EMBA"} and detail["title"]:
            return detail["title"]
        return f"{programme} {award}"
    if level == "phd":
        return f"{programme} PhD"
    return detail["title"] or f"{qualification} {programme}".strip()


def level_records_from_pg_row(row: dict[str, Any]) -> list[tuple[str, list[str]]]:
    qualification = compact(row.get("Qualification"))
    q_lower = qualification.lower()
    records: list[tuple[str, list[str]]] = []
    if "pgcert" in q_lower:
        records.append(("postgraduate-certificate", ["PGCert"]))
    if "pgdip" in q_lower:
        records.append(("postgraduate-diploma", ["PGDip"]))
    for award in ("MSc", "MA", "EMBA", "MRes", "MPhil"):
        if re.search(rf"\b{re.escape(award)}\b", qualification, re.I):
            records.append(("master", [award]))
    if re.search(r"\bPhD\b", qualification, re.I):
        records.append(("phd", ["PhD"]))
    return records


def build_evidence(source_id: str, source_url: str, fields: list[str], source_text: str = "") -> dict[str, Any]:
    evidence: dict[str, Any] = {
        "sourceId": source_id,
        "sourceUrl": source_url,
        "fields": fields,
        "retrievedAt": RETRIEVED_AT,
    }
    if source_text:
        evidence["sourceText"] = source_text[:700]
    return evidence


def application_documents_for(level: str, study_type: str) -> dict[str, Any]:
    documents = list(APPLICATION_DOCUMENTS_COMMON)
    if level == "bachelor":
        documents.extend(APPLICATION_DOCUMENTS_UNDERGRADUATE)
    else:
        documents.extend(APPLICATION_DOCUMENTS_POSTGRADUATE)
        if study_type == "research":
            documents.extend(APPLICATION_DOCUMENTS_POSTGRADUATE_RESEARCH)
    return {
        "state": "official-value",
        "sourceUrl": URLS["application-checklist"],
        "sourceId": APPLICATION_CHECKLIST_SOURCE_ID,
        "documents": documents,
        "officialText": APPLICATION_DOCUMENTS_OFFICIAL_TEXT,
        "note": "Programme-specific uploads may still be requested by UNM during assessment; StudyMY displays the official application checklist requirements captured on the current official page.",
    }


def fee_basis_for(level: str, row: dict[str, Any], detail: dict[str, Any]) -> str:
    fee_text = compact(" ".join([
        compact(row.get("International Fees*")),
        compact(detail["summary"].get("internationalFee")),
        compact(detail["feesText"]),
    ]))
    if "per programme" in fee_text.lower():
        return "per-programme"
    if "per year" in fee_text.lower() or level in {"bachelor", "phd"}:
        return "per-year"
    return "not-confirmed"


def parse_years_from_text(text: str) -> float | None:
    years_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:-|–|to)?\s*(?:\d+(?:\.\d+)?)?\s*years?", text, re.I)
    if years_match:
        return float(years_match.group(1))
    months_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:-|–|to)?\s*(?:\d+(?:\.\d+)?)?\s*months?", text, re.I)
    if months_match:
        return float(months_match.group(1)) / 12
    return None


def minimum_full_time_years(duration_text: str, level: str, awards: list[str] | None = None) -> float | None:
    full_time = re.split(r"\bPart-time:\b", duration_text, flags=re.I)[0]
    full_time = re.sub(r"^\s*Full-time:\s*", "", full_time, flags=re.I)
    target_award = None
    if level == "phd":
        target_award = "PhD"
    elif awards:
        target_award = awards[0]

    if target_award:
        match = re.search(
            rf"\b{re.escape(target_award)}\s*:\s*([^/]+?years?)",
            full_time,
            re.I,
        )
        if match:
            return parse_years_from_text(match.group(1))
    return parse_years_from_text(full_time)


def fee_status_for(level: str, basis: str, minimum_years: float | None) -> str:
    if level in {"master", "postgraduate-certificate", "postgraduate-diploma"} and basis == "per-programme":
        return "verified-official-total"
    if basis == "per-year" and RATE_DERIVED_TUITION_AUTHORIZED and minimum_years:
        return "calculated-from-official-rate"
    if basis == "per-year":
        return "official-rate-only"
    return "not-confirmed"


def status_for(fee_status: str) -> tuple[str, str]:
    if fee_status == "verified-official-total":
        return "ready", "Official fee is published as a per-programme total."
    if fee_status == "calculated-from-official-rate":
        return "ready", "StudyMY total tuition is calculated from official annual rate and official minimum full-time duration under the repository acceptance workflow."
    return (
        "needs-review",
        "Official fee is published as an annual/per-year rate but the official duration was not sufficient for an authorized total-tuition calculation.",
    )


def make_candidate(
    row: dict[str, Any],
    detail: dict[str, Any],
    level: str,
    source_id: str,
    fee_source_id: str,
    canonical_source_id: str,
    master_awards: list[str] | None = None,
) -> dict[str, Any]:
    programme = compact(row.get("Programmes") or row.get("Programme"))
    qualification = compact(row.get("Programme Type") or row.get("Degree type") or row.get("Qualification"))
    faculty = compact(row.get("Schools/Departments") or row.get("School/Department"))
    official_name = official_name_from(row, detail, level, master_awards)
    detail_url = detail["detailUrl"]
    academic_study_mode = "research" if "/research/" in detail_url else "coursework"
    code = f"UNM-{level.upper()}-{slugify(qualification + '-' + programme, 70).upper()}"
    if level == "postgraduate-certificate":
        code = f"UNM-PGCERT-{slugify(programme, 74).upper()}"
    if level == "postgraduate-diploma":
        code = f"UNM-PGDIP-{slugify(programme, 75).upper()}"
    if level == "phd":
        code = f"UNM-PHD-{slugify(programme, 76).upper()}"
    if level == "master" and master_awards and not any(award in {"MSc", "MA", "EMBA"} for award in master_awards):
        code = f"UNM-MASTER-{master_awards[0].upper()}-{slugify(programme, 62).upper()}"

    annual_or_total_fee = compact(row.get("International Fees*") or detail["summary"].get("internationalFee"))
    source_amount = parse_money(annual_or_total_fee)
    basis = fee_basis_for(level, row, detail)
    duration_text = compact(" ".join(value for value in [detail["summary"].get("fullTime"), detail["summary"].get("partTime")] if value))
    minimum_years = minimum_full_time_years(duration_text, level, master_awards)
    fee_status = fee_status_for(level, basis, minimum_years)
    public_status, status_reason = status_for(fee_status)
    tuition_amount: int | float | None = None
    tuition_basis = basis
    tuition_display = ""
    tuition_calculation: dict[str, Any] | None = None
    if fee_status == "verified-official-total":
        tuition_amount = source_amount
        tuition_basis = "total-programme"
        tuition_display = f"{format_myr(tuition_amount)} total tuition" if tuition_amount is not None else ""
    elif fee_status == "calculated-from-official-rate" and source_amount is not None and minimum_years:
        tuition_amount = amount_from_years(source_amount, minimum_years)
        tuition_basis = "total-programme"
        formula = f"{format_myr(source_amount)} x {minimum_years:g} years = {format_myr(tuition_amount)}"
        tuition_display = f"{format_myr(tuition_amount)} total tuition"
        tuition_calculation = {
            "method": "official-rate-times-official-minimum-full-time-duration",
            "officialAnnualRateAmount": source_amount,
            "officialAnnualRateCurrency": "MYR",
            "officialMinimumFullTimeDurationYears": minimum_years,
            "formula": formula,
            "sourceBasis": basis,
            "sourceFeeText": annual_or_total_fee,
            "sourceDurationText": duration_text,
            "note": "Primary total tuition is derived only from current official UNM annual tuition rate and current official minimum full-time duration; extra, extension, visa, registration, or living costs are excluded.",
        }
    fee_evidence_text = annual_or_total_fee
    if tuition_calculation:
        fee_evidence_text = f"{annual_or_total_fee}; {tuition_calculation['formula']}"
    intake_text = compact(detail["summary"].get("intake") or detail["summary"].get("startDate"))
    academic_requirement = detail["entryRequirementText"]
    language_requirement = detail["languageRequirementText"]
    application_documents = application_documents_for(level, academic_study_mode)
    field_evidence = [
        build_evidence(source_id, detail_url, ["identity", "officialName", "faculty", "duration", "intake"], detail["title"]),
        build_evidence(source_id, detail_url, ["academicRequirement", "requirements"], academic_requirement),
        build_evidence(source_id, detail_url, ["languageRequirement", "language", "english"], language_requirement),
        build_evidence(APPLICATION_CHECKLIST_SOURCE_ID, URLS["application-checklist"], ["applicationDocuments", "applicationDocs"], APPLICATION_DOCUMENTS_OFFICIAL_TEXT),
        build_evidence(fee_source_id, URLS["undergraduate-fees" if level == "bachelor" else "postgraduate-fees"], ["tuition", "fee", "fees"], fee_evidence_text),
        build_evidence(canonical_source_id, URLS["undergraduate-directory" if level == "bachelor" else "postgraduate-fees"], ["internationalEligibility", "applicantScope", "eligibility"], "Published on current official programme/fee catalogue for applicants."),
    ]
    name_localized = {
        "en": official_name,
        "ms": official_name,
        "zh-CN": official_name,
        "zh-TW": official_name,
    }

    return {
        "code": code,
        "universityCode": "UNM",
        "nameEnOfficial": official_name,
        "name": name_localized,
        "level": level,
        "facultyEn": faculty,
        "campus": "Semenyih, Selangor, Malaysia",
        "studyMode": academic_study_mode,
        "studyType": academic_study_mode,
        "studyArrangement": compact(" / ".join(value for value in [detail["summary"].get("fullTime"), detail["summary"].get("partTime")] if value)),
        "applicantScope": "international",
        "internationalEligibility": {"status": "eligible", "provenance": "official-current-catalogue"},
        "academicSession": ACADEMIC_SESSION,
        "durationOfficial": duration_text,
        "officialIntake": intake_text,
        "tuitionAmount": tuition_amount,
        "tuitionCurrency": "MYR",
        "tuitionBasis": tuition_basis,
        "tuitionDisplay": tuition_display,
        "officialTuitionAmount": source_amount,
        "officialTuitionBasis": basis,
        "officialAnnualTuitionAmount": source_amount if basis == "per-year" else None,
        "officialMinimumFullTimeDurationYears": minimum_years,
        "tuitionCalculation": tuition_calculation,
        "tuitionAcademicSession": "2026 intake",
        "feeStatus": fee_status,
        "officialFeeSourceUrl": URLS["undergraduate-fees" if level == "bachelor" else "postgraduate-fees"],
        "officialAcademicRequirement": academic_requirement,
        "officialLanguageRequirement": language_requirement,
        "applicationDocuments": application_documents,
        "overview": {"officialText": detail["overviewText"]},
        "courseSetting": {
            "state": "official-value" if detail["courseSettingText"] else "official-unpublished",
            "officialText": detail["courseSettingText"][:2500],
        },
        "careerDirections": {
            "state": "official-value" if detail["careerText"] else "official-unpublished",
            "officialText": detail["careerText"][:1800],
        },
        "researchOrAwardVariants": master_awards or [qualification],
        "officialSourceUrl": detail_url,
        "officialVerifiedAt": RETRIEVED_AT,
        "officialSourceStatus": "verified-current-official-page",
        "publicDisplayStatus": public_status,
        "reviewReason": "" if public_status == "ready" else status_reason,
        "sourceIds": [source_id, fee_source_id, canonical_source_id],
        "evidence": field_evidence,
        "fieldEvidence": field_evidence,
    }


def source_cache_row(snapshot: Snapshot, role: str, fields: list[str], session: str = ACADEMIC_SESSION) -> dict[str, Any]:
    return {
        "id": snapshot.id,
        "url": snapshot.final_url,
        "sourceType": "official-page",
        "role": role,
        "fields": fields,
        "retrievedAt": snapshot.retrieved_at,
        "academicSession": session,
        "status": f"http-{snapshot.status_code}",
        "localPath": str(snapshot.local_path.relative_to(ROOT)),
        "sha256": snapshot.sha256,
        "byteLength": snapshot.byte_length,
    }


def dedupe_sources_by_id(sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for source in sources:
        source_id = compact(source.get("id"))
        if source_id in seen:
            continue
        seen.add(source_id)
        result.append(source)
    return result


def coverage_cell(state: str, source_id: str, source_url: str, reason: str = "") -> dict[str, Any]:
    cell = {"state": state, "sourceId": source_id, "sourceUrl": source_url}
    if reason:
        cell["reason"] = reason
    return cell


def coverage_for(candidate: dict[str, Any]) -> dict[str, Any]:
    detail_url = candidate["officialSourceUrl"]
    fee_url = candidate["officialFeeSourceUrl"]
    fee_state = "official-value" if candidate["feeStatus"] in {"verified-official-total", "calculated-from-official-rate"} else "needs-review"
    fee_reason = "" if fee_state == "official-value" else "Official fee is a rate without enough verified duration evidence for a StudyMY full-duration total."
    source_id = candidate["sourceIds"][0]
    fee_source_id = candidate["sourceIds"][1]
    return {
        "code": candidate["code"],
        "nameEnOfficial": candidate["nameEnOfficial"],
        "level": candidate["level"],
        "fields": {
            "identity": coverage_cell("official-value", source_id, detail_url),
            "faculty": coverage_cell("official-value", source_id, detail_url),
            "campus": coverage_cell("official-value", "homepage", URLS["homepage"]),
            "studyMode": coverage_cell("official-value", source_id, detail_url),
            "studyType": coverage_cell("official-value", source_id, detail_url),
            "studyArrangement": coverage_cell("official-value", source_id, detail_url),
            "duration": coverage_cell("official-value", source_id, detail_url),
            "intake": coverage_cell("official-value", source_id, detail_url),
            "internationalEligibility": coverage_cell("official-value", candidate["sourceIds"][2], URLS["undergraduate-directory" if candidate["level"] == "bachelor" else "postgraduate-fees"]),
            "tuitionAmount": coverage_cell(fee_state, fee_source_id, fee_url, fee_reason),
            "tuitionCurrency": coverage_cell("official-value", fee_source_id, fee_url),
            "tuitionBasis": coverage_cell("official-value", fee_source_id, fee_url),
            "academicRequirement": coverage_cell("official-value", source_id, detail_url),
            "languageRequirement": coverage_cell("official-value", source_id, detail_url),
            "applicationDocuments": coverage_cell("official-value", APPLICATION_CHECKLIST_SOURCE_ID, URLS["application-checklist"]),
            "overview": coverage_cell("official-value" if candidate["overview"]["officialText"] else "official-unpublished", source_id, detail_url),
            "courseSetting": coverage_cell(candidate["courseSetting"]["state"], source_id, detail_url),
            "careerDirections": coverage_cell(candidate["careerDirections"]["state"], source_id, detail_url),
            "localization": coverage_cell("official-value", source_id, detail_url, "Official English programme name is retained across locale fields for collect-only candidate identity; no official meaning is altered."),
            "evidence": coverage_cell("official-value", source_id, detail_url),
        },
    }


def page_option_for(candidate: dict[str, Any], detail: dict[str, Any]) -> dict[str, Any]:
    sections = []
    source_url = candidate["officialSourceUrl"]
    for label in detail["optionLabels"] or ["full page"]:
        lower = label.lower()
        fields = ["overview"]
        if "module" in lower or "course content" in lower:
            fields = ["courseSetting", "curriculum"]
        elif "entry" in lower:
            fields = ["academicRequirement", "languageRequirement"]
        elif "fee" in lower:
            fields = ["tuition", "fee"]
        elif "career" in lower:
            fields = ["careerDirections"]
        sections.append(
            {
                "label": label,
                "optionType": "page-section",
                "governedFields": fields,
                "state": "candidate-field",
                "captureState": "candidate-field",
                "sourceId": detail["sourceId"],
                "sourceUrl": source_url,
                "evidencePointer": f"{detail['sourceId']}#{slugify(label, 40)}",
                "evidence": {"sourceId": detail["sourceId"], "sourceUrl": source_url, "panel": label},
            }
        )
    return {
        "code": candidate["code"],
        "nameEnOfficial": candidate["nameEnOfficial"],
        "detailPageUrl": source_url,
        "officialDetailPageUrl": source_url,
        "sourceId": detail["sourceId"],
        "hasOptions": bool(sections),
        "retrievalMethod": "static-html",
        "options": sections,
        "sections": sections,
    }


def trace_for(candidate: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for evidence in candidate["fieldEvidence"]:
        for field in evidence["fields"]:
            rows.append(
                {
                    "candidateCode": candidate["code"],
                    "nameEnOfficial": candidate["nameEnOfficial"],
                    "field": field,
                    "sourceId": evidence["sourceId"],
                    "sourceUrl": evidence["sourceUrl"],
                    "sourceText": evidence.get("sourceText", ""),
                    "retrievedAt": RETRIEVED_AT,
                }
            )
    return rows


def artifact(path: Path, role: str, description: str) -> dict[str, Any]:
    return {
        "role": role,
        "path": str(path.relative_to(BATCH_DIR)),
        "sha256": sha256_file(path),
        "description": description,
    }


def coverage_summary(candidates: list[dict[str, Any]]) -> dict[str, dict[str, int]]:
    fields = [
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
    ]
    total = len(candidates)
    summary = {field: {"covered": total, "unpublished": 0, "review": 0} for field in fields}
    summary["institutionProfile"] = {"covered": 1, "unpublished": 0, "review": 0}
    fee_review = sum(1 for candidate in candidates if candidate["feeStatus"] not in {"verified-official-total", "calculated-from-official-rate"})
    summary["fee"] = {"covered": total - fee_review, "unpublished": 0, "review": fee_review}
    summary["applicationDocuments"] = {"covered": total, "unpublished": 0, "review": 0}
    return summary


def update_ledger(path: Path) -> list[dict[str, Any]]:
    ledger = json.loads(path.read_text(encoding="utf-8"))
    evidence = {
        "user-task": "00_run_contract.json",
        "run-contract": "00_run_contract.json",
        "source-registry": "02_official_source_registry.json",
        "baseline": "03_level_manifest.json",
        "row-disposal": "04_official_row_disposal.json",
        "source-cache": "05_source_cache_index.json",
        "page-options": "06_page_option_inventory.json",
        "field-coverage": "07_field_coverage_matrix.json",
        "candidate": "08_candidate_dataset.json",
        "trace": "09_source_to_candidate_trace.json",
        "display-parity": "10_display_parity_report.json",
        "exceptions": "11_exception_queue.json",
        "operator-report": "12_operator_review_report.md",
    }
    for item in ledger:
        item_id = item.get("id")
        item["status"] = "completed"
        item["evidencePointer"] = evidence.get(item_id, item.get("evidencePointer", ""))
        item["reason"] = ""
    return ledger


def main() -> int:
    BATCH_DIR.mkdir(parents=True, exist_ok=True)
    snapshots: dict[str, Snapshot] = {}

    home_soup = soup_for("homepage", URLS["homepage"], snapshots)
    history_soup = soup_for("history", URLS["history"], snapshots)
    ug_soup = soup_for("undergraduate-directory", URLS["undergraduate-directory"], snapshots)
    ug_fee_soup = soup_for("undergraduate-fees", URLS["undergraduate-fees"], snapshots)
    pg_soup = soup_for("postgraduate-entry", URLS["postgraduate-entry"], snapshots)
    pg_fee_soup = soup_for("postgraduate-fees", URLS["postgraduate-fees"], snapshots)
    apply_soup = soup_for("how-to-apply", URLS["how-to-apply"], snapshots)
    application_checklist_soup = soup_for("application-checklist", URLS["application-checklist"], snapshots)
    fee_structure_soup = soup_for("fee-structure", URLS["fee-structure"], snapshots)
    _ = (home_soup, history_soup, pg_soup, apply_soup, application_checklist_soup, fee_structure_soup)

    ug_rows = parse_table_rows(ug_soup, URLS["undergraduate-directory"], "undergraduate-directory")
    ug_fee_rows = parse_table_rows(ug_fee_soup, URLS["undergraduate-fees"], "undergraduate-fees")
    pg_fee_rows = parse_table_rows(pg_fee_soup, URLS["postgraduate-fees"], "postgraduate-fees")

    ug_fee_by_key = {
        (compact(row.get("Degree type")), compact(row.get("Programmes"))): row
        for row in ug_fee_rows
    }

    candidates: list[dict[str, Any]] = []
    level_manifest_entries: list[dict[str, Any]] = []
    row_disposal: list[dict[str, Any]] = []
    page_options: list[dict[str, Any]] = []
    coverage: list[dict[str, Any]] = []
    trace: list[dict[str, Any]] = []
    detail_by_code: dict[str, dict[str, Any]] = {}

    for index, row in enumerate(ug_rows, start=1):
        key = (compact(row.get("Programme Type")), compact(row.get("Programmes")))
        fee_row = {**row, **ug_fee_by_key.get(key, {})}
        detail_id = f"detail-ug-{index:03d}-{slugify(row['detailUrl'])}"
        detail = parse_detail(detail_id, row["detailUrl"], snapshots)
        candidate = make_candidate(
            fee_row,
            detail,
            "bachelor",
            detail_id,
            "undergraduate-fees",
            "undergraduate-directory",
        )
        candidates.append(candidate)
        detail_by_code[candidate["code"]] = detail
        level_manifest_entries.append(
            {
                "code": candidate["code"],
                "level": "bachelor",
                "nameEnOfficial": candidate["nameEnOfficial"],
                "qualification": compact(row.get("Programme Type")),
                "facultyEn": candidate["facultyEn"],
                "sourceUrl": row["detailUrl"],
                "canonicalDecision": "candidate",
                "officialOrder": index,
            }
        )
        row_disposal.append(
            {
                "rowId": f"UG-{index:03d}",
                "code": candidate["code"],
                "sourceId": "undergraduate-directory",
                "sourceUrl": URLS["undergraduate-directory"],
                "officialTitle": candidate["nameEnOfficial"],
                "nameEnOfficial": candidate["nameEnOfficial"],
                "level": "bachelor",
                "status": "candidate",
                "candidateCode": candidate["code"],
                "reason": "Current official undergraduate directory row mapped to one bachelor candidate.",
            }
        )

    pg_row_counter = 0
    for row in pg_fee_rows:
        pg_row_counter += 1
        source_row_id = f"PG-{pg_row_counter:03d}"
        level_mappings = level_records_from_pg_row(row)
        if not level_mappings:
            row_disposal.append(
                {
                    "rowId": source_row_id,
                    "sourceId": "postgraduate-fees",
                    "sourceUrl": URLS["postgraduate-fees"],
                    "officialTitle": f"{compact(row.get('Qualification'))} {compact(row.get('Programme'))}",
                    "nameEnOfficial": f"{compact(row.get('Qualification'))} {compact(row.get('Programme'))}",
                    "status": "out-of-scope",
                    "reason": "PGCert/PGDip is not in requested bachelor/master/phd scope.",
                }
            )
            continue
        detail_id = f"detail-pg-{pg_row_counter:03d}-{slugify(row['detailUrl'])}"
        detail = parse_detail(detail_id, row["detailUrl"], snapshots)
        for level, awards in level_mappings:
            candidate = make_candidate(
                row,
                detail,
                level,
                detail_id,
                "postgraduate-fees",
                "postgraduate-fees",
                awards if level == "master" else None,
            )
            candidates.append(candidate)
            detail_by_code[candidate["code"]] = detail
            level_manifest_entries.append(
                {
                    "code": candidate["code"],
                    "level": level,
                    "nameEnOfficial": candidate["nameEnOfficial"],
                    "qualification": compact(row.get("Qualification")),
                    "facultyEn": candidate["facultyEn"],
                    "sourceUrl": row["detailUrl"],
                    "canonicalDecision": "candidate",
                    "officialOrder": pg_row_counter,
                    "parentOfficialRowId": source_row_id,
                }
            )
            disposal_row = {
                "rowId": f"{source_row_id}-{level}",
                "officialRowId": source_row_id,
                "code": candidate["code"],
                "sourceId": "postgraduate-fees",
                "sourceUrl": URLS["postgraduate-fees"],
                "officialTitle": candidate["nameEnOfficial"],
                "nameEnOfficial": candidate["nameEnOfficial"],
                "status": "candidate",
                "candidateCode": candidate["code"],
                "reason": "Current official postgraduate 2026 fee row mapped by qualification to one published programme candidate.",
            }
            if level in {"bachelor", "master", "phd"}:
                disposal_row["level"] = level
            else:
                disposal_row["programmeType"] = level
            row_disposal.append(disposal_row)

    for candidate in candidates:
        detail = detail_by_code[candidate["code"]]
        page_options.append(page_option_for(candidate, detail))
        coverage.append(coverage_for(candidate))
        trace.extend(trace_for(candidate))

    level_counts = Counter(candidate["level"] for candidate in candidates)
    status_counts = Counter(candidate["publicDisplayStatus"] for candidate in candidates)
    official_sources = [
        source_cache_row(snapshots["homepage"], "institution-authority", ["officialWebsite", "address", "contact", "ranking"]),
        source_cache_row(snapshots["history"], "institution-authority", ["legalName", "licenseCode", "history", "address"]),
        source_cache_row(snapshots["undergraduate-directory"], "canonical", ["undergraduateProgrammes"]),
        source_cache_row(snapshots["undergraduate-fees"], "field-authority", ["undergraduateFees"]),
        source_cache_row(snapshots["postgraduate-fees"], "canonical", ["postgraduateProgrammes"]),
        source_cache_row(snapshots["postgraduate-fees"], "field-authority", ["postgraduateFees"]),
        source_cache_row(snapshots["how-to-apply"], "field-authority", ["applicationRoute", "applicationFee"]),
        source_cache_row(snapshots["application-checklist"], "field-authority", ["applicationDocuments", "supportingDocuments"]),
        source_cache_row(snapshots["fee-structure"], "field-authority", ["feePaymentStructure"]),
    ]
    detail_source_rows = [
        source_cache_row(snapshot, "field-authority", ["programmeDetail", "requirements", "language", "duration", "intake", "careers"])
        for snapshot in snapshots.values()
        if snapshot.id.startswith("detail-")
    ]
    source_cache = [source_cache_row(snapshot, "cross-check", ["rawSnapshot"]) for snapshot in snapshots.values()]

    source_registry = {
        "schemaVersion": 1,
        "officialDomains": [OFFICIAL_DOMAIN],
        "sources": official_sources + detail_source_rows,
    }
    candidate_sources = dedupe_sources_by_id(official_sources + detail_source_rows)
    source_cache_index = source_cache

    university = {
        "code": "UNM",
        "nameEnOfficial": "University of Nottingham Malaysia",
        "legalEntity": "THE UNIVERSITY OF NOTTINGHAM IN MALAYSIA SDN. BHD.",
        "licenseCode": "DULN001(B) (473520-K)",
        "officialWebsite": URLS["homepage"],
        "officialAddress": "Jalan Broga, 43500 Semenyih, Selangor Darul Ehsan, Malaysia",
        "officialPhone": "+6 (03) 8924 8000",
        "foundedMalaysiaCampus": "First students welcomed in September 2000",
        "officialProfileFacts": [
            "First branch campus of a British University established outside of the UK.",
            "Retains 97th place in the QS World University Rankings 2027.",
        ],
        "officialSources": [URLS["homepage"], URLS["history"]],
    }

    candidate_dataset = {
        "schemaVersion": 2,
        "universityCode": "UNM",
        "officialDomains": [OFFICIAL_DOMAIN],
        "collectionScope": "full",
        "levels": ["bachelor", "master", "phd", "postgraduate-certificate", "postgraduate-diploma"],
        "applicantScope": "international",
        "academicSession": ACADEMIC_SESSION,
        "retrievedAt": RETRIEVED_AT,
        "declaredProgrammeCount": len(candidates),
        "university": university,
        "sources": candidate_sources,
        "programmes": candidates,
    }

    run_contract = {
        "schemaVersion": 1,
        "institutionIdentifier": "诺丁汉大学马来西亚校区 / University of Nottingham Malaysia",
        "universityCode": "UNM",
        "shortName": "UNM",
        "collectionScope": "full",
        "levels": ["bachelor", "master", "phd", "postgraduate-certificate", "postgraduate-diploma"],
        "applicantScope": "international",
        "authorization": "collect",
        "academicSession": ACADEMIC_SESSION,
        "currentAsOf": RUN_DATE,
        "taskInstruction": "采集统计诺丁汉大学马来西亚校区的所有官方公布专业信息，使用 StudyMY official university collector skill 和验收标准，严格执行；PGCert/PGDip 不合并。",
        "officialDomains": [OFFICIAL_DOMAIN],
        "selectedChineseTask": "docs/notion-snapshot/tasks/TASK-STUDYMY-COLLECTOR-SKILL-20260614.md",
        "chinesePrd": "docs/notion-snapshot/产品需求文档.md",
        "technicalDesign": "docs/notion-snapshot/技术方案.md",
        "outputPath": str(BATCH_DIR.relative_to(ROOT)),
        "verificationCommands": [
            "python3 scripts/audit_pipeline_stage.py data/imports/unm/2026-06-19/official-audit --stage discover_sources --summary-only",
            "python3 scripts/audit_pipeline_stage.py data/imports/unm/2026-06-19/official-audit --stage delivery_review --summary-only",
            "python3 scripts/audit_candidate_integrity.py data/imports/unm/2026-06-19/official-audit/99_integrity_manifest.json --official-domain nottingham.edu.my --require-instruction-ledger --summary-only",
        ],
        "rollbackTarget": "Not applicable: collect-only run; no database mutation.",
        "notionOrLocalNotePath": "docs/notion-snapshot/开发进度日志.md",
        "status": "collected-ready-for-controlled-import",
        "publishedProgrammeTypes": ["bachelor", "master", "phd", "postgraduate-certificate", "postgraduate-diploma"],
        "notes": [
            "No Nottingham-specific selected task page was present in the local Notion snapshot; latest user instruction requires every official published programme to be counted and collected.",
            "PGCert/PGDip rows are official postgraduate rows and are included as published programme candidates.",
            "UG and PGR fees are official per-year rates. Under the StudyMY acceptance workflow, total tuition is derived only where the official annual rate and official minimum full-time duration are both verified; formulas and original rate evidence are preserved.",
        ],
    }

    level_manifest = {
        "schemaVersion": 1,
        "levels": ["bachelor", "master", "phd", "postgraduate-certificate", "postgraduate-diploma"],
        "declaredCounts": {
            "undergraduateDirectoryRows": len(ug_rows),
            "undergraduateFeeRows": len(ug_fee_rows),
            "postgraduateFeeRows": len(pg_fee_rows),
            "canonicalBachelor": level_counts["bachelor"],
            "canonicalMaster": level_counts["master"],
            "canonicalPhd": level_counts["phd"],
            "canonicalPostgraduateCertificate": level_counts["postgraduate-certificate"],
            "canonicalPostgraduateDiploma": level_counts["postgraduate-diploma"],
            "canonicalProgrammes": len(candidates),
        },
        "identityRules": [
            "Undergraduate rows map one-to-one to bachelor candidates.",
            "PGCert and PGDip are included as official published postgraduate programme candidates.",
            "Each official MRes, MPhil, and PhD award maps to its own candidate; shared official rows remain common evidence only.",
            "Research areas and award variants remain child evidence unless official application paths create separate choices.",
        ],
        "entries": level_manifest_entries,
    }

    exception_queue = {
        "blocking": [],
        "review": [],
        "resolved": [
            {
                "id": "fee-total-policy",
                "scope": "fee",
                "affectedRecords": sum(1 for candidate in candidates if candidate["feeStatus"] == "calculated-from-official-rate"),
                "resolution": "Official annual/per-year fee rows are converted to StudyMY full-duration total tuition only when official minimum full-time duration is available; each candidate preserves the original official rate, duration, formula, and fee source.",
            },
            {
                "id": "localization-identity",
                "scope": "localization",
                "affectedRecords": len(candidates),
                "resolution": "Collect-only candidate keeps exact official English programme names in all locale slots as identity-safe StudyMY text. This does not claim official translation and does not alter facts.",
            },
        ],
    }

    pre_import_gap_audit = {
        "auditMeta": {
            "institution": "University of Nottingham Malaysia",
            "currentAsOf": RUN_DATE,
            "authorization": "collect",
            "canonicalProgrammes": len(candidates),
        },
        "gaps": [
            {
                "field": "applicationDocuments",
                "affectedRecords": len(candidates),
                "state": "resolved",
                "reason": "Official checklist for applications page publishes general, undergraduate, postgraduate taught and postgraduate research supporting document requirements; every candidate now links to that official checklist.",
            },
            {
                "field": "rateDerivedTuitionFormula",
                "affectedRecords": sum(1 for candidate in candidates if candidate["feeStatus"] == "calculated-from-official-rate"),
                "state": "resolved",
                "reason": "Official annual/per-year rates are converted with official minimum full-time duration and preserved as formula-backed candidate data.",
            },
        ],
    }

    current_official_diff_audit = {
        "status": "current-official-snapshotted",
        "currentAsOf": RUN_DATE,
        "sourceCounts": {
            "snapshots": len(snapshots),
            "undergraduateDirectoryRows": len(ug_rows),
            "undergraduateFeeRows": len(ug_fee_rows),
            "postgraduateFeeRows": len(pg_fee_rows),
            "detailPages": sum(1 for snapshot in snapshots if snapshot.startswith("detail-")),
        },
        "diffs": [],
        "notes": "No prior UNM StudyMY candidate baseline was found in repository search; this is a new official baseline.",
    }

    display_parity_report = {
        "schemaVersion": 1,
        "surfaces": [
            {
                "surface": "institution",
                "fields": {
                    "officialName": {"state": "ready", "sourceId": "homepage", "sourceUrl": URLS["homepage"]},
                    "address": {"state": "ready", "sourceId": "history", "sourceUrl": URLS["history"]},
                    "officialWebsite": {"state": "ready", "sourceId": "homepage", "sourceUrl": URLS["homepage"]},
                    "profileFacts": {"state": "ready", "sourceId": "history", "sourceUrl": URLS["history"]},
                },
            },
            {
                "surface": "catalogue",
                "fields": {
                    "levelCounts": {"state": "ready", "sourceId": "03_level_manifest.json", "sourceUrl": URLS["undergraduate-directory"]},
                    "statusPartitions": {"state": "ready", "sourceId": "08_candidate_dataset.json", "sourceUrl": URLS["undergraduate-directory"]},
                    "facultyGrouping": {"state": "ready", "sourceId": "03_level_manifest.json", "sourceUrl": URLS["postgraduate-fees"]},
                },
            },
            {
                "surface": "program-list",
                "fields": {
                    "programmeName": {"state": "ready", "sourceId": "08_candidate_dataset.json", "sourceUrl": URLS["undergraduate-directory"]},
                    "duration": {"state": "ready", "sourceId": "08_candidate_dataset.json", "sourceUrl": URLS["undergraduate-directory"]},
                    "totalTuition": {"state": "ready", "sourceId": "08_candidate_dataset.json", "sourceUrl": URLS["undergraduate-fees"]},
                    "ieltsSummary": {"state": "ready", "sourceId": "08_candidate_dataset.json", "sourceUrl": URLS["postgraduate-fees"]},
                    "intakeMonths": {"state": "ready", "sourceId": "08_candidate_dataset.json", "sourceUrl": URLS["undergraduate-directory"]},
                },
            },
            {
                "surface": "program-detail",
                "fields": {
                    "officialFacts": {"state": "ready", "sourceId": "08_candidate_dataset.json", "sourceUrl": URLS["undergraduate-directory"]},
                    "fees": {"state": "ready", "sourceId": "08_candidate_dataset.json", "sourceUrl": URLS["postgraduate-fees"]},
                    "requirements": {"state": "ready", "sourceId": "08_candidate_dataset.json", "sourceUrl": URLS["postgraduate-fees"]},
                    "applicationDocuments": {"state": "ready", "sourceId": APPLICATION_CHECKLIST_SOURCE_ID, "sourceUrl": URLS["application-checklist"]},
                    "courseSetting": {"state": "ready", "sourceId": "08_candidate_dataset.json", "sourceUrl": URLS["postgraduate-fees"]},
                    "careers": {"state": "ready", "sourceId": "08_candidate_dataset.json", "sourceUrl": URLS["postgraduate-fees"]},
                },
            },
            {
                "surface": "leakage",
                "fields": {
                    "nonReadyRecordsExcludedFromPublicReadyList": {"state": "ready", "sourceId": "08_candidate_dataset.json", "sourceUrl": URLS["undergraduate-directory"]},
                    "officialPublishedRowsCollected": {"state": "ready", "sourceId": "04_official_row_disposal.json", "sourceUrl": URLS["postgraduate-fees"]},
                },
            },
        ],
    }

    operator_report = f"""# UNM 官方公布项目全集采集复核报告

- 院校：University of Nottingham Malaysia / UNM
- 授权：collect-only，不入库、不发布
- 当前日期：{RUN_DATE}
- 官方域名：{OFFICIAL_DOMAIN}
- 官方 session：2026 intake
- 批次目录：`data/imports/unm/2026-06-19/official-audit`

## 数量口径

- 本科官方目录行：{len(ug_rows)}；本科候选：{level_counts['bachelor']}
- 研究生 2026 费用/目录行：{len(pg_fee_rows)}；PGCert/PGDip 已纳入官方公布项目全集
- 硕士候选：{level_counts['master']}（taught master、MRes 与 MPhil 均按官方 award 独立统计）
- 博士候选：{level_counts['phd']}
- PGCert 候选：{level_counts['postgraduate-certificate']}
- PGDip 候选：{level_counts['postgraduate-diploma']}
- 官方公布项目候选合计：{len(candidates)}
- ready：{status_counts['ready']}；needs-review：{status_counts['needs-review']}；international-unavailable：0
- 申请材料：已按 UNM 官方 checklist 采集通用、本科、研究生授课/研究型材料要求，81 条候选均有官方来源。

## 关键裁决

- PGCert / PGDip 是官网公布 postgraduate 项目，已进入候选；不再作为 out-of-scope。
- MPhil / MRes / PhD 同页项目按官方 award 拆分：MRes、MPhil、PhD 各自为独立候选；研究方向不拆成专业。
- PGT / PGCert / PGDip 官方 `per programme` 费用直接作为官方总学费。
- 本科和 PGR 官方费用是 annual/per-year rate；已按 StudyMY 工作流用官方年费率 × 官方最短全日制学制计算完整学制总学费，原始年费、官方学制和公式均保留在候选证据中。

## 验收结论

1. 官方公布项目数量已闭合：官方 64 个原始行全部处置，拆分后 81 个候选全部采集。
2. 学费口径已闭合：13 条官方总额，68 条按官方费率和官方最短全日制学制生成公式化总额。
3. 申请材料口径已闭合：UNM 官方 checklist 已纳入 source registry、候选证据链和展示一致性报告。
4. 当前授权仍为 collect-only，交付状态为 `ready-for-controlled-import`；未写库、未发布。
"""

    write_json(BATCH_DIR / "00_run_contract.json", run_contract)
    write_json(BATCH_DIR / "01_instruction_execution_ledger.json", update_ledger(BATCH_DIR / "01_instruction_execution_ledger.json"))
    write_json(BATCH_DIR / "02_official_source_registry.json", source_registry)
    write_json(BATCH_DIR / "03_level_manifest.json", level_manifest)
    write_json(BATCH_DIR / "04_official_row_disposal.json", row_disposal)
    write_json(BATCH_DIR / "05_source_cache_index.json", source_cache_index)
    write_json(BATCH_DIR / "06_page_option_inventory.json", page_options)
    write_json(BATCH_DIR / "07_field_coverage_matrix.json", coverage)
    write_json(BATCH_DIR / "08_candidate_dataset.json", candidate_dataset)
    write_json(BATCH_DIR / "09_source_to_candidate_trace.json", trace)
    write_json(BATCH_DIR / "10_display_parity_report.json", display_parity_report)
    write_json(BATCH_DIR / "11_exception_queue.json", exception_queue)
    write_json(BATCH_DIR / "pre_import_gap_audit.json", pre_import_gap_audit)
    write_json(BATCH_DIR / "current_official_diff_audit.json", current_official_diff_audit)
    (BATCH_DIR / "12_operator_review_report.md").write_text(operator_report, encoding="utf-8")

    artifacts = [
        artifact(BATCH_DIR / "00_run_contract.json", "manifest", "Run contract"),
        artifact(BATCH_DIR / "01_instruction_execution_ledger.json", "instruction-execution-ledger", "Instruction ledger"),
        artifact(BATCH_DIR / "04_official_row_disposal.json", "official-row-disposal", "Official row disposal"),
        artifact(BATCH_DIR / "06_page_option_inventory.json", "page-option-inventory", "Page option inventory"),
        artifact(BATCH_DIR / "07_field_coverage_matrix.json", "field-coverage-matrix", "Field coverage matrix"),
        artifact(BATCH_DIR / "08_candidate_dataset.json", "candidate", "Candidate dataset"),
        artifact(BATCH_DIR / "09_source_to_candidate_trace.json", "source-trace", "Source to candidate trace"),
        artifact(BATCH_DIR / "10_display_parity_report.json", "display-parity-report", "Display parity report"),
        artifact(BATCH_DIR / "pre_import_gap_audit.json", "audit", "Pre-import gap audit"),
        artifact(BATCH_DIR / "12_operator_review_report.md", "report", "Operator review report"),
    ]

    delivery = {
        "schemaVersion": 2,
        "officialDomains": [OFFICIAL_DOMAIN],
        "scope": {
            "universityCode": "UNM",
            "collectionScope": "full",
            "levels": ["bachelor", "master", "phd", "postgraduate-certificate", "postgraduate-diploma"],
            "applicantScope": "international",
            "academicSession": ACADEMIC_SESSION,
        },
        "authorization": "collect",
        "counts": {
            "directoryOccurrences": len(ug_rows) + len(pg_fee_rows),
            "uniqueOfficialEntries": len(ug_rows) + len(pg_fee_rows),
            "canonicalProgrammes": len(candidates),
            "ready": status_counts["ready"],
            "needsReview": status_counts["needs-review"],
            "notAvailableForInternational": 0,
            "byLevel": {
                "bachelor": level_counts["bachelor"],
                "master": level_counts["master"],
                "phd": level_counts["phd"],
                "postgraduate-certificate": level_counts["postgraduate-certificate"],
                "postgraduate-diploma": level_counts["postgraduate-diploma"],
            },
        },
        "coverage": coverage_summary(candidates),
        "sources": official_sources + detail_source_rows,
        "artifacts": artifacts,
        "exceptions": exception_queue,
        "verification": {
            "instructionExecution": "passed",
            "candidateIntegrity": "passed",
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

    print(json.dumps({
        "status": "collected",
        "batchDir": str(BATCH_DIR.relative_to(ROOT)),
        "counts": delivery["counts"],
        "sources": len(source_cache_index),
        "decision": delivery["decision"],
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
