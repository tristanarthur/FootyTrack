---
title: Tips & Model Accuracy
toc: false
---

```js
const tips = FileAttachment("data/tips.csv").csv({typed: true});
```

```js
const years = [...new Set(tips.map((d) => d.year))].sort((a, b) => b - a);
const yearInput = Inputs.select(years, {label: "Season", value: years[0], format: (d) => String(d)});
const selectedYear = Generators.input(yearInput);
```

```js
const yearTips = tips.filter((d) => d.year === selectedYear && d.correct != null);

// Aggregate accuracy per source
const sourceStats = d3.rollup(
  yearTips,
  (v) => {
    const n = v.length;
    const correct = v.filter((d) => d.correct == 1).length;
    const bits = d3.mean(v, (d) => +d.bits) ?? 0;
    const rounds = [...new Set(v.map((d) => d.round))].sort((a, b) => a - b);
    return {
      n,
      correct,
      accuracy: (correct / n) * 100,
      bits,
      rounds,
    };
  },
  (d) => d.sourceid
);

// Map sourceid → name from the tips data
const sourceNames = Object.fromEntries(
  yearTips.map((d) => [d.sourceid, d.source ?? `Model ${d.sourceid}`])
);

const leaderboard = [...sourceStats.entries()].map(([id, s]) => ({
  sourceid: id,
  name: sourceNames[id] ?? `Model ${id}`,
  ...s,
})).sort((a, b) => b.accuracy - a.accuracy);
```

```js
// Highlight state — multi-select Set; resets when year changes
void selectedYear;
const highlightInput = Object.assign(document.createElement("span"), {value: new Set()});
function highlightSource(name) {
  const next = new Set(highlightInput.value);
  next.has(name) ? next.delete(name) : next.add(name);
  highlightInput.value = next;
  highlightInput.dispatchEvent(new Event("input"));
}
const highlighted = Generators.input(highlightInput);
```

${yearInput}

<div class="grid grid-cols-1" style="margin-top:1rem;">
<div class="card">

## Model Accuracy — ${selectedYear}

```js
(function() {
  const top15 = leaderboard.slice(0, 15);
  return Plot.plot({
    marginLeft: 8,
    height: top15.length * 38 + 40,
    x: {label: "Correct tips (%)", domain: [40, 80], grid: true},
    y: {label: null, axis: null},
    marks: [
      Plot.barX(top15, {
        x: "accuracy",
        y: "name",
        x1: 40,
        sort: {y: "x", reverse: true},
        fill: "steelblue",
        tip: true,
        title: (d) => `${d.name}\n${d.correct}/${d.n} correct (${d.accuracy.toFixed(1)}%)\nAvg bits: ${d.bits.toFixed(3)}`,
      }),
      Plot.text(top15, {
        x: 40.5,
        y: "name",
        text: "name",
        sort: {y: "x", reverse: true},
        textAnchor: "start",
        fill: "white",
        fontSize: 11,
      }),
      Plot.ruleX([50], {stroke: "var(--theme-foreground-fainter)", strokeDasharray: "4 2"}),
    ],
  });
})()
```

</div>
</div>

<div class="grid grid-cols-2" style="margin-top:1rem;">
<div class="card">

## Leaderboard Table

```js
Inputs.table(leaderboard, {
  columns: ["name", "correct", "n", "accuracy", "bits"],
  header: {name: "Model", correct: "Correct", n: "Tips", accuracy: "Accuracy %", bits: "Avg Bits"},
  format: {
    accuracy: (d) => d.toFixed(1) + "%",
    bits: (d) => d.toFixed(3),
  },
  sort: "accuracy",
  reverse: true,
  rows: 20,
  select: false,
})
```

</div>

<div class="card">

## Accuracy by Round

```js
(function() {
  // Build cumulative accuracy rows per source per round
  const byRoundSource = d3.rollup(
    yearTips,
    (v) => ({correct: v.filter((d) => d.correct == 1).length, n: v.length}),
    (d) => d.sourceid,
    (d) => d.round
  );
  const rows = [];
  for (const [sid, rounds] of byRoundSource) {
    let cumCorrect = 0, cumN = 0;
    for (const [round, {correct, n}] of [...rounds.entries()].sort((a, b) => a[0] - b[0])) {
      cumCorrect += correct;
      cumN += n;
      rows.push({source: sourceNames[sid] ?? `Model ${sid}`, round: +round, accuracy: (cumCorrect / cumN) * 100});
    }
  }

  // Fixed color assignment so legend and chart match
  const tableau10 = ["#4e79a7","#f28e2b","#e15759","#76b7b2","#59a14f","#edc948","#b07aa1","#ff9da7","#9c755f","#bab0ac"];
  const orderedSources = leaderboard.map((d) => d.name);
  const colorMap = Object.fromEntries(orderedSources.map((s, i) => [s, tableau10[i % 10]]));

  const none = highlighted.size === 0;
  const isOn = (name) => none || highlighted.has(name);

  const legend = html`<div class="team-legend">${orderedSources.map((name) => {
    const isActive = highlighted.has(name);
    const isDim = !none && !isActive;
    return html`<button
      class="legend-item${isActive ? " active" : isDim ? " dim" : ""}"
      style="--color:${colorMap[name]}"
      onclick=${() => highlightSource(name)}>
      <span class="legend-swatch"></span>${name}
    </button>`;
  })}</div>`;

  const chart = Plot.plot({
    x: {label: "Round", tickFormat: "d", grid: true},
    y: {label: "Cumulative accuracy (%)"},
    color: {domain: orderedSources, range: orderedSources.map((s) => colorMap[s])},
    marks: [
      Plot.line(rows, {
        x: "round",
        y: "accuracy",
        stroke: "source",
        strokeWidth: (d) => isOn(d.source) ? 2 : 1,
        strokeOpacity: (d) => isOn(d.source) ? 1 : 0.08,
        tip: true,
        title: (d) => `${d.source}\nRd ${d.round}: ${d.accuracy.toFixed(1)}%`,
      }),
      Plot.ruleY([50], {stroke: "red", strokeDasharray: "4 2"}),
    ],
  });

  return html`<div>${legend}${chart}</div>`;
})()
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
