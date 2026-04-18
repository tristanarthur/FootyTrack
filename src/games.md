---
title: Games
toc: false
---

```js
import {teamColor} from "./components/teamColors.js";
```

```js
const games = FileAttachment("data/games.csv").csv({typed: true});
```

```js
const years = [...new Set(games.map((d) => d.year))].sort((a, b) => b - a);
const yearInput = Inputs.select(years, {label: "Season", value: years[0], format: (d) => String(d)});
const selectedYear = Generators.input(yearInput);
```

```js
const yearGames = games.filter((d) => d.year === selectedYear);
const rounds = [...new Set(yearGames.map((d) => d.round))].sort((a, b) => a - b);
const roundInput = Inputs.select([null, ...rounds], {
  label: "Round",
  format: (d) => d == null ? "All rounds" : `Round ${d}`,
  value: null,
});
const selectedRound = Generators.input(roundInput);
```

```js
const filtered = yearGames
  .filter((d) => selectedRound == null || d.round === selectedRound)
  .filter((d) => d.complete === 100)
  .sort((a, b) => new Date(b.date) - new Date(a.date));
```

<div style="display:flex; gap:1rem; align-items:center; flex-wrap:wrap;">
  ${yearInput}
  ${roundInput}
</div>

<div class="grid grid-cols-1" style="margin-top:1rem;">
<div class="card">

## Results

```js
Inputs.table(filtered, {
  columns: ["round", "date", "hteam", "hscore", "ascore", "ateam", "winner", "venue"],
  header: {
    round: "Rd", date: "Date", hteam: "Home", hscore: "H Score",
    ascore: "A Score", ateam: "Away", winner: "Winner", venue: "Venue",
  },
  format: {
    date: (d) => d ? d.slice(0, 10) : "",
  },
  rows: 20,
  select: false,
})
```

</div>
</div>

<div class="grid grid-cols-2" style="margin-top:1rem;">
<div class="card">

## Margin Distribution

```js
Plot.plot({
  x: {label: "Winning margin (pts)", grid: true},
  y: {label: "Games"},
  marks: [
    Plot.rectY(
      filtered,
      Plot.binX(
        {y: "count"},
        {x: (d) => Math.abs(d.hscore - d.ascore), thresholds: 20, tip: true, fill: "steelblue"}
      )
    ),
    Plot.ruleY([0]),
  ],
})
```

</div>

<div class="card">

## Biggest Wins

```js
(function() {
  const top = [...filtered]
    .sort((a, b) => Math.abs(b.hscore - b.ascore) - Math.abs(a.hscore - a.ascore))
    .slice(0, 8);
  const withMargin = top.map((d) => ({...d, margin: Math.abs(d.hscore - d.ascore)}));
  return Inputs.table(withMargin, {
    columns: ["round", "winner", "margin", "hteam", "ateam"],
    header: {round: "Rd", winner: "Winner", margin: "Margin", hteam: "Home", ateam: "Away"},
    rows: 8,
    select: false,
  });
})()
```

</div>
</div>

<div class="grid grid-cols-1" style="margin-top:1rem;">
<div class="card">

## Home vs Away Win Rate

```js
(function() {
  const teams = [...new Set(filtered.flatMap((d) => [d.hteam, d.ateam]))].filter(Boolean).sort();
  const rows = teams.map((name) => {
    const home = filtered.filter((d) => d.hteam === name);
    const away = filtered.filter((d) => d.ateam === name);
    const homeWins = home.filter((d) => d.winner === name).length;
    const awayWins = away.filter((d) => d.winner === name).length;
    return {
      name,
      homeWin: home.length > 0 ? (homeWins / home.length * 100).toFixed(1) : "—",
      awayWin: away.length > 0 ? (awayWins / away.length * 100).toFixed(1) : "—",
      total: homeWins + awayWins,
    };
  }).sort((a, b) => b.total - a.total);
  return Inputs.table(rows, {
    columns: ["name", "total", "homeWin", "awayWin"],
    header: {name: "Team", total: "Total Wins", homeWin: "Home Win %", awayWin: "Away Win %"},
    rows: 18,
    select: false,
  });
})()
```

</div>
</div>
