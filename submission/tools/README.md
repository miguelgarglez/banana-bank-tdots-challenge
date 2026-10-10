# Parity and functional tools

Visual-parity and live-flow tools used to verify the P3 refactor (no behavior change).

## Usage

1. `npm i` inside this directory (installs Playwright; browsers are downloaded to
   `~/Library/Caches/ms-playwright` on first run or reused if already present).
2. Start the app dev server on port 3000 (`npm run dev` in the project root).
3. `node parity.mjs <out-dir>` — normalizes demo data, then captures 8 full-page
   screenshots at 1440x900.
4. `python3 parity-compare.py <ref-dir> <out-dir>` — per-PNG size and diff-pixel
   table (needs Pillow); fails on any nonzero diff.
5. `node functional.mjs` — live flow: Lucía transfer + confirmation, Marta brief +
   reconciliation; restores Lucía's fixture state afterwards.
6. `tokenize-css.py` — the script used to inventory and tokenize CSS literals.
7. `node build-sessions-viewer.mjs ../ai-sessions ../ai-sessions-viewer` — regenerate
   the interactive session viewer data from the AI session exports.
