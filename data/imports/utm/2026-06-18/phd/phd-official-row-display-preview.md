# UTM 博士专业官方行整理预览

- 预览目的：先展示效果，不写库、不发布、不把去重口径固化为最终展示。
- 范围：Universiti Teknologi Malaysia / PhD / international / academicSession 2026/2027。
- 数据来源：`data/imports/utm/2026-06-18/phd/skill-workflow-audit/04_official_row_disposal.json` 与候选集。
- 当前事实：官方博士目录出现行 62；费用页-only review evidence 1；候选 canonical 55。

## 方案 A：官方出现行原样展示

这个方案把每个官方目录出现行都展示出来，不先折叠 DPP。优点是最贴近官方页面出现形态；缺点是 DPP 会在多个学院重复出现，用户可能误以为是多个不同博士。

| # | 官方行 | 学院/来源 | 官方英文名 | 当前处置 | 官方链接 |
|---:|---|---|---|---|---|
| 1 | utm-phd-official-row-001 | Engineering Education & Generic Programmes | Doctor of Philosophy (Generic) | 候选 UTM-PHD-001 | https://admission.utm.my/int-postgraduate-school-of-biomedical-engineering-health-science/ |
| 2 | utm-phd-official-row-002 | Engineering Education & Generic Programmes | Doctor of Philosophy (Engineering Education) | 候选 UTM-PHD-002 | https://admission.utm.my/int-postgraduate-school-of-biomedical-engineering-health-science/ |
| 3 | utm-phd-official-row-003 | Faculty of Civil Engineering | Doctor of Engineering Specialization : Construction Technology and Management | 候选 UTM-PHD-003 | https://admission.utm.my/int-postgraduate-school-of-civil-engineering/ |
| 4 | utm-phd-official-row-004 | Faculty of Civil Engineering | Doctor of Philosophy | 候选 UTM-PHD-004 | https://admission.utm.my/int-postgraduate-school-of-civil-engineering/ |
| 5 | utm-phd-official-row-005 | Faculty of Civil Engineering | Doctor of Professional Practice (DPP) | 候选 UTM-PHD-005 | https://admission.utm.my/int-postgraduate-school-of-civil-engineering/ |
| 6 | utm-phd-official-row-006 | Faculty of Chemical and Energy Engineering | Doctor of Engineering Specialization : Process Plant Management | 候选 UTM-PHD-006 | https://admission.utm.my/int-postgraduate-school-of-chemical-energy-engineering/ |
| 7 | utm-phd-official-row-007 | Faculty of Chemical and Energy Engineering | Doctor of Philosophy Field of Research : Chemical Engineering | 候选 UTM-PHD-007 | https://admission.utm.my/int-postgraduate-school-of-chemical-energy-engineering/ |
| 8 | utm-phd-official-row-008 | Faculty of Chemical and Energy Engineering | Doctor of Philosophy Field of Research : Bioprocess Engineering | 候选 UTM-PHD-008 | https://admission.utm.my/int-postgraduate-school-of-chemical-energy-engineering/ |
| 9 | utm-phd-official-row-009 | Faculty of Chemical and Energy Engineering | Doctor of Philosophy Field of Research : Gas Engineering | 候选 UTM-PHD-009 | https://admission.utm.my/int-postgraduate-school-of-chemical-energy-engineering/ |
| 10 | utm-phd-official-row-010 | Faculty of Chemical and Energy Engineering | Doctor of Philosophy Field of Research : Petroleum Engineering | 候选 UTM-PHD-010 | https://admission.utm.my/int-postgraduate-school-of-chemical-energy-engineering/ |
| 11 | utm-phd-official-row-011 | Faculty of Chemical and Energy Engineering | Doctor of Philosophy Field of Research : Polymer Engineering | 候选 UTM-PHD-011 | https://admission.utm.my/int-postgraduate-school-of-chemical-energy-engineering/ |
| 12 | utm-phd-official-row-012 | Faculty of Chemical and Energy Engineering | Doctor of Philosophy Field of Research : Environmental Engineering | 候选 UTM-PHD-012 | https://admission.utm.my/int-postgraduate-school-of-chemical-energy-engineering/ |
| 13 | utm-phd-official-row-013 | Faculty of Chemical and Energy Engineering | Doctor of Professional Practice (DPP) | 重复，归入 UTM-PHD-005 | https://admission.utm.my/int-postgraduate-school-of-chemical-energy-engineering/ |
| 14 | utm-phd-official-row-014 | Faculty of Electrical Engineering | Doctor of Philosophy Field of Research : Biomedical Engineering | 候选 UTM-PHD-013 | https://admission.utm.my/int-postgraduate-school-of-electrical-engineering/ |
| 15 | utm-phd-official-row-015 | Faculty of Electrical Engineering | Doctor of Philosophy Field of Research : Electrical Engineering | 候选 UTM-PHD-014 | https://admission.utm.my/int-postgraduate-school-of-electrical-engineering/ |
| 16 | utm-phd-official-row-016 | Faculty of Electrical Engineering | Doctor of Philosophy Field of Research : Health Science | 候选 UTM-PHD-015 | https://admission.utm.my/int-postgraduate-school-of-electrical-engineering/ |
| 17 | utm-phd-official-row-017 | Faculty of Electrical Engineering | Doctor of Professional Practice (DPP) | 重复，归入 UTM-PHD-005 | https://admission.utm.my/int-postgraduate-school-of-electrical-engineering/ |
| 18 | utm-phd-official-row-018 | Faculty of Mechanical Engineering | Doctor of Philosophy Field of Research : Mechanical Engineering | 候选 UTM-PHD-016 | https://admission.utm.my/int-postgraduate-school-of-mechanical-engineering/ |
| 19 | utm-phd-official-row-019 | Faculty of Mechanical Engineering | Doctor of Professional Practice (DPP) | 重复，归入 UTM-PHD-005 | https://admission.utm.my/int-postgraduate-school-of-mechanical-engineering/ |
| 20 | utm-phd-official-row-020 | Faculty of Social Science and Humanities | Doctor of Philosophy | 候选 UTM-PHD-017 | https://admission.utm.my/int-faculty-of-social-science-and-humanities/ |
| 21 | utm-phd-official-row-021 | Faculty of Social Science and Humanities | Doctor of Philosophy Field of Research : Policy Studies | 候选 UTM-PHD-018 | https://admission.utm.my/int-faculty-of-social-science-and-humanities/ |
| 22 | utm-phd-official-row-022 | School of HRD and Psychology | Doctor of Philosophy (Generic) | 候选 UTM-PHD-019 | https://admission.utm.my/int-postgraduate-school-of-hrd-psycohology/ |
| 23 | utm-phd-official-row-023 | Islamic Civilization Academy | Doctor of Philosophy (Generic) | 候选 UTM-PHD-020 | https://admission.utm.my/int-postgraduate-islamic-civilisation-academic/ |
| 24 | utm-phd-official-row-024 | Islamic Civilization Academy | Doctor of Philosophy Field of Research : Fiqh Science and Technology | 候选 UTM-PHD-021 | https://admission.utm.my/int-postgraduate-islamic-civilisation-academic/ |
| 25 | utm-phd-official-row-025 | Language Academy | Doctor of Philosophy (Generic) | 候选 UTM-PHD-022 | https://admission.utm.my/int-postgraduate-language-academy/ |
| 26 | utm-phd-official-row-026 | Faculty of Educational Sciences and Technology | Doctor in Education (EdD) | 候选 UTM-PHD-023 | https://admission.utm.my/int-postgraduate-school-of-education/ |
| 27 | utm-phd-official-row-027 | Faculty of Educational Sciences and Technology | Doctor of Philosophy Field of Research : Chemistry Education | 候选 UTM-PHD-024 | https://admission.utm.my/int-postgraduate-school-of-education/ |
| 28 | utm-phd-official-row-028 | Faculty of Educational Sciences and Technology | Doctor of Philosophy Field of Research : Curriculum and Instruction | 候选 UTM-PHD-025 | https://admission.utm.my/int-postgraduate-school-of-education/ |
| 29 | utm-phd-official-row-029 | Faculty of Educational Sciences and Technology | Doctor of Philosophy Field of Research : Education and Development | 候选 UTM-PHD-026 | https://admission.utm.my/int-postgraduate-school-of-education/ |
| 30 | utm-phd-official-row-030 | Faculty of Educational Sciences and Technology | Doctor of Philosophy Field of Research : Educational Psychology | 候选 UTM-PHD-027 | https://admission.utm.my/int-postgraduate-school-of-education/ |
| 31 | utm-phd-official-row-031 | Faculty of Educational Sciences and Technology | Doctor of Philosophy Field of Research : Educational Technology | 候选 UTM-PHD-028 | https://admission.utm.my/int-postgraduate-school-of-education/ |
| 32 | utm-phd-official-row-032 | Faculty of Educational Sciences and Technology | Doctor of Philosophy Field of Research : Guidance and Counselling in Education | 候选 UTM-PHD-029 | https://admission.utm.my/int-postgraduate-school-of-education/ |
| 33 | utm-phd-official-row-033 | Faculty of Educational Sciences and Technology | Doctor of Philosophy Field of Research : Management and Administration in Education | 候选 UTM-PHD-030 | https://admission.utm.my/int-postgraduate-school-of-education/ |
| 34 | utm-phd-official-row-034 | Faculty of Educational Sciences and Technology | Doctor of Philosophy Field of Research : Mathematics Education | 候选 UTM-PHD-031 | https://admission.utm.my/int-postgraduate-school-of-education/ |
| 35 | utm-phd-official-row-035 | Faculty of Educational Sciences and Technology | Doctor of Philosophy Field of Research : Measurement and Evaluation in Education | 候选 UTM-PHD-032 | https://admission.utm.my/int-postgraduate-school-of-education/ |
| 36 | utm-phd-official-row-036 | Faculty of Educational Sciences and Technology | Doctor of Philosophy Field of Research : Multimedia in Education | 候选 UTM-PHD-033 | https://admission.utm.my/int-postgraduate-school-of-education/ |
| 37 | utm-phd-official-row-037 | Faculty of Educational Sciences and Technology | Doctor of Philosophy Field of Research : Physical Education and Sports Science | 候选 UTM-PHD-034 | https://admission.utm.my/int-postgraduate-school-of-education/ |
| 38 | utm-phd-official-row-038 | Faculty of Educational Sciences and Technology | Doctor of Philosophy Field of Research : Physics Education | 候选 UTM-PHD-035 | https://admission.utm.my/int-postgraduate-school-of-education/ |
| 39 | utm-phd-official-row-039 | Faculty of Educational Sciences and Technology | Doctor of Philosophy Field of Research : Teaching English as a Second Language (TESL) | 候选 UTM-PHD-036 | https://admission.utm.my/int-postgraduate-school-of-education/ |
| 40 | utm-phd-official-row-040 | Faculty of Educational Sciences and Technology | Doctor of Philosophy Field of Research : Technical and Vocational Education | 候选 UTM-PHD-037 | https://admission.utm.my/int-postgraduate-school-of-education/ |
| 41 | utm-phd-official-row-041 | Faculty of Educational Sciences and Technology | Doctor of Philosophy Field of Research : Online Learning | 候选 UTM-PHD-038 | https://admission.utm.my/int-postgraduate-school-of-education/ |
| 42 | utm-phd-official-row-042 | Faculty of Educational Sciences and Technology | Doctor of Philosophy Field of Research : Early Childhood Education | 候选 UTM-PHD-039 | https://admission.utm.my/int-postgraduate-school-of-education/ |
| 43 | utm-phd-official-row-043 | Faculty of Built Environment and Surveying | Doctor of Philosophy Field of Research | 候选 UTM-PHD-040 | https://admission.utm.my/int-faculty-of-built-environment-surveying/ |
| 44 | utm-phd-official-row-044 | Faculty of Built Environment and Surveying | Doctor of Professional Practice (DPP) | 重复，归入 UTM-PHD-005 | https://admission.utm.my/int-faculty-of-built-environment-surveying/ |
| 45 | utm-phd-official-row-045 | Faculty of Computing | Doctor of Philosophy Field of Research : Software Engineering | 候选 UTM-PHD-041 | https://admission.utm.my/int-postgraduate-school-of-computing/ |
| 46 | utm-phd-official-row-046 | Faculty of Computing | Doctor of Philosophy Field of Research : Computer Science | 候选 UTM-PHD-042 | https://admission.utm.my/int-postgraduate-school-of-computing/ |
| 47 | utm-phd-official-row-047 | Faculty of Computing | Doctor of Philosophy Field of Research : Informatics Engineering | 候选 UTM-PHD-043 | https://admission.utm.my/int-postgraduate-school-of-computing/ |
| 48 | utm-phd-official-row-048 | Faculty of Computing | Doctor of Professional Practice (DPP) | 重复，归入 UTM-PHD-005 | https://admission.utm.my/int-postgraduate-school-of-computing/ |
| 49 | utm-phd-official-row-049 | Faculty of Management | Doctor of Philosophy Field of Research : Management | 候选 UTM-PHD-044 | https://admission.utm.my/int-faculty-of-management/ |
| 50 | utm-phd-official-row-050 | Faculty of Science | Doctor of Philosophy (Generic) | 候选 UTM-PHD-045 | https://admission.utm.my/int-faculty-of-science/ |
| 51 | utm-phd-official-row-051 | Faculty of Science | Doctor of Philosophy Field of Research : Chemistry | 候选 UTM-PHD-046 | https://admission.utm.my/int-faculty-of-science/ |
| 52 | utm-phd-official-row-052 | Faculty of Science | Doctor of Philosophy Field of Research : Physics | 候选 UTM-PHD-047 | https://admission.utm.my/int-faculty-of-science/ |
| 53 | utm-phd-official-row-053 | Faculty of Science | Doctor of Philosophy Field of Research : Mathematics | 候选 UTM-PHD-048 | https://admission.utm.my/int-faculty-of-science/ |
| 54 | utm-phd-official-row-054 | Faculty of Science | Doctor of Philosophy Field of Research : Bioscience | 候选 UTM-PHD-049 | https://admission.utm.my/int-faculty-of-science/ |
| 55 | utm-phd-official-row-055 | Azman Hashim International Business School | Doctor of Business Administration | 候选 UTM-PHD-050 | https://admission.utm.my/int-azman-hashim-international-business-school/ |
| 56 | utm-phd-official-row-056 | Azman Hashim International Business School | Doctor of Philosophy (Generic) | 候选 UTM-PHD-051 | https://admission.utm.my/int-azman-hashim-international-business-school/ |
| 57 | utm-phd-official-row-057 | Faculty of Artificial Intelligence | Doctor of Engineering in Engineering Business Management | 候选 UTM-PHD-052 | https://admission.utm.my/int-razak-faculty-of-technology-informatics/ |
| 58 | utm-phd-official-row-058 | Faculty of Artificial Intelligence | Doctor of Philosophy (Generic) | 候选 UTM-PHD-053 | https://admission.utm.my/int-razak-faculty-of-technology-informatics/ |
| 59 | utm-phd-official-row-059 | Faculty of Artificial Intelligence | Doctor of Professional Practice (DPP) | 重复，归入 UTM-PHD-005 | https://admission.utm.my/int-razak-faculty-of-technology-informatics/ |
| 60 | utm-phd-official-row-060 | Malaysia-Japan International Institute of Technology | Doctor of Philosophy (Generic) | 候选 UTM-PHD-054 | https://admission.utm.my/int-malaysia-japan-international-institute-of-technology/ |
| 61 | utm-phd-official-row-061 | Malaysia-Japan International Institute of Technology | Doctor of Philosophy Field of Research : Engineering Education | 候选 UTM-PHD-055 | https://admission.utm.my/int-malaysia-japan-international-institute-of-technology/ |
| 62 | utm-phd-official-row-062 | Malaysia-Japan International Institute of Technology | Doctor of Professional Practice (DPP) | 重复，归入 UTM-PHD-005 | https://admission.utm.my/int-malaysia-japan-international-institute-of-technology/ |

## 方案 B：按 StudyMY 候选分组展示

这个方案保留 55 个候选专业，但在 DPP 这类跨学院项目下展示所有官方出现学院，避免静默删除。

| 候选代码 | 官方英文名 | 展示学院/归属 | 模式 | 学费状态 | 官方出现行 |
|---|---|---|---|---|---|
| UTM-PHD-001 | Doctor of Philosophy (Generic) | Engineering Education & Generic Programmes | Research | verified-official-total | utm-phd-official-row-001: Engineering Education & Generic Programmes |
| UTM-PHD-002 | Doctor of Philosophy (Engineering Education) | Engineering Education & Generic Programmes | Research | verified-official-total | utm-phd-official-row-002: Engineering Education & Generic Programmes |
| UTM-PHD-003 | Doctor of Engineering Specialization : Construction Technology and Management | Faculty of Civil Engineering | Mixed Mode | verified-official-total | utm-phd-official-row-003: Faculty of Civil Engineering |
| UTM-PHD-004 | Doctor of Philosophy | Faculty of Civil Engineering | Research | verified-official-total | utm-phd-official-row-004: Faculty of Civil Engineering |
| UTM-PHD-005 | Doctor of Professional Practice (DPP) | Cross-faculty ODL collaboration | Mixed mode / Open and Distance Learning | official-rate-only | utm-phd-official-row-005: Faculty of Civil Engineering<br>utm-phd-official-row-013: Faculty of Chemical and Energy Engineering (重复出现)<br>utm-phd-official-row-017: Faculty of Electrical Engineering (重复出现)<br>utm-phd-official-row-019: Faculty of Mechanical Engineering (重复出现)<br>utm-phd-official-row-044: Faculty of Built Environment and Surveying (重复出现)<br>utm-phd-official-row-048: Faculty of Computing (重复出现)<br>utm-phd-official-row-059: Faculty of Artificial Intelligence (重复出现)<br>utm-phd-official-row-062: Malaysia-Japan International Institute of Technology (重复出现) |
| UTM-PHD-006 | Doctor of Engineering Specialization : Process Plant Management | Faculty of Chemical and Energy Engineering | Mixed Mode | verified-official-total | utm-phd-official-row-006: Faculty of Chemical and Energy Engineering |
| UTM-PHD-007 | Doctor of Philosophy Field of Research : Chemical Engineering | Faculty of Chemical and Energy Engineering | Research | verified-official-total | utm-phd-official-row-007: Faculty of Chemical and Energy Engineering |
| UTM-PHD-008 | Doctor of Philosophy Field of Research : Bioprocess Engineering | Faculty of Chemical and Energy Engineering | Research | verified-official-total | utm-phd-official-row-008: Faculty of Chemical and Energy Engineering |
| UTM-PHD-009 | Doctor of Philosophy Field of Research : Gas Engineering | Faculty of Chemical and Energy Engineering | Research | verified-official-total | utm-phd-official-row-009: Faculty of Chemical and Energy Engineering |
| UTM-PHD-010 | Doctor of Philosophy Field of Research : Petroleum Engineering | Faculty of Chemical and Energy Engineering | Research | verified-official-total | utm-phd-official-row-010: Faculty of Chemical and Energy Engineering |
| UTM-PHD-011 | Doctor of Philosophy Field of Research : Polymer Engineering | Faculty of Chemical and Energy Engineering | Research | verified-official-total | utm-phd-official-row-011: Faculty of Chemical and Energy Engineering |
| UTM-PHD-012 | Doctor of Philosophy Field of Research : Environmental Engineering | Faculty of Chemical and Energy Engineering | Research | verified-official-total | utm-phd-official-row-012: Faculty of Chemical and Energy Engineering |
| UTM-PHD-013 | Doctor of Philosophy Field of Research : Biomedical Engineering | Faculty of Electrical Engineering | Research | verified-official-total | utm-phd-official-row-014: Faculty of Electrical Engineering |
| UTM-PHD-014 | Doctor of Philosophy Field of Research : Electrical Engineering | Faculty of Electrical Engineering | Research | verified-official-total | utm-phd-official-row-015: Faculty of Electrical Engineering |
| UTM-PHD-015 | Doctor of Philosophy Field of Research : Health Science | Faculty of Electrical Engineering | Research | verified-official-total | utm-phd-official-row-016: Faculty of Electrical Engineering |
| UTM-PHD-016 | Doctor of Philosophy Field of Research : Mechanical Engineering | Faculty of Mechanical Engineering | Research | verified-official-total | utm-phd-official-row-018: Faculty of Mechanical Engineering |
| UTM-PHD-017 | Doctor of Philosophy | Faculty of Social Science and Humanities | Research | verified-official-total | utm-phd-official-row-020: Faculty of Social Science and Humanities |
| UTM-PHD-018 | Doctor of Philosophy Field of Research : Policy Studies | Faculty of Social Science and Humanities | Research | verified-official-total | utm-phd-official-row-021: Faculty of Social Science and Humanities |
| UTM-PHD-019 | Doctor of Philosophy (Generic) | School of HRD and Psychology | Research | verified-official-total | utm-phd-official-row-022: School of HRD and Psychology |
| UTM-PHD-020 | Doctor of Philosophy (Generic) | Islamic Civilization Academy | Research | verified-official-total | utm-phd-official-row-023: Islamic Civilization Academy |
| UTM-PHD-021 | Doctor of Philosophy Field of Research : Fiqh Science and Technology | Islamic Civilization Academy | Research | verified-official-total | utm-phd-official-row-024: Islamic Civilization Academy |
| UTM-PHD-022 | Doctor of Philosophy (Generic) | Language Academy | Research | verified-official-total | utm-phd-official-row-025: Language Academy |
| UTM-PHD-023 | Doctor in Education (EdD) | Faculty of Educational Sciences and Technology | Open and Distance Learning | verified-official-total | utm-phd-official-row-026: Faculty of Educational Sciences and Technology |
| UTM-PHD-024 | Doctor of Philosophy Field of Research : Chemistry Education | Faculty of Educational Sciences and Technology | Research | verified-official-total | utm-phd-official-row-027: Faculty of Educational Sciences and Technology |
| UTM-PHD-025 | Doctor of Philosophy Field of Research : Curriculum and Instruction | Faculty of Educational Sciences and Technology | Research | verified-official-total | utm-phd-official-row-028: Faculty of Educational Sciences and Technology |
| UTM-PHD-026 | Doctor of Philosophy Field of Research : Education and Development | Faculty of Educational Sciences and Technology | Research | verified-official-total | utm-phd-official-row-029: Faculty of Educational Sciences and Technology |
| UTM-PHD-027 | Doctor of Philosophy Field of Research : Educational Psychology | Faculty of Educational Sciences and Technology | Research | verified-official-total | utm-phd-official-row-030: Faculty of Educational Sciences and Technology |
| UTM-PHD-028 | Doctor of Philosophy Field of Research : Educational Technology | Faculty of Educational Sciences and Technology | Research | verified-official-total | utm-phd-official-row-031: Faculty of Educational Sciences and Technology |
| UTM-PHD-029 | Doctor of Philosophy Field of Research : Guidance and Counselling in Education | Faculty of Educational Sciences and Technology | Research | verified-official-total | utm-phd-official-row-032: Faculty of Educational Sciences and Technology |
| UTM-PHD-030 | Doctor of Philosophy Field of Research : Management and Administration in Education | Faculty of Educational Sciences and Technology | Research | verified-official-total | utm-phd-official-row-033: Faculty of Educational Sciences and Technology |
| UTM-PHD-031 | Doctor of Philosophy Field of Research : Mathematics Education | Faculty of Educational Sciences and Technology | Research | verified-official-total | utm-phd-official-row-034: Faculty of Educational Sciences and Technology |
| UTM-PHD-032 | Doctor of Philosophy Field of Research : Measurement and Evaluation in Education | Faculty of Educational Sciences and Technology | Research | verified-official-total | utm-phd-official-row-035: Faculty of Educational Sciences and Technology |
| UTM-PHD-033 | Doctor of Philosophy Field of Research : Multimedia in Education | Faculty of Educational Sciences and Technology | Research | verified-official-total | utm-phd-official-row-036: Faculty of Educational Sciences and Technology |
| UTM-PHD-034 | Doctor of Philosophy Field of Research : Physical Education and Sports Science | Faculty of Educational Sciences and Technology | Research | verified-official-total | utm-phd-official-row-037: Faculty of Educational Sciences and Technology |
| UTM-PHD-035 | Doctor of Philosophy Field of Research : Physics Education | Faculty of Educational Sciences and Technology | Research | verified-official-total | utm-phd-official-row-038: Faculty of Educational Sciences and Technology |
| UTM-PHD-036 | Doctor of Philosophy Field of Research : Teaching English as a Second Language (TESL) | Faculty of Educational Sciences and Technology | Research | verified-official-total | utm-phd-official-row-039: Faculty of Educational Sciences and Technology |
| UTM-PHD-037 | Doctor of Philosophy Field of Research : Technical and Vocational Education | Faculty of Educational Sciences and Technology | Research | verified-official-total | utm-phd-official-row-040: Faculty of Educational Sciences and Technology |
| UTM-PHD-038 | Doctor of Philosophy Field of Research : Online Learning | Faculty of Educational Sciences and Technology | Research | verified-official-total | utm-phd-official-row-041: Faculty of Educational Sciences and Technology |
| UTM-PHD-039 | Doctor of Philosophy Field of Research : Early Childhood Education | Faculty of Educational Sciences and Technology | Research | verified-official-total | utm-phd-official-row-042: Faculty of Educational Sciences and Technology |
| UTM-PHD-040 | Doctor of Philosophy Field of Research | Faculty of Built Environment and Surveying | Research | verified-official-total | utm-phd-official-row-043: Faculty of Built Environment and Surveying |
| UTM-PHD-041 | Doctor of Philosophy Field of Research : Software Engineering | Faculty of Computing | Research | verified-official-total | utm-phd-official-row-045: Faculty of Computing |
| UTM-PHD-042 | Doctor of Philosophy Field of Research : Computer Science | Faculty of Computing | Research | verified-official-total | utm-phd-official-row-046: Faculty of Computing |
| UTM-PHD-043 | Doctor of Philosophy Field of Research : Informatics Engineering | Faculty of Computing | Research | verified-official-total | utm-phd-official-row-047: Faculty of Computing |
| UTM-PHD-044 | Doctor of Philosophy Field of Research : Management | Faculty of Management | Research | verified-official-total | utm-phd-official-row-049: Faculty of Management |
| UTM-PHD-045 | Doctor of Philosophy (Generic) | Faculty of Science | Research | verified-official-total | utm-phd-official-row-050: Faculty of Science |
| UTM-PHD-046 | Doctor of Philosophy Field of Research : Chemistry | Faculty of Science | Research | verified-official-total | utm-phd-official-row-051: Faculty of Science |
| UTM-PHD-047 | Doctor of Philosophy Field of Research : Physics | Faculty of Science | Research | verified-official-total | utm-phd-official-row-052: Faculty of Science |
| UTM-PHD-048 | Doctor of Philosophy Field of Research : Mathematics | Faculty of Science | Research | verified-official-total | utm-phd-official-row-053: Faculty of Science |
| UTM-PHD-049 | Doctor of Philosophy Field of Research : Bioscience | Faculty of Science | Research | verified-official-total | utm-phd-official-row-054: Faculty of Science |
| UTM-PHD-050 | Doctor of Business Administration | Azman Hashim International Business School | Mixed Mode | verified-official-total | utm-phd-official-row-055: Azman Hashim International Business School |
| UTM-PHD-051 | Doctor of Philosophy (Generic) | Azman Hashim International Business School | Research | verified-official-total | utm-phd-official-row-056: Azman Hashim International Business School |
| UTM-PHD-052 | Doctor of Engineering in Engineering Business Management | Faculty of Artificial Intelligence | Mixed Mode | verified-official-total | utm-phd-official-row-057: Faculty of Artificial Intelligence |
| UTM-PHD-053 | Doctor of Philosophy (Generic) | Faculty of Artificial Intelligence | Research | verified-official-total | utm-phd-official-row-058: Faculty of Artificial Intelligence |
| UTM-PHD-054 | Doctor of Philosophy (Generic) | Malaysia-Japan International Institute of Technology | Research | verified-official-total | utm-phd-official-row-060: Malaysia-Japan International Institute of Technology |
| UTM-PHD-055 | Doctor of Philosophy Field of Research : Engineering Education | Malaysia-Japan International Institute of Technology | Research | verified-official-total | utm-phd-official-row-061: Malaysia-Japan International Institute of Technology |

## 费用页-only review evidence

这类记录不来自当前博士目录，只来自费用页，因此先不进入候选专业，但保留给人工判断。

| 来源行 | 学院 | 名称 | 状态 | 原因 | 官方链接 |
|---|---|---|---|---|---|
| utm-phd-fee-only-doctor-of-software-engineering | Faculty of Artificial Intelligence | Doctor of Software Engineering | needs-review | UTM fee page publishes a named doctoral fee row, but the current collected international doctoral programme directory did not expose a matching programme row. | https://admission.utm.my/fees-pg-inter/ |

## DPP 展示建议

如果采用分组方案，DPP 建议显示为一个跨学院 ODL 博士：`Doctor of Professional Practice (DPP)`，下方列出官方出现学院：Civil Engineering、Chemical and Energy Engineering、Electrical Engineering、Mechanical Engineering、Built Environment and Surveying、Computing、Faculty of Artificial Intelligence、MJIIT。
