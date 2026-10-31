# MUM Official Publication Release Report

Date: 2026-06-20

## Decision

Monash University Malaysia bachelor/master/doctoral catalogue is ready for direct public launch in StudyMY.

## Scope

- Included: 60 international bachelor/master/doctoral programmes.
- Counts: bachelor 36, master 17, phd 7.
- Excluded from this scope: English course, Diploma, Postgraduate Certificate and Postgraduate Diploma rows from the official baseline.

## Resolved Blockers

- Converted the remaining fee blocker into an authorized public fee policy.
- 51 rows use `calculated-from-official-rate`: official annual international fee x official standard/minimum full-time duration.
- 9 rows use `matched-official`: official full-course total.
- Formula and exclusions are retained in programme fee notes.
- Rendered official DOM evidence now covers programme detail tabs and the research English-language requirement source.
- Page-option inventory, field coverage, display parity and source cache pass publication gates.

## Verification

- Candidate integrity: passed.
- Record publication audit: passed.
- Total tuition audit with authorized rate calculation: passed.
- Import dry-run: passed.
- Transactional import: passed.
- Post-import verifier: passed.
- SQL audit: university ready/published; 60 programme rows ready/published; fee statuses 51 calculated-from-official-rate and 9 matched-official.
- Public API: Monash university detail, programme detail and `universityId=5` programme listing available.
- Admin API: Monash university searchable; `search=MUM` programme total is 60.
- Frontend UI: public university tabs show bachelor 36, master 17 and phd 7; programme detail displays RM total tuition and IELTS; no console errors in checked pages.
- Builds/tests: MUM focused test passed; API, Web and Admin builds passed. Admin build retains an existing chunk-size warning only.

## Backup

- Latest pre-publication database backup: `/Users/ian/Desktop/dev/study-malaysia/apps/api/tmp/backups/mum-official-audit-publish-before-2026-06-19T16-29-44-940Z.json`.

## Residual Notes

- CNY values are StudyMY internal display/filter conversions from MYR and are not official Monash amounts.
- 10 course-setting blocks and 5 career-direction blocks remain official-unpublished on the source page and are displayed with controlled labels, not generic fallbacks.
- Notion was not updated because no Notion connector is available in this workspace.
