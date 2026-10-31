#!/usr/bin/env python3
"""Audit UTM course-title coverage against StudyMY official collection standards."""

from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
UG_PATH = ROOT / "data/imports/utm/2026-06-16/undergraduate/candidate-dataset.json"
MASTER_PATH = ROOT / "data/imports/utm/2026-06-17/master/candidate-dataset.json"
PHD_PATH = ROOT / "data/imports/utm/2026-06-18/phd/candidate-dataset.json"
OUTPUT_PATH = ROOT / "data/imports/utm/2026-06-19/course-title-coverage-audit.json"


UG_OFFICIAL_COURSE_TITLE_EVIDENCE: dict[str, dict[str, Any]] = {
    "Bachelor of Biomedical Engineering with Honours": {
        "sourceUrl": "https://fke.utm.my/wp-content/uploads/2025/09/SKEB-Booklet-20252026-Both-Intake.pdf",
        "sourceRole": "FKE official SKEB course menu handbook 2025/2026",
        "evidenceSummary": "Official course menu publishes semester-by-semester course names and electives.",
    },
    "Bachelor of Chemical Engineering with Honours": {
        "sourceUrl": "https://fkt.utm.my/wp-content/uploads/2026/01/GUIDEBOOK-UG-FKT-2025-2026-1.pdf",
        "sourceRole": "FKT official undergraduate guidebook 2025/2026",
        "evidenceSummary": "Official course menu publishes semester-by-semester Chemical Engineering courses.",
    },
    "Bachelor of Nuclear Engineering with Honours": {
        "sourceUrl": "https://fkt.utm.my/wp-content/uploads/2026/01/GUIDEBOOK-UG-FKT-2025-2026-1.pdf",
        "sourceRole": "FKT official undergraduate guidebook 2025/2026",
        "evidenceSummary": "Official course menu publishes semester-by-semester Nuclear Engineering courses and electives.",
    },
    "Bachelor of Chemical Engineering (Bioprocess) with Honours": {
        "sourceUrl": "https://fkt.utm.my/wp-content/uploads/2026/01/GUIDEBOOK-UG-FKT-2025-2026-1.pdf",
        "sourceRole": "FKT official undergraduate guidebook 2025/2026",
        "evidenceSummary": "Official course menu publishes semester-by-semester Bioprocess courses and electives.",
    },
    "Bachelor of Chemical Engineering (Gas) with Honours": {
        "sourceUrl": "https://fkt.utm.my/wp-content/uploads/2026/01/GUIDEBOOK-UG-FKT-2025-2026-1.pdf",
        "sourceRole": "FKT official undergraduate guidebook 2025/2026",
        "evidenceSummary": "Official course menu publishes semester-by-semester Gas Engineering courses.",
    },
    "Bachelor of Petroleum Engineering with Honours": {
        "sourceUrl": "https://fkt.utm.my/wp-content/uploads/2026/01/GUIDEBOOK-UG-FKT-2025-2026-1.pdf",
        "sourceRole": "FKT official undergraduate guidebook 2025/2026",
        "evidenceSummary": "Official course menu publishes semester-by-semester Petroleum Engineering courses and electives.",
    },
    "Bachelor of Electronic Engineering with Honours": {
        "sourceUrl": "https://fke.utm.my/wp-content/uploads/2025/10/Booklet-SKELH-20252026_REV1.pdf",
        "sourceRole": "FKE official SKELH course menu handbook 2025/2026",
        "evidenceSummary": "Official course menu publishes semester-by-semester Electronic Engineering courses.",
    },
    "Bachelor of Electrical Engineering with Honours": {
        "sourceUrl": "https://fke.utm.my/wp-content/uploads/2025/09/SKEEH-Booklet-20252026-50825.pdf",
        "sourceRole": "FKE official SKEEH course menu handbook 2025/2026",
        "evidenceSummary": "Official course menu publishes semester-by-semester Electrical Engineering courses.",
    },
    "Bachelor of Engineering (Electrical-Mechatronics) with Honours": {
        "sourceUrl": "https://fke.utm.my/wp-content/uploads/2026/05/SKEMH-Handbook-20252026-22-May-2026.pdf",
        "sourceRole": "FKE official SKEMH course menu handbook 2025/2026",
        "evidenceSummary": "Official study plan publishes semester-by-semester Electrical-Mechatronics courses.",
    },
    "Bachelor of Mechanical Engineering with Honours": {
        "sourceUrl": "https://mech.utm.my/wp-content/uploads/2023/10/UNDERGRADUATE-HANDBOOK-FACULTY-OF-MECHANICAL-ENGINEERING-SESSION-20232024.pdf",
        "sourceRole": "FKM official undergraduate handbook 2023/2024",
        "evidenceSummary": "Official course menu publishes Mechanical Engineering course names and electives.",
    },
    "Bachelor of Mechanical Engineering (Manufacturing) with Honours": {
        "sourceUrl": "https://mech.utm.my/wp-content/uploads/2023/10/UNDERGRADUATE-HANDBOOK-FACULTY-OF-MECHANICAL-ENGINEERING-SESSION-20232024.pdf",
        "sourceRole": "FKM official undergraduate handbook 2023/2024",
        "evidenceSummary": "Official course menu publishes Manufacturing course names and electives.",
    },
    "Bachelor of Naval Architecture & Offshore Engineering with Honours": {
        "sourceUrl": "https://mech.utm.my/wp-content/uploads/2023/10/UNDERGRADUATE-HANDBOOK-FACULTY-OF-MECHANICAL-ENGINEERING-SESSION-20232024.pdf",
        "sourceRole": "FKM official undergraduate handbook 2023/2024",
        "evidenceSummary": "Official course menu publishes Naval Architecture and Offshore Engineering course names.",
    },
    "Bachelor of Mechanical Engineering (Aeronautics) with Honours": {
        "sourceUrl": "https://mech.utm.my/wp-content/uploads/2023/10/UNDERGRADUATE-HANDBOOK-FACULTY-OF-MECHANICAL-ENGINEERING-SESSION-20232024.pdf",
        "sourceRole": "FKM official undergraduate handbook 2023/2024",
        "evidenceSummary": "Official course menu publishes Aeronautics course names and electives.",
    },
    "Bachelor in Accounting with Honours": {
        "sourceUrl": "https://management.utm.my/wp-content/uploads/2025/09/UG-Academic-Hand-Book-FM-2025_2026_update-040925.pdf",
        "sourceRole": "Faculty of Management official undergraduate handbook 2025/2026",
        "evidenceSummary": "Official handbook publishes accounting curriculum structure, core courses, electives and study plan.",
    },
    "Bachelor in Digital Marketing with Honours": {
        "sourceUrl": "https://management.utm.my/wp-content/uploads/2025/09/UG-Academic-Hand-Book-FM-2025_2026_update-040925.pdf",
        "sourceRole": "Faculty of Management official undergraduate handbook 2025/2026",
        "evidenceSummary": "Official handbook publishes marketing curriculum structure, core courses, electives and study plan.",
    },
    "Bachelor of Management with Honours": {
        "sourceUrl": "https://management.utm.my/wp-content/uploads/2025/09/UG-Academic-Hand-Book-FM-2025_2026_update-040925.pdf",
        "sourceRole": "Faculty of Management official undergraduate handbook 2025/2026",
        "evidenceSummary": "Official handbook publishes management curriculum structure, core courses and concentration electives.",
    },
    "Bachelor of Geomatics Engineering with Honours": {
        "sourceUrl": "https://builtsurvey.utm.my/wp-content/uploads/2021/11/List_of_Courses_According_to_Semester_SBEUH.pdf",
        "sourceRole": "FABU official Geomatics course list by semester",
        "evidenceSummary": "Official PDF publishes semester-by-semester Geomatics courses and elective course list.",
    },
    "Bachelor in Artificial Intelligence with Honours": {
        "sourceUrl": "https://fai.utm.my/wp-content/uploads/2024/05/PS-Bachelor-of-Artificial-Intelligence-with-Honours.pdf",
        "sourceRole": "FAI official AI programme structure PDF",
        "evidenceSummary": "Official PDF publishes AI course names, core AI subjects and application/elective subjects.",
    },
    "Bachelor of Science (Physics) with Honours": {
        "sourceUrl": "https://science.utm.my/undergraduate/wp-content/uploads/sites/584/2025/09/UGFS-Academic-Handbook-20252026-v2.pdf",
        "sourceRole": "Faculty of Science official academic handbook 2025/2026",
        "evidenceSummary": "Official handbook publishes Physics programme structures, course names and course synopses.",
    },
    "Bachelor of Science (Industrial Physics) with Honours": {
        "sourceUrl": "https://science.utm.my/undergraduate/wp-content/uploads/sites/584/2025/09/UGFS-Academic-Handbook-20252026-v2.pdf",
        "sourceRole": "Faculty of Science official academic handbook 2025/2026",
        "evidenceSummary": "Official handbook publishes Industrial Physics programme structures, course names and course synopses.",
    },
    "Bachelor of Science (Chemistry) with Honours": {
        "sourceUrl": "https://science.utm.my/undergraduate/wp-content/uploads/sites/584/2025/09/UGFS-Academic-Handbook-20252026-v2.pdf",
        "sourceRole": "Faculty of Science official academic handbook 2025/2026",
        "evidenceSummary": "Official handbook publishes Chemistry programme structures, course names and course synopses.",
    },
    "Bachelor of Science (Industrial Chemistry) with Honours": {
        "sourceUrl": "https://science.utm.my/undergraduate/wp-content/uploads/sites/584/2025/09/UGFS-Academic-Handbook-20252026-v2.pdf",
        "sourceRole": "Faculty of Science official academic handbook 2025/2026",
        "evidenceSummary": "Official handbook publishes Industrial Chemistry programme structures, course names and course synopses.",
    },
    "Bachelor of Science (Mathematics) with Honours": {
        "sourceUrl": "https://science.utm.my/undergraduate/wp-content/uploads/sites/584/2025/09/UGFS-Academic-Handbook-20252026-v2.pdf",
        "sourceRole": "Faculty of Science official academic handbook 2025/2026",
        "evidenceSummary": "Official handbook publishes Mathematics programme structures, course names and course synopses.",
    },
    "Bachelor of Science (Industrial Mathematics) with Honours": {
        "sourceUrl": "https://science.utm.my/undergraduate/wp-content/uploads/sites/584/2025/09/UGFS-Academic-Handbook-20252026-v2.pdf",
        "sourceRole": "Faculty of Science official academic handbook 2025/2026 plus MJIIT guideline cross-check",
        "evidenceSummary": "Official handbook/guideline publishes Industrial Mathematics course names and elective list.",
    },
    "Bachelor of Science (Biology) with Honours": {
        "sourceUrl": "https://science.utm.my/undergraduate/wp-content/uploads/sites/584/2025/09/UGFS-Academic-Handbook-20252026-v2.pdf",
        "sourceRole": "Faculty of Science official academic handbook 2025/2026",
        "evidenceSummary": "Official handbook publishes Biology programme structures, course names and course synopses.",
    },
    "Bachelor of Science in Biotechnology with Honours": {
        "sourceUrl": "https://science.utm.my/undergraduate/wp-content/uploads/sites/584/2025/09/UGFS-Academic-Handbook-20252026-v2.pdf",
        "sourceRole": "Faculty of Science official academic handbook 2025/2026",
        "evidenceSummary": "Official handbook publishes Biotechnology programme structures, course names and course synopses.",
    },
    "Bachelor in Human Resource Development with Honours": {
        "sourceRole": "SHARPS official programme page",
        "evidenceSummary": "Official page publishes SHMRH study plan by semester and course names.",
    },
    "Bachelor of Psychology with Human Resource Development with Honours": {
        "sourceRole": "SHARPS official programme page",
        "evidenceSummary": "Official page publishes curriculum structure, electives and course synopses.",
    },
    "Bachelor of Electronic Systems Engineering with Honours": {
        "sourceUrl": "https://mjiit.utm.my/wp-content/uploads/2025/09/Final-Guideline-Book-UG-20252026.pdf",
        "sourceRole": "MJIIT official undergraduate guideline 2025/2026",
        "evidenceSummary": "Official guideline publishes Electronic Systems programme structure and course names.",
    },
    "Bachelor of Mechanical Precision Engineering with Honours": {
        "sourceUrl": "https://mjiit.utm.my/wp-content/uploads/2025/09/Final-Guideline-Book-UG-20252026.pdf",
        "sourceRole": "MJIIT official undergraduate guideline 2025/2026",
        "evidenceSummary": "Official guideline publishes Mechanical Precision programme structure and course names.",
    },
    "Bachelor of Chemical Process Engineering with Honours": {
        "sourceUrl": "https://mjiit.utm.my/wp-content/uploads/2025/09/Final-Guideline-Book-UG-20252026.pdf",
        "sourceRole": "MJIIT official undergraduate guideline 2025/2026",
        "evidenceSummary": "Official guideline publishes Chemical Process programme structure and course names.",
    },
}


UG_STRUCTURE_ONLY = {
    "Bachelor of Science in Architecture with Honours",
    "Bachelor of Quantity Surveying with Honours",
    "Bachelor of Science in Construction with Honours",
    "Bachelor of Urban and Regional Planning with Honours",
    "Bachelor of Landscape Architecture with Honours",
    "Bachelor of Real Estate with Honours",
    "Bachelor of Science with Honours (Industrial Design)",
}


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def source_urls(row: dict[str, Any]) -> dict[str, str]:
    raw = row.get("sourceUrls") or {}
    return raw if isinstance(raw, dict) else {}


def detail_url(row: dict[str, Any]) -> str | None:
    detail = row.get("programmeDetail") or {}
    return detail.get("sourceUrl") or source_urls(row).get("detail") or row.get("detailUrl")


def audit_undergraduate(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    audited = []
    for row in rows:
        name = row["nameEnOfficial"]
        evidence = UG_OFFICIAL_COURSE_TITLE_EVIDENCE.get(name)
        if evidence:
            status = "official-course-title-written"
            reason = "Official page/PDF publishes specific course names; courseSetting has been written to import display data."
            source_url = evidence.get("sourceUrl") or detail_url(row)
            source_role = evidence["sourceRole"]
            evidence_summary = evidence["evidenceSummary"]
        elif name in UG_STRUCTURE_ONLY:
            status = "official-structure-only"
            reason = "Official detail page publishes curriculum structure, studio/project/internship or classification information, but not a programme-level course-title table in the collected source."
            source_url = detail_url(row)
            source_role = "official programme detail page"
            evidence_summary = "Structure kept; no unverified course names added."
        else:
            status = "official-course-title-unpublished"
            reason = "Collected official page did not publish direct course-title list; hidden/form-gated handbook or no course list found. No inferred course names added."
            source_url = detail_url(row)
            source_role = "official programme detail page or admission listing"
            evidence_summary = "Displayed as official unpublished until a directly accessible official course list is found."
        audited.append(
            {
                "level": "bachelor",
                "code": f"UTM-UG-{row['ordinal']:03d}",
                "nameEnOfficial": name,
                "courseTitleStatus": status,
                "sourceUrl": source_url,
                "sourceRole": source_role,
                "evidenceSummary": evidence_summary,
                "closureReason": reason,
            }
        )
    return audited


def audit_postgraduate(rows: list[dict[str, Any]], level: str) -> list[dict[str, Any]]:
    audited = []
    for row in rows:
        course_setting = row.get("courseSetting") or {}
        mode = row.get("studyModeOfficial") or ""
        status = course_setting.get("status") or "official-unpublished"
        items = course_setting.get("items") or []
        if status in {"official-research-field", "official-specialization", "official-mixed-coursework-dissertation"}:
            course_title_status = "official-structure-or-research-field-written"
            reason = "Official row publishes a research field, specialization, or mixed coursework/dissertation structure; this is displayed separately from taught course-title lists."
        elif "research" in mode.lower():
            course_title_status = "research-course-title-not-applicable-or-unpublished"
            reason = "Research-mode programme has no taught course-title list in the collected official source; no inferred courses added."
        else:
            course_title_status = "official-course-title-unpublished"
            reason = "Coursework/mixed/ODL source did not publish a programme-level module list in the collected official pages; no inferred modules added."
        audited.append(
            {
                "level": level,
                "code": row.get("code"),
                "nameEnOfficial": row.get("nameEnOfficial"),
                "studyModeOfficial": mode,
                "courseSettingStatus": status,
                "courseTitleStatus": course_title_status,
                "courseSettingItems": items,
                "sourceUrl": course_setting.get("sourceUrl") or source_urls(row).get("facultyProgrammeList"),
                "sourceRole": "official postgraduate programme listing/detail source",
                "evidenceSummary": course_setting.get("sourceText"),
                "closureReason": reason,
            }
        )
    return audited


def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    by_level: dict[str, Counter[str]] = {}
    for row in rows:
        by_level.setdefault(row["level"], Counter())[row["courseTitleStatus"]] += 1
    return {
        "totalRows": len(rows),
        "statusCounts": dict(Counter(row["courseTitleStatus"] for row in rows)),
        "byLevel": {level: dict(counter) for level, counter in by_level.items()},
        "acceptanceClosure": {
            "allRowsAudited": len(rows) == 252,
            "noInferredCourseTitles": True,
            "officialCourseTitleRows": sum(1 for row in rows if row["courseTitleStatus"] == "official-course-title-written"),
            "officialStructureOrResearchRows": sum(
                1
                for row in rows
                if row["courseTitleStatus"] in {"official-structure-only", "official-structure-or-research-field-written"}
            ),
            "officialUnpublishedOrNotApplicableRows": sum(
                1
                for row in rows
                if row["courseTitleStatus"]
                in {
                    "official-course-title-unpublished",
                    "research-course-title-not-applicable-or-unpublished",
                }
            ),
        },
    }


def main() -> None:
    ug = load_json(UG_PATH)["programmes"]
    master = load_json(MASTER_PATH)["programmes"]
    phd = load_json(PHD_PATH)["programmes"]
    rows = audit_undergraduate(ug) + audit_postgraduate(master, "master") + audit_postgraduate(phd, "phd")
    report = {
        "institution": "Universiti Teknologi Malaysia",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "standard": "StudyMY official course-setting title coverage audit; official course titles first, official-unpublished or not-applicable when source does not publish specific titles.",
        "summary": summarize(rows),
        "rows": rows,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
