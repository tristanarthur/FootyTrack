# FootyTrack

## VIBE-CODE WARNING

AFL team stats and insights — a static site built with [Observable Framework](https://observablehq.com/framework/), hosted on GitHub Pages, fed by a daily scrape of the [Squiggle API](https://api.squiggle.com.au/).

## Pages

| Page | Description |
|---|---|
| **Home** | Current round results and ladder |
| **Ladder** | Ladder position over the season + standings table |
| **Teams** | Per-team deep-dive: results, head-to-head, goals |
| **Games** | Full results browser with filters |
| **Tips** | Tipping model accuracy leaderboard |
| **Power Rankings** | Team power ratings over the season |

## Local Development

```bash
# 1. Install dependencies
npm install
pip3 install -r requirements.txt

# 2. Populate historical data (first time only)
python3 scripts/scrape_squiggle.py --backfill

# 3. Start dev server
npm run dev
# → http://localhost:3000
```

## Data

Historical data lives in `data/` as CSV files, committed to the repo:

| File | Contents |
|---|---|
| `teams.csv` | Team metadata |
| `games.csv` | All results since 2012 |
| `standings.csv` | Ladder snapshot per round |
| `tips.csv` | Model predictions per game |
| `power.csv` | Power rankings per round |
| `sources.csv` | Tipping model metadata |

The scraper (`scripts/scrape_squiggle.py`) runs daily via GitHub Actions, appending new rows and committing back to `main`, which triggers a site rebuild and redeploy.

## Deployment

1. Push to GitHub
2. In repo Settings → Pages → set source to **GitHub Actions**
3. Manually trigger the `Deploy to GitHub Pages` workflow for the first deploy
4. Subsequent deploys happen automatically on every push to `main`

For the daily scrape to commit back to the repo, ensure the workflow has **write** permissions (already configured in `scrape.yml`).
