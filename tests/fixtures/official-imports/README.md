# Official import test fixtures

This directory contains the minimum operational JSON inputs read by the root test suite but intentionally excluded from the application code baseline.

- Fixtures mirror repository-relative source paths and use deterministic gzip compression.
- `manifest.json` records byte counts and SHA-256 checksums.
- `install-fixture-fallback.cjs` redirects only exact paths listed in the manifest and verifies integrity before returning data.
- Production import commands continue to read `audits/` and `data/imports/`; the fallback is installed only by `scripts/run-tests.mjs`.
- The fixture sources contain public institutional programme information. No credentials, private keys, access tokens, or student records are included.
- Regenerate only from the controlled data workspace with `node tests/fixtures/official-imports/generate-fixtures.mjs`.

Do not add full crawl caches, PDFs, HTML snapshots, screenshots, reports, or unrelated Gate 3 assets here.
