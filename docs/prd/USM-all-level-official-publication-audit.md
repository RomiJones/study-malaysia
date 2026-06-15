# USM 本硕博官方总量与商用发布审计

## 审计结论

截至 2026-06-14，USM 本科、硕士、博士规范项目数分别为 **63、305、95**，数据库规范总数 **463**，与本次采用的官方标准数量一致。

公开国际申请目录共 **460** 条；待审核项目已于 2026-06-15 完成终审并归零，另有 **3** 条明确不适用于国际申请人。非公开记录均保留证据与状态，但不会通过公开 API 或用户端普通列表泄漏。

## 数量分层

| 层级 | 官方目录口径 | 规范数 | 公开 | 待审核 | 国际生不可用 |
| --- | --- | ---: | ---: | ---: | ---: |
| 本科 | 2025/2026 Prospectus；CSV 仅作变化检测 | 63 | 63 | 0 | 0 |
| 硕士 | 动态目录 MASTER 筛选 305 行、255 个详情 URL | 305 | 304 | 0 | 1 |
| 博士 | 动态目录 PHD/DOCTORATE 筛选 95 行、91 个详情 URL | 95 | 93 | 0 | 2 |
| 合计 |  | 463 | 460 | 0 | 3 |

硕士旧版 274 个详情入口只作为历史详情证据。当前动态目录中新增旧目录之外的详情 URL 43 个，并存在多个官方项目身份共享同一详情 URL 的情况，因此规范身份按名称、模式、学位类型、学院、集群和 URL 组合保留，不按 URL 单独去重。

## 终审裁决

- 75 条未公布专业级 intake 和 20 条未公布唯一适用国际学费被明确标为“官方未公布”，不再因缺少可选字段自动阻断。
- 20 条 offshore 博士由 USM 官方研究生招生页的境外项目国际学生政策、项目页和国际申请语言要求共同确认，转为 `ready`。
- DBA 由官方项目页和商学院材料确认全日制 3.5–5 年、非全日制 4.5–7 年，转为 `ready`。
- 固体物理国际双学位硕士和先进制造工程与管理硕士经官方项目页复核，转为 `ready`。
- 2 条仅限马来西亚申请人的博士项目保持 `not-available-for-international`。
- 1 条仅限马来西亚申请人的硕士项目保持 `not-available-for-international`。
- Doctor of Neuroscience 的官方 3–5 年学制已正确解析。
- 三个研究单位名称变体已与当前官方国际研究费率表对齐。

## 字段与本地化

- 三层级规范记录均保留官方英文名、官方 URL、来源状态、核验日期和证据哈希。
- 四语名称、学院、简介、申请材料及公开说明通过自动化门禁。
- 中文公开项目名中的普通英文残留为 0；USM、RECSAM、DDS 等官方缩写保留。
- 官网未公布字段保持空值或明确“官方未公布”，不套用其它项目数据。
- 学费仅展示官网明确公布、且能唯一对应项目或方向的标准项目总学费。
- 官网只公布每学期费率而未公布标准项目总额时，不自行乘以学制估算，用户端显示“官方未公布”。
- 延期、超期修读或超过标准学制后产生的额外学费不写入标准项目总学费。
- 同一主项目各方向官方总学费不同时，主项目不展示费用范围，提示申请人按所选方向核对准确官方总额。

## 数据库与公开层验证

- 本科规范 63、公开 63、旧记录泄漏 0。
- 硕士规范 305、公开 304、审核 0、国际生不可用 1、旧记录泄漏 0。
- 博士规范 95、公开 93、审核 0、国际生不可用 2、旧记录泄漏 0。
- USM `programCount=460`。
- `officialProfile.catalogStatusSummary` 返回总数 463、公开 460、待审核 0、国际生不可用 3。
- 公开 API 按层级返回本科 63、硕士 304、博士 93，全部为 `ready`。

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

- 概览显示本科 63、硕士 305、博士 95、可公开 460、国际生不可申请 3。
- 概览费用卡不再汇总最低至最高费用，改为引导用户按专业查看唯一官方标准总学费。
- 博士标签显示 93 条公开项目。
- DBA 显示 3.5 年主摘要、全日制 3.5–5 年/非全日制 4.5–7 年详情、USD 16,200 总学费和官方来源链接。
- 境外博士及仅公布每学期费率的研究型项目明确显示“官方未公布”，未生成估算价格或费用范围。
- 教育博士中文名和硕博中文项目名英文残留复验通过。

## 证据哈希

| 文件 | SHA-256 |
| --- | --- |
| `master-current-catalogue.json` | `c02a5464d577b0ab7f4cd1daf677137282e50b3191f71be6fef7fe5773183dd0` |
| `master-official-source.json` | `ee7e131915bc4161aae4eb55fe2e27dabb629af1e1ba3fb08772ef3e0451f190` |
| `master-commercial-candidate.json` | `670943df0596c0bceaf64274ce32f99ef6c3af349fbab97e36636dc2f7322923` |
| `phd-current-catalogue.json` | `03be7bc3fadfbb2313e6ddefbdf02457481832041724176bccdd60ad878c9372` |
| `phd-official-source.json` | `9e889a530617c4bfb0b178f38574962e9936fbabd20320b4f6e3fa21ac53b4bc` |
| `phd-candidate.json` | `23e80798f4068b51638a175ba4ca27bb1fff556ef521c5b7097548fde8a17e24` |
| `phd-audit.json` | `2ae9dc5c8dfcfe58390c8b2adb986ac83e30db76a2563be60d46a44466d96dd7` |
| `phd-delivery.json` | `166508ff18077cccf89df8375a00a67d341dcb6420e49f73379a79ab067d0620` |

## 回滚与 Notion

每次受控写入前均在 `tmp/backups/` 生成 USM 院校及专业备份。该目录不提交到 Git。

当前会话未连接可写 Notion，真实 Notion 页面未更新；本地中文任务与审计文档已更新。
