# UTM Master Skill Workflow Operator Review

- Scope: UTM master programmes, international applicants, current-as-of 2026-06-17.
- Official domains: admission.utm.my, odl.utm.my, utm.my.
- Canonical rows: 153; ready: 153; needs-review: 0; not-available-for-international: 0.
- Fee partition: 132 official totals, 14 calculated from authorized official ODL rates, 7 official variant rows with no StudyMY scalar total.
- GPA/CGPA coverage: 153/153 structured rows.
- Live re-scrape that returned 151 rows was rejected as transport drift; locked official cache and database verification remain authoritative for this audit.
- Notion was not updated because no writable Notion connector is available in this environment.

## Publish Gate Verification

- Authorization: publish; decision: published.
- Controlled import command: `npm --workspace @studymy/api run import:utm:master -- --confirm-import`.
- Rollback backup: `apps/api/tmp/backups/utm-master-before-2026-06-17T13-30-57-879Z.json` (SHA-256 `a8b59046e25d705b3ae54d6934604b8a652897e12e0b13af3b92f4dbd0439608`).
- Database/API result: 153 UTM master rows published, 153 GPA rows, 153 source-linked rows; public API pagination returns 100 + 53 rows.
- Fee partition after import: 132 matched official totals, 14 calculated from official rate, 7 not-published official variant rows with no scalar total.
- UI/browser result: UTM detail page shows 本科专业40 and 硕士专业153; public home shows UTM; browser console errors 0.
- Tests/builds: focused UTM tests passed (4/4), API build passed, Web build passed.
- Notion was not updated because no writable Notion connector is available in this environment; local audit artifacts are the updated delivery record.
