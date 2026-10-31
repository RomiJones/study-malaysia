# UPSI Doctoral Phase 1-3 Candidate Gap Report

- Retrieved at: 2026-07-08
- Scope: Phase 1-3 only. No database/API/frontend changes.
- Baseline official doctoral count: **109** code-deduped programmes from UPSI IPS LIST OF page (109 raw coded rows).
- Baseline caveat: faculty PHD PDFs contain newer/alternate codes, so this is a current directory baseline, not a conflict-free final import count.

## Coverage
- facultyPdfMatched: 98/109 (89.9%)
- detailPageFetched: 109/109 (100.0%)
- studyModesConfirmedFromDetail: 109/109 (100.0%)
- durationInternationalParsed: 109/109 (100.0%)
- feeCategoryMapped: 98/109 (89.9%)
- feeCategoryNotMapped: 11/109 (10.1%)
- languageProgrammeSpecific: 4/109 (3.7%)
- doctoralKindCounts: {'doctor_of_education': 1, 'doctor_of_psychology': 2, 'doctor_of_philosophy': 106}
- studyModeCounts: {'mixed': 1, 'research': 108}

## Official Source Conflicts

### Directory codes not directly matched in 2025 faculty PHD PDFs
- `PT054` DOCTOR OF PHILOSOPHY (ENVIRONMENTAL BIOTECHNOLOGY): keep as LIST OF baseline; faculty/code cross-verification pending or caveated.
- `PT056` DOCTOR OF PHILOSOPHY (APPLIED STATISTICS): keep as LIST OF baseline; faculty/code cross-verification pending or caveated.
- `PT150` DOCTOR OF PHILOSOPHY (MULTIMEDIA DESIGN): keep as LIST OF baseline; faculty/code cross-verification pending or caveated.
- `PT151` DOCTOR OF PHILOSOPHY (CREATIVE BRANDING): keep as LIST OF baseline; faculty/code cross-verification pending or caveated.
- `PT152` DOCTOR OF PHILOSOPHY (ADVERTISING): keep as LIST OF baseline; faculty/code cross-verification pending or caveated.
- `PT153` DOCTOR OF PHILOSOPHY (INFORMATION DESIGN): keep as LIST OF baseline; faculty/code cross-verification pending or caveated.
- `PT154` DOCTOR OF PHILOSOPHY (INSTRUCTIONAL MEDIA): keep as LIST OF baseline; faculty/code cross-verification pending or caveated.
- `PT155` DOCTOR OF PHILOSOPHY (NEW MEDIA): keep as LIST OF baseline; faculty/code cross-verification pending or caveated.
- `PT156` DOCTOR OF PHILOSOPHY (DIGITAL GAMES): keep as LIST OF baseline; faculty/code cross-verification pending or caveated.
- `PT157` DOCTOR OF PHILOSOPHY (GAME-BASED-LEARNING): keep as LIST OF baseline; faculty/code cross-verification pending or caveated.
- `PT167` DOCTOR OF PHILOSOPHY (CREATIVE STUDIES): keep as LIST OF baseline; faculty/code cross-verification pending or caveated.

### Faculty PHD PDF codes not present in current LIST OF baseline
- `PT186`
- `PT187`
- `PT189`
- `PT190`
- `PT191`
- `PT192`
- `PT193`
- `PT194`
- `PT195`
- `PT196`
- `PT197`
- `PT198`
- `PT199`
- `PT201`
- `PT203`
- `PT204`
- `PT205`
- `PT206`
- `PT207`
- `PT208`
- `PT209`
- `PT210`
- `PT211`

### Known code/version caveats
- FBK 2025/09 PHD PDF introduces newer PT20x codes while current LIST OF still contains older FBK codes such as `PT139`, `PT162`, `PT165`, `PT177`, `PT178`, `PT184`, `PT185`, `PT188`.
- FSLIK 2025/05 PHD PDF lists newer creative/media codes `PT190`-`PT197` and `PT201`, while current LIST OF still contains older `PT150`-`PT157` and `PT167` detail URLs.
- `PJ01`/`PJ02` are Doctor of Psychology programmes; they are not assigned Doctor of Philosophy fee categories without an explicit official fee row.

## Fee Mapping Gaps
- `PJ01` DOCTOR OF PSYCHOLOGY (CLINICAL PSYCHOLOGY): Official 2026 international fee PDF lists Doctor of Philosophy and Doctor of Education tables, but no Doctor of Psychology table; PhD fee is not applied to PJ programmes.
- `PJ02` DOCTOR OF PSYCHOLOGY (CLINICAL NEUROPSYCHOLOGY): Official 2026 international fee PDF lists Doctor of Philosophy and Doctor of Education tables, but no Doctor of Psychology table; PhD fee is not applied to PJ programmes.
- `PT150` DOCTOR OF PHILOSOPHY (MULTIMEDIA DESIGN): No exact official fee category mapping under the strict fee-only rule.
- `PT151` DOCTOR OF PHILOSOPHY (CREATIVE BRANDING): No exact official fee category mapping under the strict fee-only rule.
- `PT152` DOCTOR OF PHILOSOPHY (ADVERTISING): No exact official fee category mapping under the strict fee-only rule.
- `PT153` DOCTOR OF PHILOSOPHY (INFORMATION DESIGN): No exact official fee category mapping under the strict fee-only rule.
- `PT154` DOCTOR OF PHILOSOPHY (INSTRUCTIONAL MEDIA): No exact official fee category mapping under the strict fee-only rule.
- `PT155` DOCTOR OF PHILOSOPHY (NEW MEDIA): No exact official fee category mapping under the strict fee-only rule.
- `PT156` DOCTOR OF PHILOSOPHY (DIGITAL GAMES): No exact official fee category mapping under the strict fee-only rule.
- `PT157` DOCTOR OF PHILOSOPHY (GAME-BASED-LEARNING): No exact official fee category mapping under the strict fee-only rule.
- `PT167` DOCTOR OF PHILOSOPHY (CREATIVE STUDIES): No exact official fee category mapping under the strict fee-only rule.

## Language Requirement
- General UPSI doctorate international rule: IELTS 5.5 or TOEFL 500 from IPS Requirement page.
- Programme-specific higher requirement mapped only where official special-requirement PDF text was explicit: `PT003`, `PT165`, `PT017R`, `PT140`.

## Candidate Status
- `safeToImport=false` globally and per programme.
- No DB/API/frontend changes were made.
- Before Gate 1: reconcile official directory vs faculty PHD PDF code conflicts, confirm Doctor of Psychology international fee source, and decide whether to keep old LIST OF codes or adopt newer faculty PDF codes.

## Source URLs
- [UPSI IPS LIST OF](https://ips.upsi.edu.my/list-of/)
- [UPSI IPS Requirement](https://ips.upsi.edu.my/future-students/requirement/)
- [UPSI IPS Tuition Fees](https://ips.upsi.edu.my/home/information/tuition-fees/)
- [International doctoral fees Mac 2026](https://ips.upsi.edu.my/wp-content/uploads/2025/05/Terkini_Kadar-Yuran-Pelajar-Antarabangsa_MAC-2026-INTAKE.pdf)
- [Fee category image](https://ips.upsi.edu.my/wp-content/uploads/2020/09/Kategori-Yuran.png)
- [FAKULTI-BAHASA-DAN-KOMUNIKASI-251-PHD.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/FAKULTI-BAHASA-DAN-KOMUNIKASI-251-PHD.pdf)
- [FAKULTI-BAHASA-DAN-KOMUNIKASI-PHD-UPDATED-3925.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/09/FAKULTI-BAHASA-DAN-KOMUNIKASI-PHD-UPDATED-3925.pdf)
- [FAKULTI-KOMPUTERAN-DAN-META-TEKNOLOGI-251-PHD.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/FAKULTI-KOMPUTERAN-DAN-META-TEKNOLOGI-251-PHD.pdf)
- [FAKULTI-MUZIK-DAN-SENI-PERSEMBAHAN-251-PHD.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/FAKULTI-MUZIK-DAN-SENI-PERSEMBAHAN-251-PHD.pdf)
- [FAKULTI-PEMBANGUNAN-MANUSIA-251-PHD.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/FAKULTI-PEMBANGUNAN-MANUSIA-251-PHD.pdf)
- [FPM-PHD251.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/FPM-PHD251.pdf)
- [FAKULTI-PENGURUSAN-DAN-EKONOMI-251-PHD.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/FAKULTI-PENGURUSAN-DAN-EKONOMI-251-PHD.pdf)
- [FAKULTI-SAINS-DAN-MATEMATIK-251-PHD.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/FAKULTI-SAINS-DAN-MATEMATIK-251-PHD.pdf)
- [FAKULTI-SAINS-KEMANUSIAAN-251-PHD.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/FAKULTI-SAINS-KEMANUSIAAN-251-PHD.pdf)
- [FAKULTI-SAINS-SUKAN-DAN-KEJURULATIHAN-251-PHD.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/FAKULTI-SAINS-SUKAN-DAN-KEJURULATIHAN-251-PHD.pdf)
- [FAKULTI-SENI-KELESTARIAN-DAN-INDUSTRI-KREATIF-251-PHD.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/FAKULTI-SENI-KELESTARIAN-DAN-INDUSTRI-KREATIF-251-PHD.pdf)
- [FSLIK-PHD251.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/FSLIK-PHD251.pdf)
- [FAKULTI-TEKNIKAL-DAN-VOKASIONAL-251-PHD.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/FAKULTI-TEKNIKAL-DAN-VOKASIONAL-251-PHD.pdf)
- [INSTITUT-PERADABAN-MELAYU-251-PHD.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/INSTITUT-PERADABAN-MELAYU-251-PHD.pdf)
- [PUSAT-PENYELIDIKAN-DAN-PERKEMBANGAN-AWAL-KANAK-KANAK-251-PHD.pdf](https://ips.upsi.edu.my/wp-content/uploads/2025/05/PUSAT-PENYELIDIKAN-DAN-PERKEMBANGAN-AWAL-KANAK-KANAK-251-PHD.pdf)
