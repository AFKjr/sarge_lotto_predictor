# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Sarge's Pick 3 Analyzer: a static, browser-only tool for Georgia Lottery **Cash 3** results. No build step, package manager, server, linter, or test suite. To run it, open `index.html` in a browser. Network access is only needed for the Inter font (Google Fonts) and PDF.js 3.11.174 (cdnjs, loaded only on `drawings.html`).

## Architecture

Three pages, each with its own script. There are no modules; scripts load with plain `<script>` tags at the end of `<body>` and share globals. `storage.js` is the only shared script, loaded before `drawings.js` and `stats.js`:

| Page | Script | Role |
|---|---|---|
| `index.html` | `main.js` | Odds / expected-loss calculator |
| `drawings.html` | `drawings.js` | CRUD for drawing results, filters, pagination, JSON import/export, GA Lottery PDF import |
| `stats.html` | `stats.js` | Digit frequency (hot/cold), top straight and box combos |

`styles.css` is shared by all pages and uses CSS custom properties for theming. The nav and footer (disclaimer, Ko-fi link) are copied by hand into each HTML file, so a change to either must be made in all three files.

### Data flow
- The only persistent state is a list of drawings `{ id, number, date, draw }`, stored in IndexedDB (database `sarge-pick3`, object store `drawings`, keyed by `id`). `number` is a 3-digit string, `date` is `YYYY-MM-DD`, and `draw` is one of `"midday" | "evening" | "night"` (lowercase).
- `storage.js` owns all persistence. `initDrawingStore()` must resolve before anything reads data; each page's last line starts it and renders afterwards. It then keeps an in-memory copy, so `loadDrawings()` is synchronous and returns a copy. `saveDrawings(list)` replaces the whole store in one transaction and returns a promise. `drawings.js` calls it through `storeDrawings()`, which shows an error if the save fails.
- Migration: on first run, if IndexedDB is empty and the old `localStorage` key `"drawings"` exists, its data is copied in and the old key is renamed to `"drawings-legacy-backup"`. If IndexedDB can't be opened, storage falls back to the `localStorage` key `"drawings"`.
- `drawings.js` and `stats.js` each define their own `getFilteredDrawings()` and `handleFilterDraw()`. The `drawings.js` version also filters by date range.
- Duplicates are detected by `(date, draw)` (`isDuplicate` in `drawings.js`). PDF import merges and skips existing entries; JSON import replaces everything after a confirm prompt.
- Cross-page link: clicking a number in the drawings list goes to `index.html?number=XYZ`, which `readQueryParams()` in `main.js` reads to pre-fill the calculator.

### PDF import (`parseCash3Pdf` in `drawings.js`)
Parses the GA Lottery "Cash 3 Winning Numbers" PDF from PDF.js text items using their x/y coordinates. Each page is processed separately, because y-coordinates are page-relative and mixing pages corrupts row grouping. Items are grouped into rows by y (`Y_TOLERANCE = 5`), then each row is matched for a date (`M/D/YYYY`), a draw name, and winning digits. The Winners and Payout columns are ignored. PDFs are gitignored; don't commit sample files.

### Calculator constants (`main.js`)
Odds and payouts per $1 are hard-coded in `getOddsBetType` and `getPayoutForBetType`: straight 1/1000 → 500, box-different 6/1000 → 80, box-pair 3/1000 → 160. Box type is detected automatically from how many distinct digits the number has (`detectBoxType`).

## Conventions
- Vanilla JS, no frameworks or dependencies beyond PDF.js. The code uses `const`/`let`/`Set`/`padStart` (ES2015+), even though the README says "ES5-compatible". It uses `function` declarations, not arrow functions, and wires up handlers with `addEventListener` at the top of each script. Match this style.
- DOM elements are found by `id`. Filter buttons use the `.filter-button` class plus a `data-draw` attribute.
