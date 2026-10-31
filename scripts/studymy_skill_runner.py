#!/usr/bin/env python3
"""Run bundled StudyMY collector skill scripts from this repository.

The project keeps lightweight entry points in scripts/ so collection commands
are stable, while the Codex skill remains the canonical source for generic
audit gates.
"""

from __future__ import annotations

import os
import runpy
import sys
from pathlib import Path


DEFAULT_SKILL_DIR = Path.home() / ".codex" / "skills" / "studymy-official-university-collector"


def skill_dir() -> Path:
    return Path(os.environ.get("STUDYMY_COLLECTOR_SKILL_DIR", DEFAULT_SKILL_DIR)).expanduser()


def run_skill_script(script_name: str) -> None:
    script_path = skill_dir() / "scripts" / script_name
    if not script_path.exists():
        raise SystemExit(
            f"StudyMY collector skill script not found: {script_path}\n"
            "Set STUDYMY_COLLECTOR_SKILL_DIR to the skill directory."
        )
    sys.argv[0] = str(script_path)
    runpy.run_path(str(script_path), run_name="__main__")


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: studymy_skill_runner.py SCRIPT_NAME [args...]")
    script_name = sys.argv[1]
    sys.argv = [sys.argv[0], *sys.argv[2:]]
    run_skill_script(script_name)


if __name__ == "__main__":
    main()
