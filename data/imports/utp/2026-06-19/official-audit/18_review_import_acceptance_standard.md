# UTP Review-Only Import Acceptance

## Decision

Status: `review-imported`.

This batch is imported for Ian/admin front-end review only. It is not a public
release and it is not commercial-display-ready.

## Scope

- Institution: Universiti Teknologi PETRONAS
- University code: UTP
- Levels: bachelor, master, phd
- Applicant scope: international
- Current-as-of: 2026-06-19
- Imported university id: 54

## Count Gate

- Official published programme candidates: 63
- Imported programme rows: 63
- Bachelor: 15
- Master: 37
- PhD: 11
- Missing official rows: 0
- Extra imported current rows: 0

## Review-Only Gate

- `publicDisplayStatus = needs-review`: 63
- `isPublished = false`: 63
- Ready rows: 0
- Published rows: 0
- Public leakage rows: 0
- Legacy active UTP rows after import: 0

## Fee Partition

- Matched official total rows: 41
- Official rate-only rows: 22
- Pending-review fee rows: 0

Rate-only fee values must not be used as public full-duration total tuition
unless a separate StudyMY publication contract explicitly authorizes
calculated-from-official-rate display with formula, duration basis, exclusions,
and detail notes.

## Verification

- Candidate integrity: passed.
- Delivery review: passed with `review-required` source decision.
- Dry-run import: passed.
- Transactional import: passed.
- Verify-only database audit: passed.
- Root build: passed (`shared`, `api`, `web`, `admin`).
- Browser review surface: passed.

## Artifacts

- Superseded initial post-import audit: `16_review_import_post_import_audit.json`
- Superseded initial verify audit: `17_review_import_verify_audit.json`
- Current hard-issue refresh post-import audit: `20_hard_issue_refresh_post_import_audit.json`
- Current hard-issue refresh verify audit: `21_hard_issue_refresh_verify_audit.json`
- Browser screenshot: `output/playwright/utp-official-audit/admin-programs-utp-review-edit.png`
- Backup: `apps/api/tmp/backups/utp-official-audit-before-2026-06-19T15-58-44-916Z.json`

## Review Entry

Open `http://127.0.0.1:3001/programs`, log in with the local admin account,
then filter/search UTP in the programme management page.
