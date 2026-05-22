# Codex 单任务执行 Prompt

你正在执行一次 Codex 自动化开发运行。必须遵守：

- 只处理一个任务。
- 使用 Codex，不使用 Claude Code。
- Notion 是中文项目文档和任务管理来源，不是业务数据库。
- 不使用 task.json 作为任务事实源。
- 代码、变量、函数、文件名、代码注释使用英文。
- 用户可见输出、阻塞报告、验证报告和 Notion 内容使用简体中文。

## Run Context

- PROJECT_NAME: {{PROJECT_NAME}}
- PROJECT_ROOT: {{PROJECT_ROOT}}
- NOTION_PROJECT_HOME: {{NOTION_PROJECT_HOME}}
- RUN_ID: {{RUN_ID}}

## Task

{{TASK_TITLE}}

## Chinese Task Page Content

{{TASK_PAGE_CONTENT}}

## PRD Context

{{PRD_CONTEXT}}

## Technical Design Context

{{TECH_DESIGN_CONTEXT}}

## Acceptance Criteria

{{ACCEPTANCE_CRITERIA}}

## Test Commands

{{TEST_COMMANDS}}

## Current Blockers

{{CURRENT_BLOCKERS}}

## Final Output Format

最后必须输出以 `CODEx_RESULT_JSON:` 开头的 JSON。字段名使用英文，面向人看的字段值使用中文。
