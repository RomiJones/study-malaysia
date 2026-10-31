# UCSI Review Import Release Report

- Decision: review-imported
- Scope: UCSI bachelor/master/phd official-audit candidates for international applicants
- Imported review rows: 118
- By level: bachelor 60, master 40, phd 18
- Public leakage rows: 0
- Admin needs-review rows: 118
- Existing public rows preserved: yes
- Backup: tmp/backups/ucsi-official-audit-review-before-2026-06-21T11-57-39-892Z.json
- Dry run: data/imports/ucsi/2026-06-20/official-audit/20_review_import_dry_run.json
- Post-import audit: data/imports/ucsi/2026-06-20/official-audit/21_post_import_display_audit.json

## Public Visibility

- Before: {"universityExists":true,"universityId":10,"code":"UCSI","slug":"ucsi-university","isPublished":true,"publicDisplayStatus":"ready","publicProgramRows":6,"readyProgramRows":0,"reviewProgramRows":124,"reviewImportRows":118}
- After: {"universityExists":true,"universityId":10,"code":"UCSI","slug":"ucsi-university","isPublished":true,"publicDisplayStatus":"ready","publicProgramRows":6,"readyProgramRows":0,"reviewProgramRows":124,"reviewImportRows":118}

## Remaining Review Exceptions

- Official fee tables/snippets require manual reconciliation before public tuition display.
- Programme-level international eligibility still requires official admissions-route confirmation.
- Missing language/career rows and multilingual student-facing copy require review.
