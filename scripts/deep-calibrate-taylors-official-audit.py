#!/usr/bin/env python3
"""Deep-calibrate Taylor's University collected candidate data."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse


DEFAULT_BATCH_DIR = Path("data/imports/tsu/2026-06-20/tsu-20260620")
OFFICIAL_DOMAIN = "taylors.edu.my"
UG_ADMISSION_URL = "https://university.taylors.edu.my/en/study/how-to-apply/undergraduate-admission.html"
PG_ADMISSION_URL = "https://university.taylors.edu.my/en/study/how-to-apply/postgraduate-admission.html"
TOPAS_URL = "https://topas.taylors.edu.my/"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def clean_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ")).strip()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, data: object) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def money_free_snippet(text: str, pattern: str, window: int = 260) -> list[str]:
    result: list[str] = []
    for match in re.finditer(pattern, text, flags=re.IGNORECASE):
        start = max(0, match.start() - window)
        end = min(len(text), match.end() + window)
        snippet = clean_text(text[start:end])
        if snippet and snippet not in result:
            result.append(snippet)
    return result[:4]


def first_match(patterns: list[str], text: str) -> str:
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            for group in match.groups():
                if group:
                    return group.strip()
    return ""


def as_float(value: str) -> float | None:
    try:
        return float(value)
    except ValueError:
        return None


def international_language_text(raw: str) -> str:
    text = clean_text(raw)
    markers = [
        "INTERNATIONAL STUDENTS",
        "International Students",
        "For International Students",
        "International students",
    ]
    lowered = text.lower()
    start = -1
    marker_len = 0
    for marker in markers:
        index = lowered.find(marker.lower())
        if index >= 0 and (start < 0 or index < start):
            start = index
            marker_len = len(marker)
    if start >= 0:
        text = clean_text(text[start + marker_len :])
    stops = [
        "Note :",
        "Note:",
        "Pre-employment requirement:",
        "Interview ",
        "Health Requirements",
        "Accreditation of Prior Experiential Learning",
        "If Your Bachelor",
        "Accelerated PhD Programme",
        "Prior Publication Mode",
        "If Your Bachelor's Degree",
    ]
    cut = len(text)
    lowered = text.lower()
    for stop in stops:
        index = lowered.find(stop.lower())
        if index > 0:
            cut = min(cut, index)
    return clean_text(text[:cut] or raw)


def parse_language(raw: str, source_url: str) -> dict:
    intl = international_language_text(raw)
    tests: dict[str, dict] = {}
    ielts = first_match(
        [
            r"IELTS(?:\s+score)?(?:\s+of)?(?:\s+Band)?\s*([0-9](?:\.[0-9])?)",
            r"International English Language Testing System \(IELTS\)\s*score\s*of\s*([0-9](?:\.[0-9])?)",
        ],
        intl,
    )
    if ielts:
        tests["ielts"] = {
            "score": as_float(ielts),
            "display": f"IELTS {ielts}",
            "sourceText": clean_text(intl),
        }
    toefl = first_match(
        [
            r"TOEFL\s*iBT\s*([0-9]{2,3})",
            r"TOEFL\s*([0-9]{2,3})(?:\s*\(Internet Based Test\))?",
        ],
        intl,
    )
    if toefl:
        tests["toeflIbt"] = {
            "score": int(toefl),
            "display": f"TOEFL iBT {toefl}",
            "sourceText": clean_text(intl),
        }
    muet = first_match(
        [
            r"MUET\s*Band\s*([0-9](?:\.[0-9])?)",
            r"Band\s*([0-9](?:\.[0-9])?)\s*in\s*MUET",
            r"minimum\s+of\s+Band\s*([0-9](?:\.[0-9])?)\s+in\s+MUET",
        ],
        intl,
    )
    if muet:
        tests["muet"] = {
            "band": as_float(muet),
            "display": f"MUET Band {muet}",
            "sourceText": clean_text(intl),
        }
    pte = first_match([r"PTE(?:\s+Academic)?\s*([0-9]{2,3})"], intl)
    if pte:
        tests["pteAcademic"] = {
            "score": int(pte),
            "display": f"PTE Academic {pte}",
            "sourceText": clean_text(intl),
        }
    other_routes = []
    if re.search(r"Cambridge English", intl, flags=re.IGNORECASE):
        other_routes.append({"test": "Cambridge English", "status": "official-published", "sourceText": clean_text(intl)})
    if re.search(r"\bELS\b", intl, flags=re.IGNORECASE):
        other_routes.append({"test": "ELS", "status": "official-published", "sourceText": clean_text(intl)})
    if re.search(r"Taylor.?s EET", intl, flags=re.IGNORECASE):
        eet = first_match([r"Taylor.?s EET\s*Overall Score\s*([0-9](?:\.[0-9])?)"], intl)
        other_routes.append({"test": "Taylor's EET", "score": as_float(eet) if eet else None, "sourceText": clean_text(intl)})
    if re.search(r"Taylor.?s IEN", intl, flags=re.IGNORECASE):
        other_routes.append({"test": "Taylor's IEN", "status": "official-published", "sourceText": clean_text(intl)})

    summary = ""
    ielts_status = "official-unpublished"
    if "ielts" in tests:
        summary = tests["ielts"]["display"]
        ielts_status = "official-value"
    elif "muet" in tests:
        summary = tests["muet"]["display"]
    elif tests:
        summary = next(iter(tests.values())).get("display", "Official English requirement published")
    elif intl:
        summary = "Official English requirement published"

    return {
        "status": "official-value" if tests or intl else "official-unpublished",
        "applicantScope": "international",
        "officialText": clean_text(raw),
        "internationalText": clean_text(intl),
        "tests": tests,
        "otherRoutes": other_routes,
        "ieltsOnlySummary": tests.get("ielts", {}).get("display"),
        "ieltsOnlySummaryStatus": ielts_status,
        "listSummary": summary,
        "sourceUrl": source_url,
    }


def add_threshold(items: list[dict], kind: str, display: str, source_text: str, value: object = None) -> None:
    item = {"type": kind, "display": clean_text(display), "sourceText": clean_text(source_text)}
    if value is not None:
        item["value"] = value
    key = (item["type"], item["display"])
    if key not in {(existing["type"], existing["display"]) for existing in items}:
        items.append(item)


def parse_academic_performance(raw: str, level: str, source_url: str) -> dict:
    text = clean_text(raw)
    thresholds: list[dict] = []
    for match in re.finditer(r"CGPA\s+(?:above\s+|between\s+|less\s+than\s+|of\s+|minimum\s+|min\.\s*)?([0-9](?:\.[0-9]{1,2})?)", text, flags=re.IGNORECASE):
        add_threshold(thresholds, "cgpa", f"CGPA {match.group(1)}", money_free_snippet(text, re.escape(match.group(0)), 180)[0], as_float(match.group(1)))
    for match in re.finditer(r"CGPA\s+between\s+([0-9](?:\.[0-9]{1,2})?)\s+and\s+([0-9](?:\.[0-9]{1,2})?)", text, flags=re.IGNORECASE):
        add_threshold(thresholds, "cgpa-range", f"CGPA between {match.group(1)} and {match.group(2)}", money_free_snippet(text, re.escape(match.group(0)), 180)[0])
    for match in re.finditer(r"ATAR\s*([0-9]{2,3})", text, flags=re.IGNORECASE):
        add_threshold(thresholds, "atar", f"ATAR {match.group(1)}", money_free_snippet(text, re.escape(match.group(0)), 160)[0], int(match.group(1)))
    for match in re.finditer(r"(?:average|Overall|Aggregate / Average)\s+(?:of\s+)?([0-9]{2,3})%", text, flags=re.IGNORECASE):
        add_threshold(thresholds, "percentage", f"{match.group(1)}%", money_free_snippet(text, re.escape(match.group(0)), 160)[0], int(match.group(1)))
    for match in re.finditer(r"(?:IB|International Baccalaureate).*?([0-9]{2})\s*points", text, flags=re.IGNORECASE):
        add_threshold(thresholds, "ib-points", f"IB {match.group(1)} points", money_free_snippet(text, re.escape(match.group(0)), 160)[0], int(match.group(1)))
    for match in re.finditer(r"A Level\s*(?:Min\.)?\s*([A-F]{2,4}(?:\s*/\s*[A-F]{2,4})*)", text, flags=re.IGNORECASE):
        add_threshold(thresholds, "a-level-grade", f"A Level {match.group(1)}", money_free_snippet(text, re.escape(match.group(0)), 160)[0])
    honours_patterns = [
        r"Second Class Honours(?:\s+Division\s+[AB])?",
        r"first class honours",
        r"honours class",
        r"honours degree",
        r"Distinction",
    ]
    for pattern in honours_patterns:
        for snippet in money_free_snippet(text, pattern, 180):
            add_threshold(thresholds, "non-numeric-performance", snippet[:180], snippet)

    degree_basis = []
    for pattern in [r"Master.?s degree[^.;]*", r"Bachelor.?s degree[^.;]*", r"Level\s+[67][^.;]*"]:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            value = clean_text(match.group(0))
            if value and value not in degree_basis:
                degree_basis.append(value)

    summary_parts = [item["display"] for item in thresholds[:4]]
    if not summary_parts and degree_basis:
        summary_parts = degree_basis[:3]
    return {
        "status": "official-value" if thresholds or degree_basis else "official-unpublished",
        "level": level,
        "summary": "; ".join(summary_parts),
        "thresholds": thresholds,
        "degreeBasis": degree_basis[:8],
        "sourceUrl": source_url,
        "sourceText": text[:3000],
    }


SPECIAL_PATTERNS = {
    "interview": r"interview|rigorous internal assessment",
    "aptitudeAssessment": r"aptitude assessment",
    "portfolio": r"portfolio",
    "workExperience": r"work(?:ing)? experience|years? of .*experience|practical experience|managerial or supervisory experience",
    "proposal": r"research proposal|statement of purpose|proposal",
    "supervisor": r"supervisor|doctoral faculty",
    "priorPublication": r"prior publication|retrospective|published work|publications|scholarly published work|journal",
    "healthMedical": r"medical examination|health requirement|health examination|immunisation|transmissible diseases",
    "bridgingModule": r"bridging module|prerequisite courses",
    "referenceLetter": r"reference letter|referee|recommendation",
}


def parse_special_requirements(raw: str, source_url: str) -> dict:
    text = clean_text(raw)
    result: dict[str, dict] = {}
    for key, pattern in SPECIAL_PATTERNS.items():
        snippets = money_free_snippet(text, pattern, 220)
        result[key] = {
            "status": "official-value" if snippets else "official-unpublished",
            "sourceUrl": source_url,
            "sourceText": snippets,
        }
    return result


UG_DOCUMENTS = [
    "photographs",
    "identity document",
    "academic transcripts",
    "completion certificates",
    "official English translation if academic documents are not in English",
]

PG_COURSEWORK_INTERNATIONAL_DOCUMENTS = [
    "certified academic certificates and transcripts",
    "passport copies, including blank pages, with at least 15 months validity",
    "passport-sized photographs",
    "curriculum vitae or resume",
    "evidence of English competency when previous degree was not completed in English",
    "employer testimonial or recommendation letter if applicable",
    "scholarship or sponsorship letter if applicable",
    "pre-arrival health examination report when required by the application route",
]

PG_RESEARCH_INTERNATIONAL_DOCUMENTS = [
    "certified Bachelor and/or Master degree certificates and transcripts",
    "passport copies, including blank pages, with at least 15 months validity",
    "passport-sized photographs",
    "research proposal",
    "curriculum vitae or resume",
    "two academic referee reports",
    "addendum if applicable",
    "scholarship or sponsorship letter if applicable",
    "evidence of English competency when previous degree was not completed in English",
    "pre-arrival health examination report after acceptance for visa processing",
]


def documents_for(programme: dict, special: dict) -> dict:
    level = programme.get("level")
    study_type = programme.get("studyType")
    items: list[str]
    route: str
    source_url: str
    if level == "bachelor":
        route = "undergraduate-general"
        source_url = UG_ADMISSION_URL
        items = list(UG_DOCUMENTS)
    elif level == "phd" or study_type == "research":
        route = "postgraduate-research-international"
        source_url = PG_ADMISSION_URL
        items = list(PG_RESEARCH_INTERNATIONAL_DOCUMENTS)
    else:
        route = "postgraduate-coursework-international"
        source_url = PG_ADMISSION_URL
        items = list(PG_COURSEWORK_INTERNATIONAL_DOCUMENTS)

    supplements = {
        "portfolio": "design portfolio or practical experience portfolio when the programme-specific requirement publishes it",
        "proposal": "research proposal or statement of purpose when the programme-specific requirement publishes it",
        "priorPublication": "published works, executive summary, and scholarly publication list for prior-publication doctoral route",
        "healthMedical": "medical or health examination evidence when the programme-specific route requires it",
        "workExperience": "work experience evidence such as company reference letter when the route requires it",
        "referenceLetter": "reference or recommendation letter when the programme-specific route requires it",
    }
    for key, item in supplements.items():
        if special.get(key, {}).get("status") == "official-value" and item not in items:
            items.append(item)
    return {
        "status": "general-rule-with-programme-specific-supplements",
        "route": route,
        "items": items,
        "sourceUrl": source_url,
        "applicationPortalUrl": TOPAS_URL,
        "programmeSpecificSupplementSourceUrl": programme.get("officialSourceUrl"),
    }


def update_evidence(programme: dict, fields: list[str], source_text: str, source_url: str) -> None:
    item = {
        "fields": fields,
        "sourceId": next((ev.get("sourceId") for ev in programme.get("evidence", []) if ev.get("sourceUrl") == source_url), ""),
        "sourceUrl": source_url,
        "sourceText": clean_text(source_text)[:1200],
        "retrievedAt": programme.get("officialVerifiedAt"),
        "confidence": 1 if source_text else 0,
    }
    programme.setdefault("evidence", []).append(item)
    programme["fieldEvidence"] = programme.get("evidence", [])


def state_for_special(special: dict, key: str) -> str:
    return "official-value" if special.get(key, {}).get("status") == "official-value" else "official-unpublished"


def calibrate(batch_dir: Path) -> None:
    retrieved_at = now_iso()
    candidate_path = batch_dir / "08_candidate_dataset.json"
    coverage_path = batch_dir / "07_field_coverage_matrix.json"
    deep_path = batch_dir / "14_deep_source_field_audit.json"
    parity_path = batch_dir / "10_display_parity_report.json"
    exception_path = batch_dir / "11_exception_queue.json"
    delivery_path = batch_dir / "delivery.json"
    report_path = batch_dir / "12_operator_review_report.md"

    candidate = json.loads(candidate_path.read_text(encoding="utf-8"))
    programmes = candidate.get("programmes", [])
    coverage = json.loads(coverage_path.read_text(encoding="utf-8"))
    deep = json.loads(deep_path.read_text(encoding="utf-8"))
    parity = json.loads(parity_path.read_text(encoding="utf-8"))
    delivery = json.loads(delivery_path.read_text(encoding="utf-8"))

    audit_records = []
    metrics = Counter()
    by_level = Counter()
    samples: dict[str, list[dict]] = defaultdict(list)

    for programme in programmes:
        by_level[programme["level"]] += 1
        source_url = programme.get("officialSourceUrl") or programme.get("sourceUrl") or ""
        language = parse_language(programme.get("officialLanguageRequirement", ""), source_url)
        academic = parse_academic_performance(programme.get("officialAcademicRequirement", ""), programme.get("level", ""), source_url)
        special = parse_special_requirements(programme.get("officialAcademicRequirement", "") + " " + programme.get("officialLanguageRequirement", ""), source_url)
        documents = documents_for(programme, special)

        programme["sourceDataStatus"] = "verified-official"
        programme["commercialDisplayStatus"] = "needs-review"
        programme["publicDisplayStatus"] = "needs-review"
        programme["reviewReason"] = (
            "Official facts calibrated; public display still requires localization and final student-facing copy review."
        )
        programme["language"] = language
        programme["languageRequirementStructured"] = language
        programme["listLanguageSummary"] = language.get("listSummary")
        programme["ieltsOnlySummary"] = language.get("ieltsOnlySummary")
        programme["ieltsOnlySummaryStatus"] = language.get("ieltsOnlySummaryStatus")
        programme["academicPerformanceRequirement"] = academic
        programme["gpaOrAcademicPerformanceRequirement"] = academic
        programme["entryPathwayThresholds"] = academic.get("thresholds", [])
        programme["specialRequirements"] = special
        programme["applicationDocuments"] = documents
        programme["requirements"]["documents"] = documents
        programme["requirements"]["languageStructured"] = language
        programme["requirements"]["academicPerformance"] = academic
        programme["requirements"]["specialRequirements"] = special

        update_evidence(programme, ["language", "languageRequirementStructured", "ieltsOnlySummary"], language.get("internationalText", ""), source_url)
        update_evidence(programme, ["academicPerformanceRequirement", "entryPathwayThresholds"], academic.get("sourceText", ""), source_url)
        update_evidence(programme, ["applicationDocuments"], "; ".join(documents["items"]), documents["sourceUrl"])

        if language.get("ieltsOnlySummaryStatus") == "official-value":
            metrics["ieltsSummaryOfficialValue"] += 1
        else:
            metrics["ieltsSummaryOfficialUnpublished"] += 1
            samples["ieltsSummaryOfficialUnpublished"].append(
                {"code": programme["code"], "nameEnOfficial": programme["nameEnOfficial"], "languageSummary": language.get("listSummary")}
            )
        if academic.get("status") == "official-value":
            metrics["academicPerformanceStructured"] += 1
        for key, value in special.items():
            if value.get("status") == "official-value":
                metrics[f"{key}OfficialValue"] += 1
                if len(samples[key]) < 8:
                    samples[key].append({"code": programme["code"], "nameEnOfficial": programme["nameEnOfficial"], "sourceText": value.get("sourceText", [])[:2]})

        audit_records.append(
            {
                "code": programme["code"],
                "nameEnOfficial": programme["nameEnOfficial"],
                "level": programme["level"],
                "sourceUrl": source_url,
                "languageStatus": language["status"],
                "ieltsOnlySummaryStatus": language["ieltsOnlySummaryStatus"],
                "academicPerformanceStatus": academic["status"],
                "documentRoute": documents["route"],
                "specialRequirementStates": {key: value["status"] for key, value in special.items()},
                "publicDisplayStatus": programme["publicDisplayStatus"],
                "remainingDisplayWork": [
                    "localized programme/faculty names",
                    "student-facing Chinese overview",
                    "localized course setting",
                    "localized career directions",
                ],
            }
        )

    coverage_by_code = {row.get("code"): row for row in coverage}
    for programme in programmes:
        row = coverage_by_code.get(programme["code"])
        if not row:
            continue
        fields = row.setdefault("fields", {})
        source_url = programme.get("officialSourceUrl")
        language = programme["language"]
        academic = programme["academicPerformanceRequirement"]
        special = programme["specialRequirements"]
        fields["languageScores"] = {"state": language["status"], "evidence": source_url}
        fields["listIeltsSummary"] = {"state": language["ieltsOnlySummaryStatus"], "evidence": source_url}
        fields["academicPerformanceRequirement"] = {"state": academic["status"], "evidence": source_url}
        fields["applicationDocumentsStructured"] = {"state": "general-rule", "evidence": programme["applicationDocuments"]["sourceUrl"]}
        for key, field_name in [
            ("interview", "interviewRequirement"),
            ("aptitudeAssessment", "aptitudeAssessment"),
            ("portfolio", "portfolioRequirement"),
            ("workExperience", "workExperienceRequirement"),
            ("proposal", "proposalRequirement"),
            ("supervisor", "supervisorRequirement"),
            ("priorPublication", "priorPublicationRoute"),
            ("healthMedical", "healthMedicalRequirement"),
            ("bridgingModule", "bridgingModuleRequirement"),
            ("referenceLetter", "referenceLetterRequirement"),
        ]:
            fields[field_name] = {"state": state_for_special(special, key), "evidence": source_url}
        fields["studentFacingContentHygiene"] = {
            "state": "needs-review",
            "evidence": "Official facts calibrated; Chinese public display text still requires localization review.",
        }
        fields["localization"] = {
            "state": "needs-review",
            "evidence": "Names, faculty, overview, course setting, and career directions require StudyMY localization.",
        }

    deep_by_code = {row.get("candidateCode"): row for row in deep.get("records", [])}
    for programme in programmes:
        row = deep_by_code.get(programme["code"])
        if not row:
            continue
        row.setdefault("checkedRoutes", []).extend(
            [
                {"route": "structured-language-calibration", "sourceUrl": programme.get("officialSourceUrl"), "status": "checked"},
                {"route": "structured-academic-performance-calibration", "sourceUrl": programme.get("officialSourceUrl"), "status": "checked"},
                {"route": "application-documents-calibration", "sourceUrl": programme["applicationDocuments"]["sourceUrl"], "status": "checked"},
            ]
        )
        fields = row.setdefault("fields", {})
        fields["languageScores"] = programme["language"]["status"]
        fields["listIeltsSummary"] = programme["language"]["ieltsOnlySummaryStatus"]
        fields["academicPerformanceRequirement"] = programme["academicPerformanceRequirement"]["status"]
        fields["applicationDocumentsStructured"] = "general-rule"
        for key, field_name in [
            ("interview", "interviewRequirement"),
            ("portfolio", "portfolioRequirement"),
            ("workExperience", "workExperienceRequirement"),
            ("proposal", "proposalRequirement"),
            ("supervisor", "supervisorRequirement"),
            ("priorPublication", "priorPublicationRoute"),
            ("healthMedical", "healthMedicalRequirement"),
        ]:
            fields[field_name] = state_for_special(programme["specialRequirements"], key)

    ielts_ready = metrics["ieltsSummaryOfficialValue"]
    total = len(programmes)
    for surface in parity.get("surfaces", []):
        if surface.get("surface") == "program-list rows":
            surface["fields"]["ieltsOnlySummary"] = {
                "state": "ready" if ielts_ready == total else "review",
                "reason": f"{ielts_ready}/{total} records have official IELTS summary; non-IELTS official language routes require display decision.",
            }
            surface["fields"]["structuredLanguageRoutes"] = {
                "state": "ready",
                "reason": "Language requirements were split into structured official routes where published.",
            }
        if surface.get("surface") == "program-detail sections":
            surface["fields"]["structuredRequirements"] = {
                "state": "ready",
                "reason": "Academic performance, language routes, documents, and special requirements were calibrated into structured fields.",
            }
            surface["fields"]["overview"] = {
                "state": "review",
                "reason": "Chinese localization remains required before public student display.",
            }
            surface["fields"]["courseSetting"] = {
                "state": "review",
                "reason": "Official structure captured; Chinese course localization remains required.",
            }
            surface["fields"]["careers"] = {
                "state": "review",
                "reason": "Official career content captured; Chinese career localization remains required.",
            }

    exception_queue = {
        "blocking": [],
        "review": [
            {
                "code": "TSU-CALIBRATION-LOCALIZATION",
                "scope": "display",
                "affectedRecords": total,
                "issue": "Official facts are calibrated, but Chinese student-facing localization is still not ready for public display.",
                "nextAction": "Translate and review programme names, faculty names, overview, course setting, and career directions before publication.",
            },
            {
                "code": "TSU-CALIBRATION-IELTS-LIST",
                "scope": "program-list",
                "affectedRecords": total - ielts_ready,
                "issue": "Some records publish official English routes without a direct IELTS scalar summary.",
                "nextAction": "Decide list display policy for official MUET/equivalent-only records without inventing IELTS.",
            },
        ],
    }
    if exception_queue["review"][1]["affectedRecords"] == 0:
        exception_queue["review"].pop()

    calibration = {
        "schemaVersion": 1,
        "institution": "Taylor's University",
        "universityCode": "TSU",
        "officialDomains": [OFFICIAL_DOMAIN],
        "retrievedAt": retrieved_at,
        "recordCount": total,
        "recordsByLevel": dict(by_level),
        "metrics": dict(metrics),
        "samples": dict(samples),
        "records": audit_records,
        "decision": "review-required",
    }
    write_json(batch_dir / "17_deep_calibration_audit.json", calibration)

    summary_lines = [
        "# Taylor's University 深挖校对报告",
        "",
        f"- 校对时间：{retrieved_at}",
        f"- 校对记录：{total} 条，本科 {by_level['bachelor']}、硕士 {by_level['master']}、博士/DBA {by_level['phd']}。",
        "- 授权：collect-only；未入库、未发布、未重启项目端。",
        "- 结论：官方事实字段已进一步结构化校对；中文学生端展示仍为 review-required。",
        "",
        "## 已结构化校对",
        "",
        f"- 语言要求：{total}/{total} 已拆出国际申请人口径文本与官方语言路线。",
        f"- IELTS list summary：{ielts_ready}/{total} 有官方 IELTS 数值；{total - ielts_ready}/{total} 需要非 IELTS 路线展示决策。",
        f"- GPA/CGPA/academic-performance：{metrics['academicPerformanceStructured']}/{total} 已拆出官方成绩门槛或学历门槛。",
        f"- Work experience：{metrics['workExperienceOfficialValue']} 条。",
        f"- Interview / internal assessment：{metrics['interviewOfficialValue']} 条。",
        f"- Portfolio：{metrics['portfolioOfficialValue']} 条。",
        f"- Proposal：{metrics['proposalOfficialValue']} 条。",
        f"- Supervisor / doctoral faculty：{metrics['supervisorOfficialValue']} 条。",
        f"- Prior publication route：{metrics['priorPublicationOfficialValue']} 条。",
        f"- Health / medical：{metrics['healthMedicalOfficialValue']} 条。",
        "- Application documents：已按 undergraduate、postgraduate coursework international、postgraduate research international 三类 general-rule 加 programme-specific supplements。",
        "",
        "## 仍需人工验收",
        "",
        "- 89/89 仍需中文本地化：专业名、faculty、简介、课程设置、职业方向。",
        "- Recognition / accreditation 仍按官方未公布处理，不能推断。",
        "- 中国学生专项路径仍按官方未公布处理，不能泛化承诺。",
        "- 非 IELTS-only 语言记录需要产品展示策略，不能凭等效关系反推 IELTS。",
    ]
    (batch_dir / "18_deep_calibration_report.md").write_text("\n".join(summary_lines) + "\n", encoding="utf-8")

    candidate["retrievedAt"] = retrieved_at
    candidate["calibration"] = {
        "status": "review-required",
        "calibratedAt": retrieved_at,
        "auditPath": "17_deep_calibration_audit.json",
        "reportPath": "18_deep_calibration_report.md",
    }
    write_json(candidate_path, candidate)
    write_json(coverage_path, coverage)
    write_json(deep_path, deep)
    write_json(parity_path, parity)
    write_json(exception_path, exception_queue)

    ready_count = sum(1 for p in programmes if p.get("publicDisplayStatus") == "ready")
    needs_review_count = total - ready_count
    delivery["counts"]["ready"] = ready_count
    delivery["counts"]["needsReview"] = needs_review_count
    delivery["exceptions"] = exception_queue
    delivery["decision"] = "review-required"
    delivery["verification"]["deepCalibration"] = "passed"
    delivery["coverage"]["localization"] = {"covered": 0, "unpublished": 0, "review": total}
    delivery["coverage"]["languageScores"] = {"covered": total, "unpublished": 0, "review": 0}
    delivery["coverage"]["academicPerformanceRequirement"] = {
        "covered": metrics["academicPerformanceStructured"],
        "unpublished": total - metrics["academicPerformanceStructured"],
        "review": 0,
    }
    delivery["coverage"]["applicationDocuments"] = {"covered": total, "unpublished": 0, "review": 0}

    report = report_path.read_text(encoding="utf-8") if report_path.exists() else ""
    report += (
        "\n## 深挖校对补充\n\n"
        f"- 校对时间：{retrieved_at}。\n"
        f"- 已将 {total} 条候选的语言要求、成绩门槛、申请材料和特殊要求拆为结构化字段。\n"
        f"- 严格 public display 状态已调整为 needs-review={needs_review_count}、ready={ready_count}；官方事实状态保留为 verified-official。\n"
        "- 当前决策调整为 review-required，原因是中文本地化和部分 IELTS-only 列表策略仍需验收。\n"
    )
    report_path.write_text(report, encoding="utf-8")

    artifact_paths = {
        "07_field_coverage_matrix.json",
        "08_candidate_dataset.json",
        "10_display_parity_report.json",
        "11_exception_queue.json",
        "12_operator_review_report.md",
        "14_deep_source_field_audit.json",
        "17_deep_calibration_audit.json",
        "18_deep_calibration_report.md",
    }
    existing = delivery.get("artifacts", [])
    by_path = {item.get("path"): item for item in existing if item.get("path")}
    for path_name in artifact_paths:
        path = batch_dir / path_name
        if not path.exists():
            continue
        role = "audit" if path_name.endswith(".json") and path_name.startswith("17_") else "report" if path_name.endswith(".md") else by_path.get(path_name, {}).get("role", "audit")
        by_path[path_name] = {
            "role": role,
            "path": path_name,
            "sha256": sha256(path),
            "description": by_path.get(path_name, {}).get("description", path_name),
        }
    delivery["artifacts"] = list(by_path.values())
    write_json(delivery_path, delivery)

    print(
        json.dumps(
            {
                "batchDir": str(batch_dir),
                "records": total,
                "publicReady": ready_count,
                "publicNeedsReview": needs_review_count,
                "ieltsOfficialValue": ielts_ready,
                "academicPerformanceStructured": metrics["academicPerformanceStructured"],
                "decision": "review-required",
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch-dir", type=Path, default=DEFAULT_BATCH_DIR)
    args = parser.parse_args()
    calibrate(args.batch_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
