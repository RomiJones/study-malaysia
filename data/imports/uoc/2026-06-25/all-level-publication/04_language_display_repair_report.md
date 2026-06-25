# UoC 语言要求展示补缺修复报告

## 修复范围

- 院校：University of Cyberjaya
- 修复对象：无 IELTS 分数、但官方页面已发布 MUET / CEFR 英语要求的公开专业
- 修复目标：公开页不再显示“以院校官方页面为准”，主展示改为 IELTS 等效分数，并保留 MUET / CEFR 官方证据

## 受影响专业

- Bachelor in Creative Multimedia (Honours)：`IELTS 5.5+（等效）`
- Bachelor of Multimedia (Honours) in 3D Animation：`IELTS 5.5+（等效）`
- Bachelor of Art (Honours) in Graphic Design (Advertising)：`IELTS 5.5+（等效）`
- Bachelor in Occupational Safety And Health (Honours)：`IELTS 5.5+（等效）`

## 换算依据

- UoC 官方页面对相关专业标注 `MUET Band 3`，部分页面同时标注 `CEFR Low B2`。
- IELTS 官方 CEFR 对照说明 B2 约对应 IELTS 5.5-6.5；公开页主展示取 B2 下限 `IELTS 5.5+`，并标注“等效”以避免误认为院校直接公布 IELTS。

## 验收结果

- UoC 公开 API 共 42 个专业，4 个无 IELTS 专业均已输出 `IELTS 5.5+（等效）`，兜底文案数量为 0。
- 前端详情页抽检 `Bachelor in Creative Multimedia (Honours)` 已显示 `IELTS 5.5+（等效）`，未出现“以院校官方页面为准”。
- `tests/web/format.test.ts` 已覆盖 MUET / CEFR 无 IELTS 场景。
