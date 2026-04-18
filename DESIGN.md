# FootyTrack — Design & Implementation Plan

AFL team stats and insights site, statically hosted on GitHub Pages, fed by a daily scrape of the [Squiggle API](https://api.squiggle.com.au/).

---

## 1. Stack decisions (and why)

### Site generator: **Observable Framework**
- Purpose-built for static data apps → exactly our use case.
- Builds to plain static HTML/CSS/JS → deploys cleanly to GitHub Pages.
- Has a polished, opinionated built-in theme (light/dark + named variants like `alt`, `air`, `cotton`, `deep-space`, `near-midnight`, `ocean-floor`, `parchment`, `slate`, `stark`, `sun-faded`, `wide`) → satisfies "beautiful theme, no custom CSS".
- "Data loaders" are files (`.csv.py`, `.json.ts`, etc.) that run at **build time** and emit static data snapshots → perfect fit for our CSV corpus. No runtime fetching needed.
- First-class Markdown pages with inline JS fenced blocks, so page authors write `# Heading` and one small JS block per chart — not full pages of JSX/TS.

### Chart library: **Observable Plot** (primary) + **D3** (fallback, already bundled)
- Ships with Observable Framework, so no extra deps, no theme-matching work — Plot inherits the framework's CSS variables and looks native in both themes out of the box.
- Declarative grammar-of-graphics API; a line chart is ~5 lines of JS.
- Covers every chart we need: line, bar, area, dot, rule, cell (heatmap), tick, small multiples via `fx`/`fy`, tooltips via `Plot.tip`.

### Data scraper: **Python (`requests` + `pandas`)** in GitHub Actions
- Squiggle supports `format=csv` directly — pandas gives us painless append/dedupe.
- Python chosen over Node purely for pandas' ergonomics with CSV rollups.

### Hosting: **GitHub Pages** via official `actions/deploy-pages`
- Two workflows: one to scrape (cron), one to build + deploy (on push to `main`).

### What we explicitly are NOT using
- No custom CSS files beyond the framework theme config.
- No React / Next.js / Svelte — Observable Framework is the view layer.
- No client-side API calls — all data baked in at build time.
- No database — CSVs in repo are the source of truth for historical data.

---

## 2. Repository layout

```
FootyTrack/
├── .github/
│   └── workflows/
│       ├── scrape.yml         # daily cron; runs scraper; commits CSVs
│       └── deploy.yml         # on push to main; builds + deploys site
├── data/                      # checked-in historical data (source of truth)
│   ├── games.csv              # one row per game, all seasons
│   ├── standings.csv          # ladder snapshot per (year, round, team)
│   ├── teams.csv              # static team metadata (id, name, abbrev, colors)
│   ├── tips.csv               # tipping predictions per (game, source)
│   ├── sources.csv            # prediction model metadata
│   └── power.csv              # power rankings per (year, round, source, team)
├── scripts/
│   └── scrape_squiggle.py     # the scraper (invoked by scrape.yml)
├── src/                       # Observable Framework source root
│   ├── index.md               # landing page
│   ├── ladder.md
│   ├── teams.md               # team index
│   ├── teams/
│   │   └── [team].md          # dynamic per-team page (parameterized route)
│   ├── games.md
│   ├── tips.md                # model comparison
│   ├── power.md               # power rankings
│   ├── components/
│   │   ├── ladderChart.js     # reusable Plot helpers
│   │   ├── marginChart.js
│   │   └── teamColors.js      # team → color lookup
│   └── data/                  # data loaders (build-time)
│       ├── games.csv.js       # reads ../../data/games.csv, emits CSV
│       ├── ladder.csv.js
│       ├── teams.json.js
│       └── latest.json.js     # "current round" summary blob
├── observablehq.config.js     # theme, nav, title, pages config
├── package.json               # just @observablehq/framework
├── requirements.txt           # requests, pandas
├── .gitignore                 # dist/, .observablehq/cache/, node_modules/
├── README.md
└── DESIGN.md                  # this file
```

**Why `data/` at repo root AND `src/data/` loaders?**
`data/` is the canonical CSV corpus — human-readable, diffable in PRs, what the GH Action writes. `src/data/*.csv.js` are thin loaders that the framework invokes at build time; they can pass the CSVs through unchanged, or derive ready-to-plot variants (e.g. pre-pivoted ladder-over-time).

---

## 3. Data model (CSV schemas)

All CSVs are UTF-8, comma-separated, with a header row. Primary keys called out below.

### `teams.csv` — static, rarely changes
`id, name, abbrev, logo, debut, retirement`
Fetched once (on first run) from `?q=teams`. PK: `id`.

### `games.csv` — append/upsert on `id`
`id, year, round, roundname, date, hteam, hteamid, ateam, ateamid, hscore, ascore, hgoals, hbehinds, agoals, abehinds, winner, winnerteamid, margin, venue, complete, is_final, is_grand_final, updated`
From `?q=games`. PK: `id`. `complete` is a percentage (0–100); only treat rows with `complete=100` as final. Keep in-progress rows so the site can show live-ish results at last scrape.

### `standings.csv` — append on `(year, round, teamid)`
`year, round, teamid, name, rank, played, wins, losses, draws, for, against, percentage, pts, goals_for, goals_against, behinds_for, behinds_against`
From `?q=standings&year=YYYY&round=R`. PK: `(year, round, teamid)`. We snapshot the ladder every round so we can chart rank-over-time.

### `sources.csv` — static-ish
`id, name, url`
From `?q=sources`. PK: `id`.

### `tips.csv` — upsert on `(gameid, sourceid)`
`gameid, sourceid, year, round, hteamid, ateamid, tipteamid, margin, confidence, correct, bits, updated`
From `?q=tips`. PK: `(gameid, sourceid)`.

### `power.csv` — append on `(year, round, sourceid, teamid)`
`year, round, sourceid, teamid, rank, rating, updated`
From `?q=power`. PK: `(year, round, sourceid, teamid)`.

> **Squiggle API etiquette** (from their docs): send a descriptive `User-Agent` with a contact URL/email (e.g. `FootyTrack/1.0 (+https://github.com/<user>/FootyTrack)`) and keep request volume low. The scraper should batch by year and only re-pull incomplete data.

---

## 4. The scraper — `scripts/scrape_squiggle.py`

Idempotent. Safe to re-run. Commits nothing itself — the workflow handles git.

```python
# pseudocode — implementer: flesh out with pandas
BASE = "https://api.squiggle.com.au/"
HEADERS = {"User-Agent": "FootyTrack/1.0 (+https://github.com/OWNER/FootyTrack)"}
CURRENT_YEAR = datetime.now(ZoneInfo("Australia/Melbourne")).year

def fetch(q, **params):
    # GET BASE?q=...&format=csv&... , retry with backoff, return DataFrame

def upsert(df_new, path, key_cols):
    # if path exists: concat, drop_duplicates(subset=key_cols, keep='last'), sort
    # else: write df_new
    # always write with stable column order + sort for clean diffs

def main():
    # 1. teams — overwrite (small, authoritative)
    upsert(fetch("teams"), "data/teams.csv", ["id"])
    # 2. sources — overwrite
    upsert(fetch("sources"), "data/sources.csv", ["id"])
    # 3. games — current year full pull; prior years only if file missing
    games = fetch("games", year=CURRENT_YEAR)
    upsert(games, "data/games.csv", ["id"])
    # 4. standings — pull current year, per-round snapshots we don't yet have
    # 5. tips — current year
    # 6. power — current year, per-round snapshots we don't yet have
```

Key behaviors:
- **Backfill on first run**: if `data/games.csv` doesn't exist, loop years from 2000 → current. Gate behind `--backfill` CLI flag so the daily cron doesn't accidentally re-pull everything.
- **Round snapshots**: for `standings.csv` and `power.csv`, compute which `(year, round)` pairs we already have and only request missing ones. Once a round is complete, its ladder never changes, so we never re-pull.
- **Logging**: print row counts added/updated per file so the Action log is readable.
- **Exit nonzero on HTTP error** so the workflow surfaces it.

---

## 5. GitHub Actions

### `.github/workflows/scrape.yml`
```yaml
name: scrape
on:
  schedule:
    - cron: "15 19 * * *"   # 05:15 AEST daily (after games are final)
  workflow_dispatch:
    inputs:
      backfill:
        type: boolean
        default: false

permissions:
  contents: write

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12", cache: pip }
      - run: pip install -r requirements.txt
      - run: python scripts/scrape_squiggle.py ${{ inputs.backfill && '--backfill' || '' }}
      - name: Commit changes
        run: |
          git config user.name  "footytrack-bot"
          git config user.email "actions@users.noreply.github.com"
          git add data/
          git diff --cached --quiet || git commit -m "data: daily scrape $(date -u +%F)"
          git push
```
The push to `main` naturally triggers `deploy.yml`.

### `.github/workflows/deploy.yml`
```yaml
name: deploy
on:
  push: { branches: [main] }
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run build          # → dist/
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: github-pages
    steps:
      - uses: actions/deploy-pages@v4
```

---

## 6. Observable Framework config

### `observablehq.config.js`
```js
export default {
  title: "FootyTrack",
  theme: ["air", "near-midnight"],   // light + dark, auto-switches
  root: "src",
  output: "dist",
  pages: [
    { name: "Ladder",   path: "/ladder" },
    { name: "Teams",    path: "/teams" },
    { name: "Games",    path: "/games" },
    { name: "Tips",     path: "/tips" },
    { name: "Power",    path: "/power" },
  ],
  head: '<link rel="icon" href="/favicon.svg">',
  footer: "Data: api.squiggle.com.au · Built with Observable Framework",
};
```

Why the `air` + `near-midnight` pair: `air` is a crisp, bright, whitespace-forward light theme that renders Plot charts beautifully; `near-midnight` is the matching dark. The framework handles prefers-color-scheme automatically. Implementer is free to swap to `parchment`/`slate` or `ocean-floor`/`sun-faded` if the feel lands better.

### `package.json`
```json
{
  "type": "module",
  "private": true,
  "scripts": {
    "dev":   "observable preview",
    "build": "observable build",
    "clean": "observable clean"
  },
  "devDependencies": { "@observablehq/framework": "^1.13.0" }
}
```

---

## 7. Data loaders (`src/data/*`)

Loaders run once at build time. Output is cached and served statically.

### `src/data/games.csv.js`
```js
import { readFile } from "node:fs/promises";
process.stdout.write(await readFile("data/games.csv", "utf8"));
```

### `src/data/ladder.csv.js` — derived view
Produces a tidy `(year, round, teamid, rank, pts, percentage)` CSV with only completed rounds, sorted for line-chart use. Lets the ladder page be a 3-line Plot call.

### `src/data/latest.json.js` — summary blob
Emits `{ currentYear, currentRound, lastUpdated, nextGames: [...] }` so the landing page can render "Round X" without parsing everything.

Loaders read from `../../data/*.csv` (repo-root data dir). Keep them thin — any heavy reshaping that's reused on multiple pages belongs here; one-off shaping belongs on the page.

---

## 8. Pages & visualizations

Each page is a Markdown file with small fenced JS blocks. Pattern per page:

```md
# Ladder

```js
const ladder = FileAttachment("data/ladder.csv").csv({typed: true});
```

```js
Plot.plot({
  marks: [Plot.line(ladder, {x: "round", y: "rank", stroke: "name", tip: true})],
  y: {reverse: true, label: "Ladder position"},
  color: {legend: true}
})
```
```

### Landing (`index.md`)
- Hero: current round, last-updated timestamp (from `latest.json`).
- **Compact ladder** (Plot `barX` of points, colored by team).
- **This week's games** (table via `Inputs.table`, or a custom card grid using `html` template literals — no CSS needed, framework default styles cards).
- **Margin of the round** (Plot `dot` of margins, labelled with winner).

### Ladder (`ladder.md`)
- **Rank-over-rounds line chart** (Plot `line`, `x=round`, `y=rank`, `stroke=team`, y-axis reversed). One line per team. Optional `Inputs.checkbox` of teams to filter.
- **Current standings table** via `Inputs.table` sorted by rank.
- **Percentage vs. points scatter** (Plot `dot` with team logos as labels).

### Teams (`teams.md` + dynamic `teams/[team].md`)
- Index page: grid of team cards, each linking to `/teams/<abbrev>`.
- Dynamic page uses Observable Framework's [parameterized routes](https://observablehq.com/framework/params). Observables:
  - **Results timeline** — Plot `barY` of margins per round, colored by win/loss.
  - **Form line** — rolling 5-game win% line.
  - **Head-to-head heatmap** — Plot `cell` of (opponent × year) colored by average margin.
  - **Goals vs behinds** — Plot `dot` scatter.

### Games (`games.md`)
- **Filter bar** — `Inputs.select` for year, round.
- **Results table** — `Inputs.table`.
- **Margin distribution** — Plot `rectY` histogram per year.
- **Biggest wins / closest finishes** — top/bottom N, rendered as HTML cards.

### Tips (`tips.md`) — model leaderboard
- **Model accuracy table** — `Inputs.table` sorted by correct %.
- **Bits-per-tip bar chart** — Plot `barX`, sorted, color-coded by model.
- **Tip accuracy over time** — Plot `line`, `x=round`, `y=rolling accuracy`, `stroke=source`.

### Power (`power.md`) — power rankings
- **Team rating over time** — Plot `line` small-multiples via `fx: "source"`, so each panel is one model's view of all teams.
- **Current power ranking table**.
- **Model-vs-model disagreement heatmap** — Plot `cell` of (team × source) colored by rating delta from mean.

---

## 9. Visual identity

- **Team colors**: hard-code in `src/components/teamColors.js`. Example: `{ "Richmond": "#FFD200", "Collingwood": "#000000", ... }`. Use as `color: {domain, range}` in Plot.
- **Typography**: framework default (Inter). Don't override.
- **Layout helpers**: framework provides `<div class="grid grid-cols-2">` and `<div class="card">` classes — use these instead of writing CSS.
- **Logos**: optionally pull AFL team logos into `src/assets/logos/` (SVG, one per team, filenames = team abbrev). Not required for v1.

---

## 10. Implementation order (for the next agent)

Work top-to-bottom; each step is independently committable.

1. **Repo skeleton** — create `package.json`, `observablehq.config.js`, `requirements.txt`, `.gitignore` (ignore `dist/`, `node_modules/`, `.observablehq/cache/`), empty `src/index.md`, empty `data/` dir with a `.gitkeep`.
2. **Scraper** — `scripts/scrape_squiggle.py` with `--backfill` flag. Run locally once with `--backfill` to populate `data/`. Commit the CSVs.
3. **Data loaders** — thin passthroughs in `src/data/` for every CSV, plus `ladder.csv.js` and `latest.json.js`.
4. **Landing page** — prove the pipeline end-to-end with one Plot chart (current ladder as bar chart) and the "current round" header.
5. **Ladder page** — rank-over-rounds line chart + standings table.
6. **Games page** — filters + table + margin histogram.
7. **Teams index + dynamic team page** — parameterized route; per-team results timeline.
8. **Tips page** — model leaderboard.
9. **Power page** — ratings over time.
10. **GH Actions** — `deploy.yml` first (verify Pages works), then `scrape.yml` with `workflow_dispatch` only, then enable the cron once a manual run succeeds.
11. **Polish pass** — team colors wired into every chart, favicon, footer copy, README with local-dev instructions.

### Local dev
```
npm install
pip install -r requirements.txt
python scripts/scrape_squiggle.py --backfill   # one-time
npm run dev                                    # http://localhost:3000
```

### Gotchas to flag for the implementer
- Observable Framework's data loaders run in the project root, so paths to `../data/*.csv` depend on loader location; double-check with `observable preview` before wiring many pages.
- GitHub Pages serves from a subpath when using `<user>.github.io/FootyTrack/` — set `root`/`base` in `observablehq.config.js` accordingly (`cleanUrls: true` and possibly a `base: "/FootyTrack/"` entry), or deploy to a CNAME.
- Squiggle's `standings` endpoint requires both `year` AND `round` to return a historical snapshot; without `round` it returns current.
- The `tips` endpoint returns one row per `(game, model)`; at ~10 models × 200+ games/yr it's ~2k rows/yr — trivially small but worth knowing.
- `complete` is a string percentage in JSON but becomes numeric in CSV. Loader should cast consistently.

---

## 11. Out of scope for v1 (possible follow-ups)
- Live in-progress game view via Squiggle's SSE endpoint (would require client-side JS — consider a single "Live" page that opts into it).
- Player-level stats (Squiggle doesn't provide these; would need a second data source like AFL Tables).
- User-configurable tipping comp.
- PWA / offline support.
