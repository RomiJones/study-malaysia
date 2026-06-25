# INTI 多语言界面隔离修复报告

## 修复范围

- 院校：INTI International University & Colleges
- 公开专业：107 条
- 问题类型：中文界面专业名/学院名被英文占位；四语言界面切换存在语言槽污染风险

## 修复动作

- INTI 导入器改为读取 `INTI_audit_*_20260625_reviewed_v3.json` 中的中文专业名和中文学院名。
- 重新导入 INTI 107 条公开专业，覆盖数据库中错误的 `name.zh-CN`、`name.zh-TW`、`faculty.zh-CN`、`faculty.zh-TW`。
- 在 INTI 导入验证中加入语言隔离门禁：中文/繁中必须是中文专业名和中文学院名；英文/马来不得出现中文字符。

## 验收结果

- INTI API 公开专业数：107。
- 语言槽扫描问题数：0。
- `verify:inti:official-audit` 通过。
- `tests/api/inti-official-audit-import.test.ts` 通过。
- 前端四语言抽检通过：`zh-CN`、`zh-TW`、`en`、`ms` 均未出现专业名/学院名跨语言泄漏。

## 备注

- 本次修复不修改前端展示逻辑，不用前端 fallback 掩盖数据问题。
- Notion 未直接更新。
