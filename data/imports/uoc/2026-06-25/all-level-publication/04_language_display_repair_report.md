# UoC 语言要求展示补缺修复报告

## 修复范围

- 院校：University of Cyberjaya
- 修复对象：无 IELTS 分数、但官方页面已发布 MUET / CEFR 英语要求的公开专业
- 修复目标：公开页不再显示“以院校官方页面为准”，改为展示可核验的语言要求摘要

## 受影响专业

- Bachelor in Creative Multimedia (Honours)：`MUET 3+`
- Bachelor of Multimedia (Honours) in 3D Animation：`MUET 3+`
- Bachelor of Art (Honours) in Graphic Design (Advertising)：`MUET 3+`
- Bachelor in Occupational Safety And Health (Honours)：`MUET 3+`

## 验收结果

- UoC 公开 API 共 42 个专业，4 个无 IELTS 专业均已输出明确 MUET 要求，兜底文案数量为 0。
- 前端详情页抽检 `Bachelor in Creative Multimedia (Honours)` 已显示 `MUET 3+`，未出现“以院校官方页面为准”。
- `tests/web/format.test.ts` 已覆盖 MUET / CEFR 无 IELTS 场景。
