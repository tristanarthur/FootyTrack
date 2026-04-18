---
toc: false
---

```js
import {teamColor} from "../components/teamColors.js";
```

```js
// Resolve team name from URL slug
const slug = observable.params.team;
const games = FileAttachment("../data/games.csv").csv({typed: true});
const standings = FileAttachment("../data/standings.csv").csv({typed: true});
const teamsData = FileAttachment("../data/teams.csv").csv({typed: true});
```

```js
// Match slug back to team name
const allTeamNames = [...new Set(games.map((d) => d.hteam))].sort();
const teamName = allTeamNames.find(
  (n) => n.toLowerCase().replace(/\s+/g, "-") === slug
) ?? slug;

const color = teamColor(teamName);
const teamInfo = teamsData.find((t) => t.name === teamName);
const logoUrl = teamInfo?.logo ? `https://squiggle.com.au${teamInfo.logo}` : null;

// Logo map for all teams (used in rival cards)
const logoMap = Object.fromEntries(
  teamsData.map((t) => [t.name, `https://squiggle.com.au${t.logo}`])
);

// All completed games involving this team
const teamGames = games
  .filter((d) => d.complete === 100 && (d.hteam === teamName || d.ateam === teamName))
  .map((d) => {
    const isHome = d.hteam === teamName;
    return {
      ...d,
      teamScore: isHome ? d.hscore : d.ascore,
      oppScore: isHome ? d.ascore : d.hscore,
      opponent: isHome ? d.ateam : d.hteam,
      result: d.winner === teamName ? "W" : d.winner ? "L" : "D",
      margin: isHome ? (d.hscore - d.ascore) : (d.ascore - d.hscore),
    };
  })
  .sort((a, b) => a.year - b.year || a.round - b.round);

const years = [...new Set(teamGames.map((d) => d.year))].sort((a, b) => b - a);

// Team standings history
const teamStandings = standings
  .filter((d) => d.name === teamName)
  .sort((a, b) => a.year - b.year || a.round - b.round);
```

```js
// All-time head-to-head vs each opponent
const allTimeH2H = [...new Set(teamGames.map((d) => d.opponent))].map((opp) => {
  const g = teamGames.filter((d) => d.opponent === opp);
  const wins = g.filter((d) => d.result === "W").length;
  const losses = g.filter((d) => d.result === "L").length;
  const draws = g.filter((d) => d.result === "D").length;
  return {opponent: opp, wins, losses, draws, played: g.length};
});

const bestRival  = [...allTimeH2H].sort((a, b) => b.wins   - a.wins  )[0];
const worstRival = [...allTimeH2H].sort((a, b) => b.losses - a.losses)[0];
```

```js
const yearInput = Inputs.select(years, {label: "Season", value: years[0], format: (d) => String(d)});
const selectedYear = Generators.input(yearInput);
```

```js
const currentYearGames = teamGames.filter((d) => d.year === selectedYear);
const wins = currentYearGames.filter((d) => d.result === "W").length;
const losses = currentYearGames.filter((d) => d.result === "L").length;
const draws = currentYearGames.filter((d) => d.result === "D").length;
```

```js
html`<div style="border-left:5px solid ${color};padding-left:1rem;margin-bottom:1.5rem;display:flex;align-items:center;gap:1.25rem;">
  ${logoUrl ? html`<img src="${logoUrl}" alt="${teamName} logo" style="width:80px;height:80px;object-fit:contain;flex-shrink:0;">` : ""}
  <div>
    <h1 style="margin:0 0 0.25rem;">${teamName}</h1>
    <p style="margin:0;"><strong>${selectedYear}:</strong> ${wins}W – ${losses}L${draws ? ` – ${draws}D` : ""} &nbsp;|&nbsp; ${currentYearGames.length} games played</p>
  </div>
</div>`
```

---

## Season

```js
yearInput
```

<div class="grid grid-cols-1" style="margin-top:1rem;">
<div class="card">

### Results — Win/Loss by Margin

```js
Plot.plot({
  height: 300,
  x: {label: "Round", tickFormat: "d"},
  y: {label: "Margin (pts)", grid: true},
  color: {
    domain: ["W", "L", "D"],
    range: [color, "#ccc", "#888"],
    legend: true,
  },
  marks: [
    Plot.ruleY([0]),
    Plot.barY(currentYearGames, {
      x: "round",
      y: "margin",
      fill: "result",
      tip: true,
      title: (d) => `Rd ${d.round}: ${d.result} vs ${d.opponent}\n${d.teamScore} – ${d.oppScore} (${d.margin > 0 ? "+" : ""}${d.margin})`,
    }),
  ],
})
```

</div>
</div>

<div class="grid grid-cols-2" style="margin-top:1rem;">
<div class="card">

### Head-to-Head vs Each Team

```js
(function() {
  const opponents = [...new Set(currentYearGames.map((d) => d.opponent))].sort();
  const h2h = opponents.map((opp) => {
    const g = currentYearGames.filter((d) => d.opponent === opp);
    const w = g.filter((d) => d.result === "W").length;
    const l = g.filter((d) => d.result === "L").length;
    const avgMargin = g.reduce((s, d) => s + d.margin, 0) / (g.length || 1);
    return {opponent: opp, wins: w, losses: l, avgMargin};
  });
  return Plot.plot({
    marginLeft: 140,
    x: {label: "Average margin (pts)", grid: true},
    y: {label: null},
    marks: [
      Plot.barX(h2h, {
        x: "avgMargin",
        y: "opponent",
        sort: {y: "x"},
        fill: (d) => d.avgMargin >= 0 ? color : "#ccc",
        tip: true,
        title: (d) => `vs ${d.opponent}: ${d.wins}W ${d.losses}L\nAvg margin: ${d.avgMargin.toFixed(1)}`,
      }),
      Plot.ruleX([0]),
    ],
  });
})()
```

</div>

<div class="card">

### Goals vs Behinds Per Game

```js
Plot.plot({
  grid: true,
  x: {label: "Goals"},
  y: {label: "Behinds"},
  marks: [
    Plot.dot(currentYearGames.map((d) => ({
      ...d,
      goals: d.hteam === teamName ? d.hgoals : d.agoals,
      behinds: d.hteam === teamName ? d.hbehinds : d.abehinds,
    })), {
      x: "goals",
      y: "behinds",
      fill: "result",
      r: 7,
      tip: true,
      title: (d) => `Rd ${d.round} vs ${d.opponent}\n${d.goals}.${d.behinds} (${d.teamScore}) — ${d.result}`,
    }),
    Plot.frame(),
  ],
  color: {domain: ["W", "L", "D"], range: [color, "#ccc", "#888"]},
})
```

</div>
</div>

---

## All Time

<div class="grid grid-cols-1" style="margin-top:1rem;">
<div class="card">

### Ladder Position — All Seasons

```js
Plot.plot({
  x: {label: "Round", tickFormat: "d", grid: true},
  y: {label: "Position", reverse: true, domain: [1, 18], tickFormat: "d"},
  color: {scheme: "blues", legend: true, label: "Season", tickFormat: "d"},
  marks: [
    Plot.line(teamStandings, {
      x: "round",
      y: "rank",
      stroke: "year",
      strokeWidth: 1.5,
      tip: true,
      title: (d) => `${d.year} Rd ${d.round}: #${d.rank}\n${d.pts} pts · ${Number(d.percentage).toFixed(1)}%`,
    }),
  ],
})
```

</div>
</div>

<div class="grid grid-cols-2" style="margin-top:1rem;">

```js
(function() {
  function rivalCard(rival, label, accent) {
    if (!rival) return html``;
    const oppColor = teamColor(rival.opponent);
    const oppLogo = logoMap[rival.opponent];
    const pct = rival.played > 0 ? ((rival.wins / rival.played) * 100).toFixed(0) : "—";
    return html`<div class="card rival-card" style="--accent:${accent}">
      <div class="rival-label">${label}</div>
      <div class="rival-body">
        ${oppLogo ? html`<img src="${oppLogo}" alt="${rival.opponent}" class="rival-logo">` : ""}
        <div class="rival-info">
          <div class="rival-name" style="color:${oppColor}">${rival.opponent}</div>
          <div class="rival-record">${rival.wins}W – ${rival.losses}L${rival.draws ? ` – ${rival.draws}D` : ""}</div>
          <div class="rival-pct">${pct}% win rate across ${rival.played} games</div>
        </div>
      </div>
    </div>`;
  }

  return html`${rivalCard(bestRival, "Favourite Opponent", color)}${rivalCard(worstRival, "Nemesis", "#888")}`;
})()
```

</div>

<style>
.rival-card { border-top: 4px solid var(--accent); }
.rival-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--theme-foreground-muted); margin-bottom: 0.75rem; }
.rival-body { display: flex; align-items: center; gap: 1rem; }
.rival-logo { width: 72px; height: 72px; object-fit: contain; flex-shrink: 0; }
.rival-name { font-size: 1.15rem; font-weight: 700; margin-bottom: 0.2rem; }
.rival-record { font-size: 1rem; font-weight: 600; }
.rival-pct { font-size: 0.82rem; color: var(--theme-foreground-muted); margin-top: 0.15rem; }
</style>
