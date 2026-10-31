# USM PhD Final Collection

This directory is the 2026-06-17 final audited collection package for USM doctoral programmes.

- Scope: Universiti Sains Malaysia, `level=phd`, international applicants.
- Authorization: `collect`; this package does not write the database.
- Candidate records: 95.
- Public-ready records: 95.
- Needs review: 0.
- Not available for international applicants: 0.
- Decision: `final-collection-passed`.

2026-06-17 post-fix note:

- The previous two `not-available-for-international` Doctor of Education rows have been corrected to `ready`.
- Current detail pages and the official fee table confirm international-applicant language requirements and International USD 18,000 tuition for both rows.
- Current accepted PhD count is 95 canonical records, 95 public ready records, 0 needs review, and 0 not available for international applicants.

Core generated files:

- `run_contract.json`
- `level_manifest.json`
- `source_cache_index.json`
- `candidate_dataset.json`
- `exception_queue.json`
- `pre_import_gap_audit.json`
- `current_official_diff_audit.json`
- `phd-candidate.json`
- `phd-audit.json`
- `phd-delivery.json`
- `final_collection_report.json`

Verification completed:

- `python3 scripts/verify-usm-phd-candidate.py --manifest data/imports/usm/2026-06-17/phd-final-collection/phd-candidate.json`
- `python3 /Users/ian/.codex/skills/studymy-official-university-collector/scripts/audit_records.py data/imports/usm/2026-06-17/phd-final-collection/phd-candidate.json --profile candidate --expected-count 95 --official-domain admission.usm.my --allow-official-rate-calculation --summary-only`
- `python3 /Users/ian/.codex/skills/studymy-official-university-collector/scripts/audit_delivery.py data/imports/usm/2026-06-17/phd-final-collection/phd-delivery.json --summary-only`
- `python3 scripts/audit-official-total-tuition.py data/imports/usm/2026-06-17/phd-final-collection/phd-candidate.json --summary-only`
- `npm test -- tests/api/usm-phd-commercial-import.test.ts tests/web/format.test.ts`
