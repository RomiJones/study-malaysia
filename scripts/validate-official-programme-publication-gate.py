#!/usr/bin/env python3
"""Validate StudyMY official programme publication hard gates."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


CJK_RE = re.compile(r"[\u4e00-\u9fff]")
NON_IELTS_LANGUAGE_RE = re.compile(
    r"\b(TOEFL|PTE|MUET|Linguaskill|Pearson|Cambridge|CAE|CPE|PET|FCE)\b",
    re.IGNORECASE,
)
VAGUE_TUITION_RE = re.compile(
    r"(range|estimated|estimate|approximately|approx\.?|from\s+(RM|MYR|USD)?|"
    r"(RM|MYR|USD)?\s*[\d,]+\s*(?:-|–|—|to)\s*(RM|MYR|USD)?\s*[\d,]+|"
    r"区间|范围|估算|约|起|最低|最高)",
    re.IGNORECASE,
)


def has_cjk(value: Any) -> bool:
    return isinstance(value, str) and bool(CJK_RE.search(value))


def is_positive_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and value > 0


def is_positive_integer(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def iter_public_list_strings(obj: Any, path: str = ""):
    if isinstance(obj, dict):
        for key, value in obj.items():
            next_path = f"{path}.{key}" if path else str(key)
            key_l = str(key).lower()
            if isinstance(value, str) and (
                "list" in key_l
                or "public" in key_l
                or key_l in {"languageDisplay".lower(), "displayLanguage".lower()}
            ):
                yield next_path, value
            elif isinstance(value, (dict, list)):
                yield from iter_public_list_strings(value, next_path)
    elif isinstance(obj, list):
        for index, value in enumerate(obj):
            yield from iter_public_list_strings(value, f"{path}[{index}]")


def is_ready_programme(programme: dict[str, Any]) -> bool:
    return (
        programme.get("publicDisplayStatus") == "ready"
        or programme.get("auditStatus") == "official-verified-commercial-ready"
    )


def validate_programme(programme: dict[str, Any], index: int) -> list[str]:
    issues: list[str] = []
    label = programme.get("nameEn") or programme.get("name") or f"programme[{index}]"
    prefix = f"{index}. {label}"

    name = programme.get("name")
    name_en = programme.get("nameEn")
    if not has_cjk(name):
        issues.append(f"{prefix}: 专业名称必须是中文展示名")
    if isinstance(name, str) and isinstance(name_en, str):
        if name.strip() == name_en.strip():
            issues.append(f"{prefix}: 专业名称不得回退为官方英文名")
        if name_en not in name or "（" not in name or "）" not in name:
            issues.append(f"{prefix}: 专业名称必须采用中文译名 + 官方英文名全角括注")

    faculty_zh = programme.get("facultyZh")
    faculty = programme.get("faculty")
    if not has_cjk(faculty_zh):
        issues.append(f"{prefix}: 学院必须是中文展示名")
    if isinstance(faculty_zh, str) and isinstance(faculty, str) and faculty_zh.strip() == faculty.strip():
        issues.append(f"{prefix}: 学院不得回退为官方英文学院名")

    language = programme.get("language")
    ielts = language.get("ielts") if isinstance(language, dict) else None
    if not is_positive_number(ielts):
        issues.append(f"{prefix}: 专业列表语言要求必须有 IELTS/雅思数值")
    for field_path, value in iter_public_list_strings(programme):
        if "language" in field_path.lower() and NON_IELTS_LANGUAGE_RE.search(value):
            issues.append(f"{prefix}: 列表语言字段 {field_path} 不得展示非 IELTS 考试")

    tuition = programme.get("tuitionMYR")
    if not is_positive_integer(tuition):
        issues.append(f"{prefix}: 学费必须是准确的正整数 MYR 总费用")
    for field_name in ("tuitionNote", "tuitionDisplay", "listTuitionText"):
        value = programme.get(field_name)
        if isinstance(value, str) and VAGUE_TUITION_RE.search(value):
            issues.append(f"{prefix}: {field_name} 不得包含学费范围、估算或起始价")

    duration = programme.get("duration")
    if not is_positive_number(duration):
        issues.append(f"{prefix}: 学制列表必须是明确数字年数")

    return issues


def validate_file(path: Path) -> tuple[int, int, list[str]]:
    data = json.loads(path.read_text())
    programmes = data.get("programmes")
    if not isinstance(programmes, list):
        return 0, 0, [f"{path}: 缺少 programmes 数组"]

    issues: list[str] = []
    if data.get("safe_to_import") is not False:
        issues.append(f"{path}: safe_to_import 必须保持 false，等待 Ian 单独批准")

    ready_count = 0
    for index, programme in enumerate(programmes, start=1):
        if not isinstance(programme, dict):
            issues.append(f"{path}: programme[{index}] 不是 object")
            continue
        if not is_ready_programme(programme):
            continue
        ready_count += 1
        issues.extend(validate_programme(programme, index))

    return len(programmes), ready_count, [f"{path}: {issue}" for issue in issues]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audit_json", nargs="+", type=Path)
    args = parser.parse_args()

    total_programmes = 0
    total_ready = 0
    all_issues: list[str] = []

    for path in args.audit_json:
        programmes, ready, issues = validate_file(path)
        total_programmes += programmes
        total_ready += ready
        all_issues.extend(issues)
        status = "PASS" if not issues else "FAIL"
        print(f"{status} {path} programmes={programmes} ready={ready} issues={len(issues)}")

    if all_issues:
        print("\n[PUBLICATION HARD GATE FAILED]")
        for issue in all_issues:
            print(f"- {issue}")
        return 1

    print(
        "\n[PUBLICATION HARD GATE PASSED] "
        f"files={len(args.audit_json)} programmes={total_programmes} ready={total_ready}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
