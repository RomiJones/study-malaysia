# UPSI Master Phase 1-3 Candidate Gap Report

- Retrieved at: 2026-07-08
- Scope: Phase 1-3 only. No database/API/frontend changes.
- Baseline official master count: **140** code-deduped programmes from UPSI IPS LIST OF page (141 raw coded rows).
- Baseline caveat: faculty master PDFs contain newer/alternate codes, so this is a current directory baseline, not a conflict-free final import count.

## Coverage
- facultyPdfMatched: 135/140 (96.4%)
- detailPageFetched: 140/140 (100.0%)
- studyModesConfirmedFromDetail: 140/140 (100.0%)
- durationInternationalParsed: 140/140 (100.0%)
- feeCategoryMapped: 138/140 (98.6%)
- feeCategoryBlocked: 1/140 (0.7%)
- languageProgrammeSpecific: 3/140 (2.1%)

## Official Source Conflicts

### Directory codes not directly matched in 2025 faculty master PDFs
- `MJ01` MASTER OF PSYCHOLOGY (CLINICAL): keep as LIST OF baseline; faculty/code cross-verification pending or caveated.
- `MT022` MASTER OF EDUCATION (GUIDANCE AND COUNSELING): keep as LIST OF baseline; faculty/code cross-verification pending or caveated.
- `MT064` MASTER OF SCIENCE (ENVIRONMENTAL BIOTECHNOLOGY): keep as LIST OF baseline; faculty/code cross-verification pending or caveated.
- `MT071` MASTER OF SCIENCE (APPLIED STATISTICS): keep as LIST OF baseline; faculty/code cross-verification pending or caveated.
- `MT138` MASTER OF BUSINESS ADMINISTRATION (BUSINESS ADMINISTRATION): keep as LIST OF baseline; faculty/code cross-verification pending or caveated.

### Faculty PDF codes not present in current LIST OF baseline
- `MJ02`
- `MT140`
- `MT191`
- `MT193`
- `MT194`
- `MT195`
- `MT200`
- `MT206`
- `MT208`
- `MT209`
- `MT210`
- `MT211`
- `MT212`
- `MT213`
- `MT214`
- `MT216`
- `MT218`
- `MT219`

### Known code/version caveats
- `MT196` appears twice in the official LIST OF page; the draft keeps one code and records both URLs.
- `MJ01` appears in current LIST OF, while the 2025 Faculty of Human Development master PDF lists the clinical psychology joint degree as `MJ02`; tuition remains unmapped for `MJ01` until UPSI code alignment is resolved.
- FBK 2025/09 master PDF introduces updated Master of Art codes (`MT208`, `MT209`, `MT210`, `MT211`, `MT212`, `MT213`, `MT214`, `MT216`, `MT218`, `MT219`) while current LIST OF still contains older FBK detail URLs/codes. This should be reconciled before import.

## Fee Mapping Gaps
- `MT199` MASTER OF EDUCATION (DATA SCIENCE): Faculty of Science and Mathematics programme is not listed in the official fee-category image; do not assign tuition until UPSI confirms category.
- `MJ01` Master of Psychology (Clinical): code conflict `MJ01` vs `MJ02`; do not assign tuition until official code/faculty fee category is reconciled.
- `MT187` is mapped to Non Science & Technical by faculty category, but the programme-specific clinical mental health fee PDF on the tuition page extracts as local-student only; keep this caveat visible in review.
- Mode B/new-programmes fee PDF gives RM23,000 for international students but does not provide a code-to-programme mapping; recorded as source only, not auto-applied.

## Language Requirement
- General UPSI postgraduate international rule: IELTS 5.5 or TOEFL 500 from IPS Requirement page.
- Programme-specific higher requirement mapped only where official special-requirement PDF text was explicit: `MT003`, `MT161`, `MT017R`.

## Candidate Status
- `safeToImport=false` globally and per programme.
- No DB/API/frontend changes were made.
- Before Gate 1: reconcile official directory vs faculty PDF code conflicts, confirm `MT199` fee category, resolve `MJ01/MJ02`, and decide how to treat FBK 2025/09 recoded programmes.

## Source URLs
- [UPSI IPS LIST OF](https://ips.upsi.edu.my/list-of/)
- [UPSI IPS Requirement](https://ips.upsi.edu.my/future-students/requirement/)
- [UPSI IPS Tuition Fees](https://ips.upsi.edu.my/home/information/tuition-fees/)
- [International master fees Mac 2026](https://ips.upsi.edu.my/wp-content/uploads/2025/05/Terkini_Kadar-Yuran-Pelajar-Antarabangsa_MAC-2026-INTAKE.pdf)
- [Fee category image](https://ips.upsi.edu.my/wp-content/uploads/2020/09/Kategori-Yuran.png)
- [MT022C](https://ips.upsi.edu.my/wp-content/uploads/2022/04/TUITION-FEES-FOR-MASTER-OF-EDUCATION-GC-International_.pdf)
- [MT187_local_only_gap](https://ips.upsi.edu.my/wp-content/uploads/2023/11/fee-master-klinikal_.pdf)
- [modeB_newProgrammes_no_code_mapping](https://ips.upsi.edu.my/wp-content/uploads/2025/04/FINAL-EDITED-V2-18032025_TUITION-FEES-FOR-MASTER-MODE-B_.pdf)
- [FAKULTI-BAHASA-DAN-KOMUNIKASI-251-MASTER.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/FAKULTI-BAHASA-DAN-KOMUNIKASI-251-MASTER.pdf)
- [FAKULTI-BAHASA-DAN-KOMUNIKASI-MASTER-UPDATED-3925.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/09/FAKULTI-BAHASA-DAN-KOMUNIKASI-MASTER-UPDATED-3925.pdf)
- [FAKULTI-KOMPUTERAN-DAN-META-TEKNOLOGI-251-MASTER.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/FAKULTI-KOMPUTERAN-DAN-META-TEKNOLOGI-251-MASTER.pdf)
- [FAKULTI-MUZIK-DAN-SENI-PERSEMBAHAN-251-MASTER.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/FAKULTI-MUZIK-DAN-SENI-PERSEMBAHAN-251-MASTER.pdf)
- [FAKULTI-PEMBANGUNAN-MANUSIA-251-MASTER.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/FAKULTI-PEMBANGUNAN-MANUSIA-251-MASTER.pdf)
- [FAKULTI-PENGURUSAN-DAN-EKONOMI-251-MASTER.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/FAKULTI-PENGURUSAN-DAN-EKONOMI-251-MASTER.pdf)
- [FAKULTI-SAINS-DAN-MATEMATIK-251-MASTER.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/FAKULTI-SAINS-DAN-MATEMATIK-251-MASTER.pdf)
- [FAKULTI-SAINS-KEMANUSIAAN-251-MASTER.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/FAKULTI-SAINS-KEMANUSIAAN-251-MASTER.pdf)
- [FAKULTI-SAINS-SUKAN-DAN-KEJURULATIHAN-251-MASTER.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/FAKULTI-SAINS-SUKAN-DAN-KEJURULATIHAN-251-MASTER.pdf)
- [FAKULTI-SENI-KELESTARIAN-DAN-INDUSTRI-KREATIF-251-MASTER.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/FAKULTI-SENI-KELESTARIAN-DAN-INDUSTRI-KREATIF-251-MASTER.pdf)
- [FAKULTI-TEKNIKAL-DAN-VOKASIONAL-251-MASTER.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/FAKULTI-TEKNIKAL-DAN-VOKASIONAL-251-MASTER.pdf)
- [INSTITUT-PERADABAN-MELAYU-251-MASTER.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/INSTITUT-PERADABAN-MELAYU-251-MASTER.pdf)
- [PUSAT-PENYELIDIKAN-DAN-PERKEMBANGAN-AWAL-KANAK-KANAK-251-MASTER.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/PUSAT-PENYELIDIKAN-DAN-PERKEMBANGAN-AWAL-KANAK-KANAK-251-MASTER.pdf)
