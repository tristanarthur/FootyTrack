---
title: Ladder
toc: false
---

```js
import {teamColor, teamColorDomain, teamColorRange} from "./components/teamColors.js";
```

```js
const standings = FileAttachment("data/standings.csv").csv({typed: true});
```

```js
const years = [...new Set(standings.map((d) => d.year))].sort((a, b) => b - a);
const yearInput = Inputs.select(years, {label: "Season", value: years[0], format: (d) => String(d)});
const selectedYear = Generators.input(yearInput);
```

```js
const yearStandings = standings.filter((d) => d.year === selectedYear);
const maxRound = Math.max(...yearStandings.map((d) => d.round));
const currentStandings = yearStandings
  .filter((d) => d.round === maxRound)
  .sort((a, b) => a.rank - b.rank);
```

```js
// Highlight state — resets automatically when year changes
void selectedYear;
const highlightInput = Object.assign(document.createElement("span"), {value: null});
function highlightTeam(name) {
  highlightInput.value = highlightInput.value === name ? null : name;
  highlightInput.dispatchEvent(new Event("input"));
}
const highlighted = Generators.input(highlightInput);
```

${yearInput}

<div class="grid grid-cols-1" style="margin-top:1rem;">
<div class="card">

## Ladder Position Over the Season

```js
(function() {
  const legend = html`<div class="team-legend">${teamColorDomain.map((name) => {
    const isActive = highlighted === name;
    const isDim = highlighted !== null && !isActive;
    return html`<button
      class="legend-item${isActive ? " active" : isDim ? " dim" : ""}"
      style="--color:${teamColor(name)}"
      onclick=${() => highlightTeam(name)}>
      <span class="legend-swatch"></span>${name}
    </button>`;
  })}</div>`;

  const chart = Plot.plot({
    height: 480,
    marginLeft: 140,
    x: {label: "Round", tickFormat: "d", grid: true},
    y: {label: "Position", reverse: true, domain: [1, 18], tickFormat: "d"},
    color: {domain: teamColorDomain, range: teamColorRange},
    marks: [
      Plot.line(yearStandings, {
        x: "round",
        y: "rank",
        stroke: "name",
        strokeWidth: (d) => highlighted === null || d.name === highlighted ? 2.5 : 1,
        strokeOpacity: (d) => highlighted === null || d.name === highlighted ? 1 : 0.08,
        tip: true,
        title: (d) => `${d.name}\nRound ${d.round}: #${d.rank}\n${d.pts} pts · ${d.percentage.toFixed(1)}%`,
      }),
      Plot.dot(yearStandings.filter((d) => d.round === maxRound), {
        x: "round",
        y: "rank",
        fill: (d) => teamColor(d.name),
        r: 4,
        fillOpacity: (d) => highlighted === null || d.name === highlighted ? 1 : 0.08,
      }),
    ],
  });

  return html`<div>${legend}${chart}</div>`;
})()
```

</div>
</div>

<div class="grid grid-cols-2" style="margin-top:1rem;">
<div class="card">

## Current Standings — Round ${maxRound}

```js
Inputs.table(currentStandings, {
  columns: ["rank", "name", "played", "wins", "losses", "draws", "pts", "percentage"],
  header: {
    rank: "#", name: "Team", played: "P", wins: "W", losses: "L",
    draws: "D", pts: "Pts", percentage: "%",
  },
  format: {
    percentage: (d) => d.toFixed(1),
    rank: (d) => `#${d}`,
  },
  sort: "rank",
  rows: 18,
  select: false,
})
```

</div>

<div class="card">

## Points vs Percentage

```js
Plot.plot({
  grid: true,
  x: {label: "Points"},
  y: {label: "Percentage (%)"},
  color: {domain: teamColorDomain, range: teamColorRange},
  marks: [
    Plot.dot(currentStandings, {
      x: "pts",
      y: "percentage",
      fill: (d) => teamColor(d.name),
      r: 7,
      tip: true,
      title: (d) => `${d.name}\n#${d.rank} · ${d.pts} pts · ${d.percentage.toFixed(1)}%`,
    }),
    Plot.text(currentStandings, {
      x: "pts",
      y: "percentage",
      text: "name",
      dy: -12,
      fontSize: 10,
    }),
  ],
})
```

</div>
</div>

<style>
.team-legend { display: flex; flex-wrap: wrap; gap: 0.3rem 0.4rem; margin-bottom: 0.75rem; }
.legend-item { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.5rem 0.2rem 0.4rem; border-radius: 4px; border: 1px solid transparent; background: transparent; cursor: pointer; font-size: 0.8rem; color: inherit; transition: opacity 0.15s, background 0.15s; }
.legend-item .legend-swatch { width: 18px; height: 3px; background: var(--color); border-radius: 2px; display: inline-block; flex-shrink: 0; }
.legend-item.dim { opacity: 0.25; }
.legend-item.active { background: color-mix(in srgb, var(--color) 15%, transparent); border-color: color-mix(in srgb, var(--color) 40%, transparent); font-weight: 600; }
</style>
