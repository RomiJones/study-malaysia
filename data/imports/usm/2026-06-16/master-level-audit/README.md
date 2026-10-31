# USM Master Level Audit - 2026-06-16

This directory contains staged collection/audit artifacts generated before any database write in this run.

- level_manifest.json
- source_cache_index.json
- candidate_dataset.json
- pre_import_gap_audit.json
- post_import_display_audit.json
- current_html_intake_fix_audit.json

The initial artifact generation step did not import data. The later
standardization passes imported the regenerated master candidate and wrote
post-import audits after database verification.
