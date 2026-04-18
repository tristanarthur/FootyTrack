---
title: Power Rankings
toc: false
---

```js
import {teamColor, teamColorDomain, teamColorRange} from "./components/teamColors.js";
```

```js
const power = FileAttachment("data/power.csv").csv({typed: true});
```

```js
const years = [...new Set(power.map((d) => d.year))].sort((a, b) => b - a);
const yearInput = Inputs.select(years, {label: "Season", value: years[0], format: (d) => String(d)});
const selectedYear = Generators.input(yearInput);
```

```js
const yearPower = power.filter((d) => d.year === selectedYear);

// Source names
const sources = [...new Set(yearPower.map((d) => d.sourceid))];
const sourceInput = Inputs.select(sources, {
  label: "Model",
  format: (d) => yearPower.find((r) => r.sourceid === d)?.source ?? `Model ${d}`,
});
const selectedSource = Generators.input(sourceInput);
```

```js
const sourcePower = yearPower.filter((d) => d.sourceid === selectedSource);
const maxRound = Math.max(...sourcePower.map((d) => d.round));
const latestRanking = sourcePower
  .filter((d) => d.round === maxRound)
  .sort((a, b) => a.rank - b.rank);
```

```js
// Highlight state — multi-select Set; resets when year or model changes
void selectedYear; void selectedSource;
const highlightInput = Object.assign(document.createElement("span"), {value: new Set()});
function highlightTeam(name) {
  const next = new Set(highlightInput.value);
  next.has(name) ? next.delete(name) : next.add(name);
  highlightInput.value = next;
  highlightInput.dispatchEvent(new Event("input"));
}
const highlighted = Generators.input(highlightInput);
```

<div style="display:flex; gap:1rem; align-items:center; flex-wrap:wrap;">
  ${yearInput}
  ${sourceInput}
</div>

<div class="grid grid-cols-1" style="margin-top:1rem;">
<div class="card">

## Power Rating Over Season

```js
(function() {
  const powerTeams = [...new Set(sourcePower.map((d) => d.team))].sort();
  const none = highlighted.size === 0;
  const isOn = (name) => none || highlighted.has(name);

  const legend = html`<div class="team-legend">${powerTeams.map((name) => {
    const isActive = highlighted.has(name);
    const isDim = !none && !isActive;
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
    y: {label: "Power rating"},
    color: {domain: teamColorDomain, range: teamColorRange},
    marks: [
      Plot.line(sourcePower, {
        x: "round",
        y: (d) => +d.power,
        stroke: "team",
        strokeWidth: (d) => isOn(d.team) ? 2.5 : 1,
        strokeOpacity: (d) => isOn(d.team) ? 1 : 0.08,
        tip: true,
        title: (d) => `${d.team}\nRound ${d.round}: ${(+d.power).toFixed(1)} (rank #${d.rank})`,
      }),
      Plot.dot(sourcePower.filter((d) => d.round === maxRound), {
        x: "round",
        y: (d) => +d.power,
        fill: (d) => teamColor(d.team),
        r: 4,
        fillOpacity: (d) => isOn(d.team) ? 1 : 0.08,
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

## Current Rankings — Round ${maxRound}

```js
Inputs.table(latestRanking, {
  columns: ["rank", "team", "power"],
  header: {rank: "#", team: "Team", power: "Rating"},
  format: {
    rank: (d) => `#${d}`,
    power: (d) => (+d).toFixed(1),
  },
  rows: 18,
  select: false,
})
```

</div>

<div class="card">

## Rating Distribution (Latest Round)

```js
Plot.plot({
  marginLeft: 140,
  height: 420,
  x: {label: "Power rating", grid: true},
  y: {label: null},
  marks: [
    Plot.barX(latestRanking, {
      x: (d) => +d.power,
      y: "team",
      sort: {y: "x", reverse: true},
      fill: (d) => teamColor(d.team),
      tip: true,
      title: (d) => `${d.team}\nRating: ${(+d.power).toFixed(1)} (#${d.rank})`,
    }),
    Plot.ruleX([50]),
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
