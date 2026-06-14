# USM 本硕博官方总量与商用发布审计

## 审计结论

截至 2026-06-14，USM 本科、硕士、博士规范项目数分别为 **63、305、95**，数据库规范总数 **463**，与本次采用的官方标准数量一致。

公开国际申请目录共 **437** 条；另有 **23** 条待审核和 **3** 条明确不适用于国际申请人。非公开记录均保留证据与状态，但不会通过公开 API 或用户端普通列表泄漏。

## 数量分层

| 层级 | 官方目录口径 | 规范数 | 公开 | 待审核 | 国际生不可用 |
| --- | --- | ---: | ---: | ---: | ---: |
| 本科 | 2025/2026 Prospectus；CSV 仅作变化检测 | 63 | 63 | 0 | 0 |
| 硕士 | 动态目录 MASTER 筛选 305 行、255 个详情 URL | 305 | 302 | 2 | 1 |
| 博士 | 动态目录 PHD/DOCTORATE 筛选 95 行、91 个详情 URL | 95 | 72 | 21 | 2 |
| 合计 |  | 463 | 437 | 23 | 3 |

硕士旧版 274 个详情入口只作为历史详情证据。当前动态目录中新增旧目录之外的详情 URL 43 个，并存在多个官方项目身份共享同一详情 URL 的情况，因此规范身份按名称、模式、学位类型、学院、集群和 URL 组合保留，不按 URL 单独去重。

## 博士发布门禁

- 75 条未公布专业级 intake 和 20 条未公布唯一适用国际学费被明确标为“官方未公布”，不再因缺少可选字段自动阻断。
- 20 条 offshore 项目因一般国际申请资格未得到公开材料充分确认，继续保持 `needs-review`。
- DBA 因官方未公布可结构化数字学制，继续保持 `needs-review`。
- 2 条仅限马来西亚申请人的博士项目保持 `not-available-for-international`。
- Doctor of Neuroscience 的官方 3–5 年学制已正确解析。
- 三个研究单位名称变体已与当前官方国际研究费率表对齐。

## 字段与本地化

- 三层级规范记录均保留官方英文名、官方 URL、来源状态、核验日期和证据哈希。
- 四语名称、学院、简介、申请材料及公开说明通过自动化门禁。
- 中文公开项目名中的普通英文残留为 0；USM、RECSAM、DDS 等官方缩写保留。
- 官网未公布字段保持空值或明确“官方未公布”，不套用其它项目数据。
- 学费仅使用官方原始币种；研究型总学费区间由官方每学期费率和官方学制范围计算并保留计算说明。

## 数据库与公开层验证

- 本科规范 63、公开 63、旧记录泄漏 0。
- 硕士规范 305、公开 302、审核 2、国际生不可用 1、旧记录泄漏 0。
- 博士规范 95、公开 72、审核 21、国际生不可用 2、旧记录泄漏 0。
- USM `programCount=437`。
- `officialProfile.catalogStatusSummary` 返回总数 463、公开 437、待审核 23、国际生不可用 3。
- 公开 API 按层级返回本科 63、硕士 302、博士 72，全部为 `ready`。

## 验证命令

- `npm test`
- `npm run build`
- `npm run verify:task040:i18n`
- `npm --workspace @studymy/api run verify:usm:undergraduate:commercial`
- `npm --workspace @studymy/api run verify:usm:master:commercial`
- `npm --workspace @studymy/api run verify:usm:phd:commercial`
- `npm --workspace @studymy/api run start`

结果：全量测试 133 通过、1 跳过；生产构建、四语审计、三个数据库专项验证和生产 API 启动均通过。

## 浏览器验收

页面：`http://127.0.0.1:5173/universities/universiti-sains-malaysia-usm`

- 概览显示本科 63、硕士 305、博士 95、可公开 437、待核准/不开放 26。
- 博士标签显示 72 条公开项目。
- 神经科学博士显示 3 年主摘要、3–5 年官方详情、USD 36,000 总学费、IELTS 5+、申请材料与官方来源链接。
- 教育博士中文名和硕博中文项目名英文残留复验通过。

## 证据哈希

| 文件 | SHA-256 |
| --- | --- |
| `master-current-catalogue.json` | `c02a5464d577b0ab7f4cd1daf677137282e50b3191f71be6fef7fe5773183dd0` |
| `master-official-source.json` | `ee7e131915bc4161aae4eb55fe2e27dabb629af1e1ba3fb08772ef3e0451f190` |
| `master-commercial-candidate.json` | `1190166ad35e31168ac0d2af9503adde893ef1e3febe2bf3e5e3bce1fd550cd9` |
| `phd-current-catalogue.json` | `03be7bc3fadfbb2313e6ddefbdf02457481832041724176bccdd60ad878c9372` |
| `phd-official-source.json` | `9e889a530617c4bfb0b178f38574962e9936fbabd20320b4f6e3fa21ac53b4bc` |
| `phd-candidate.json` | `bb52a58aede370d72c23fa09bd5c792e2cacb95ff23cb60eeea531aca91289a9` |
| `phd-audit.json` | `96c138c1433cb75784559844d3d284b6b44228b9de7955b4b631bf0ccfcc9ae4` |
| `phd-delivery.json` | `29392893bc65f50451470de766536e49f5836968a5ddde94b5b96582c33f4fbd` |

## 回滚与 Notion

每次受控写入前均在 `tmp/backups/` 生成 USM 院校及专业备份。该目录不提交到 Git。

当前会话未连接可写 Notion，真实 Notion 页面未更新；本地中文任务与审计文档已更新。
