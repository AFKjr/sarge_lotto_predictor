# Sarge's Pick 3 Analyzer

A browser-based tool for tracking and analyzing Georgia Lottery **Cash 3** (Pick 3) results. No server required — all data is stored locally in your browser.

---

## Features

### Calculator
- Compute single-draw odds for Straight, Box (all-different), and Box (one pair) bets
- Enter your number to auto-detect box type based on digit composition
- Set ticket cost to see expected loss over any number of plays
- Shows plays needed for a 50% cumulative win chance

### Drawings
- Manually add, edit, and delete drawing results (number, date, draw time)
- Draw times: **Midday**, **Evening**, **Night** — matching the GA Lottery Cash 3 schedule
- Filter the list by draw time (All / Midday / Evening / Night) and date range
- **Import PDF** directly from the GA Lottery website — bulk-loads results automatically
- Import / Export as JSON for backup and restore
- Click any drawing number to pre-fill the Calculator

### Stats
- Digit frequency grid (0–9) with **hot** (top 3) and **cold** (bottom 3) indicators
- Top 10 most-drawn straight numbers
- Top 10 most-drawn box combinations (digit-order-independent)

---

## Importing a PDF from the GA Lottery

1. Go to [galottery.com](https://www.galottery.com)
2. Navigate to **Games → Cash 3 → Winning Numbers**
3. Download the winning numbers history as a PDF
4. In the Drawings page, click **Import PDF** and select the file
5. New results are merged in — existing entries are never overwritten

The PDF parser reads the **Date**, **Draw**, and **Winning Numbers** columns from the standard GA Lottery "Cash 3 Winning Numbers" PDF format and ignores Winners/Payout columns.

---

## Usage

Open `index.html` in any modern browser. No build step or internet connection required (except to load the Inter font and PDF.js from CDN on first visit).

---

## Tech Stack

- Vanilla JavaScript (ES5-compatible, no frameworks)
- [PDF.js](https://mozilla.github.io/pdf.js/) (v3.11.174) for PDF text extraction
- `localStorage` for persistent data storage
- Inter font via Google Fonts
- CSS custom properties for theming
