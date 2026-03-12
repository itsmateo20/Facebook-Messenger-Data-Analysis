# Messenger Data Analyzer

Analyze Facebook Messenger export files (`message_*.json`) with:

- A minimal dark web dashboard (interactive charts + stat cards)
- A Python desktop workflow (`matplotlib`) for local analysis

## Current Web Dashboard Features

The browser analyzer now parses and visualizes a broad set of stats directly from selected `message_*.json` files.

### Stat Cards

- Total call duration
- Most active day
- Top emojis
- Messages sent (total)
- Most messages (top sender)
- Average words per message
- Total attachments
- Total reactions

### Charts

- Top words
- Calls started per participant
- Top emojis
- Messages per participant
- Media and attachment types
- Activity by weekday
- Activity by hour

### Parsing/Filtering Details

- Handles common Messenger mojibake text issues (improves emoji/text detection)
- Counts text and non-text messages
- Aggregates media types: photos, videos, audio, GIFs, files, stickers, shares
- Includes unsent/reaction/call-related metadata where present

## Python Analyzer

`main.py` provides a local Python workflow with `matplotlib` charts and summary output.

## Project Structure

- `index.html` - Web UI
- `src/RunAnalysis.js` - Browser-side parsing, aggregation, and chart rendering
- `src/styles.css` - Minimal dark theme styles
- `src/GetCurrentYear.js` - Footer year helper
- `main.py` - Python analysis entry point
- `requirements.txt` - Python dependencies

## Requirements

### Web Dashboard

- Modern browser
- Internet connection (Chart.js is loaded from CDN)

### Python Workflow

- Python 3.8+

Install dependencies:

```bash
pip install -r requirements.txt
```

## Usage

### Option 1: Web Dashboard

1. Open `index.html` in a browser.
2. Click **Select Files** and choose one or more `message_*.json` files.
3. Click **Run Analysis**.
4. Review cards and charts.

If the page appears stale after updates, hard refresh once (`Ctrl+F5`).

### Option 2: Python Analyzer

1. Install dependencies:

```bash
pip install -r requirements.txt
```

1. Run:

```bash
python main.py
```

1. Select the conversation folder containing `message_*.json` files.
2. View terminal summary and generated charts.

## Data Source

Export Messenger conversation data from Meta Accounts Center, then use the conversation directory containing `message_*.json`.

## Privacy and Scope

- Intended for local personal analytics.
- Not affiliated with Meta.
- Keep exported conversation data private.
