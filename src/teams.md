---
title: Teams
toc: false
---

```js
import {teamColor, teamNames} from "./components/teamColors.js";
```

```js
const games = FileAttachment("data/games.csv").csv({typed: true});
const teams = FileAttachment("data/teams.csv").csv({typed: true});
```

```js
const logoMap = Object.fromEntries(
  teams.map((t) => [t.name, `https://squiggle.com.au${t.logo}`])
);
```

```js
const completedGames = games.filter((d) => d.complete === 100);
const years = [...new Set(completedGames.map((d) => d.year))].sort((a, b) => b - a);
```

```js
const yearInput = Inputs.select(years, {label: "Season", value: years[0], format: (d) => String(d)});
const selectedYear = Generators.input(yearInput);
```

```js
const seasonGames = completedGames.filter((d) => d.year === selectedYear);

const teamStats = teamNames.map((name) => {
  const home = seasonGames.filter((d) => d.hteam === name);
  const away = seasonGames.filter((d) => d.ateam === name);
  const all = [...home, ...away];
  const wins = all.filter((d) => d.winner === name).length;
  const losses = all.filter((d) => d.winner && d.winner !== name).length;
  const draws = all.filter((d) => !d.winner).length;
  return {name, wins, losses, draws, played: all.length};
});
```

```js
const allTimeStats = teamNames.map((name) => {
  const home = completedGames.filter((d) => d.hteam === name);
  const away = completedGames.filter((d) => d.ateam === name);
  const all = [...home, ...away];
  const wins = all.filter((d) => d.winner === name).length;
  const losses = all.filter((d) => d.winner && d.winner !== name).length;
  const draws = all.filter((d) => !d.winner).length;
  const winPct = all.length > 0 ? (wins / all.length * 100).toFixed(1) : "—";
  return {name, wins, losses, draws, played: all.length, winPct};
});
```

# Teams

```js
yearInput
```

```js
html`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-top:1rem;">${teamStats.map((t) => {
  const color = teamColor(t.name);
  const slug = t.name.toLowerCase().replace(/\s+/g, "-");
  const logo = logoMap[t.name];
  return html`<a href="teams/${slug}" class="card team-card" style="border-top:4px solid ${color};text-decoration:none;display:block;">
    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;">
      ${logo ? html`<img src="${logo}" alt="${t.name} logo" style="width:48px;height:48px;object-fit:contain;flex-shrink:0;">` : ""}
      <h3 style="margin:0;color:${color};">${t.name}</h3>
    </div>
    <div class="record">${t.wins}W – ${t.losses}L${t.draws ? ` – ${t.draws}D` : ""}</div>
    <div class="played">${t.played} games played</div>
  </a>`;
})}</div>`
```

## Season Summary

```js
Plot.plot({
  marginLeft: 140,
  height: 480,
  x: {label: "Wins", grid: true},
  y: {label: null},
  marks: [
    Plot.barX(teamStats, {
      x: "wins",
      y: "name",
      sort: {y: "x", reverse: true},
      fill: (d) => teamColor(d.name),
      tip: true,
      title: (d) => `${d.name}\n${d.wins}W ${d.losses}L · ${d.played} played`,
    }),
    Plot.ruleX([0]),
  ],
})
```

---

## All Time

```js
Inputs.table(allTimeStats, {
  columns: ["name", "played", "wins", "losses", "draws", "winPct"],
  header: {name: "Team", played: "Played", wins: "W", losses: "L", draws: "D", winPct: "Win %"},
  sort: "wins",
  reverse: true,
  rows: 18,
  select: false,
})
```

```js
Plot.plot({
  marginLeft: 140,
  height: 480,
  x: {label: "Wins", grid: true},
  y: {label: null},
  marks: [
    Plot.barX(allTimeStats, {
      x: "wins",
      y: "name",
      sort: {y: "x", reverse: true},
      fill: (d) => teamColor(d.name),
      tip: true,
      title: (d) => `${d.name}\n${d.wins}W ${d.losses}L${d.draws ? ` ${d.draws}D` : ""} · ${d.played} played · ${d.winPct}% win rate`,
    }),
    Plot.ruleX([0]),
  ],
})
```

<style>
.team-card { transition: box-shadow 0.15s; }
.team-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
.record { font-size: 1.1rem; font-weight: 700; margin: 0; }
.played { font-size: 0.85rem; color: var(--theme-foreground-muted); }
</style>
