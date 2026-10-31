# USM PhD Level Audit

This directory records the 2026-06-16 doctoral field coverage audit and the follow-up controlled publication audit.

- Field coverage audit: current official HTML panels were checked before import; transport failures are recorded as transport exceptions.
- Controlled publication: USM doctoral rows were imported with `--confirm-import` after dry-run review.
- Post-import display audit: `post_import_display_audit.json`.
- Release gate: `tmp/reports/usm-commercial-release-gate.json`, decision `commercial-release-ready`.

The scoped backup created before the final doctoral import is `apps/api/tmp/backups/usm-phd-commercial-before-final-standard-2026-06-16.json`.
