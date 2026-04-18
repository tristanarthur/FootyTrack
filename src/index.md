---
title: FootyTrack
toc: false
---

```js
import {teamColor} from "./components/teamColors.js";
```

```js
const latest = FileAttachment("data/latest.json").json();
const standings = FileAttachment("data/standings.csv").csv({typed: true});
const teams = FileAttachment("data/teams.csv").csv({typed: true});
```

```js
const logoMap = Object.fromEntries(
  teams.map((t) => [t.name, `https://squiggle.com.au${t.logo}`])
);
```

```js
const currentYear = latest.currentYear;
const currentRound = latest.currentRound;
const currentStandings = standings.filter(
  (d) => d.year === currentYear && d.round === currentRound
).sort((a, b) => a.rank - b.rank);
```

```js
// Shared game card renderer — handles complete, live, and upcoming states
// events: optional array of SSE score events for live games
const gameCard = (g, events = []) => {
  const done = g.complete === 100;
  const live = g.complete > 0 && g.complete < 100;
  const hLogo = logoMap[g.hteam];
  const aLogo = logoMap[g.ateam];
  const hColor = teamColor(g.hteam);
  const aColor = teamColor(g.ateam);
  const hWon = done && g.winner === g.hteam;
  const aWon = done && g.winner === g.ateam;

  let score, meta;
  if (done) {
    score = `${g.hscore} – ${g.ascore}`;
    meta = `Margin: ${Math.abs(g.hscore - g.ascore)} pts · ${g.venue}`;
  } else if (live) {
    score = `${g.hscore ?? 0} – ${g.ascore ?? 0}`;
    meta = `${g.timestr ?? "In progress"} · ${g.venue}`;
  } else {
    const date = g.date ? new Date(g.date) : null;
    const dateStr = date
      ? date.toLocaleDateString("en-AU", {timeZone: "Australia/Melbourne", weekday: "short", month: "short", day: "numeric"})
      : "TBC";
    const timeStr = date
      ? date.toLocaleTimeString("en-AU", {timeZone: "Australia/Melbourne", hour: "2-digit", minute: "2-digit"})
      : "";
    score = "vs";
    meta = `${dateStr}${timeStr ? ` · ${timeStr}` : ""} · ${g.venue ?? ""}`;
  }

  // Last 5 scoring events, most recent first
  const recentEvents = [...events].slice(-5).reverse();
  const eventFeed = recentEvents.length > 0 ? html`
    <div class="event-feed">
      ${recentEvents.map((e) => {
        const isGoal = e.type === "goal";
        const sc = e.score ?? {};
        const hDisp = `${sc.hgoals ?? 0}.${sc.hbehinds ?? 0} (${sc.hscore ?? 0})`;
        const aDisp = `${sc.agoals ?? 0}.${sc.abehinds ?? 0} (${sc.ascore ?? 0})`;
        return html`<div class="event-row">
          <span class="event-time">${e.timestr ?? ""}</span>
          <span class="event-team-name" style="color:${teamColor(e.teamName ?? "")}">${e.teamName ?? ""}</span>
          <span class="event-badge ${isGoal ? "event-goal" : "event-behind"}">${isGoal ? "GOAL" : "behind"}</span>
          <span class="event-score">${hDisp} – ${aDisp}</span>
        </div>`;
      })}
    </div>
  ` : "";

  return html`<div class="game-card${live ? " game-card--live" : ""}">
    <div class="game-teams">
      <div class="game-team" style="--c:${hColor};opacity:${done && !hWon ? 0.45 : 1}">
        ${hLogo ? html`<img src="${hLogo}" alt="${g.hteam}" class="team-logo-sm">` : ""}
        <span>${g.hteam}</span>
      </div>
      <div class="game-score">
        ${live ? html`<span class="live-pill">●&nbsp;LIVE</span>` : ""}
        ${score}
      </div>
      <div class="game-team away" style="--c:${aColor};opacity:${done && !aWon ? 0.45 : 1}">
        ${aLogo ? html`<img src="${aLogo}" alt="${g.ateam}" class="team-logo-sm">` : ""}
        <span>${g.ateam}</span>
      </div>
    </div>
    <div class="meta">${meta}</div>
    ${eventFeed}
  </div>`;
};
```

```js
// Single generator: adaptive polling + persistent SSE connections for live events.
// - Polls live games every 60s while games are on, every 5 min when idle.
// - Refreshes upcoming fixtures at most once every 15 min (they rarely change).
// - SSE handles real-time scoring; HTTP polls only discover which games are live.
const squiggle = Generators.observe((notify) => {
  let active = true;
  let state = {live: [], upcoming: [], eventsByGame: {}, fetchedAt: null, error: false};
  const sources = new Map(); // gameId → EventSource

  const LIVE_MS     =      60_000; // 60 s  — while games are in progress
  const IDLE_MS     =   5 * 60_000; // 5 min — nothing live
  const UPCOMING_MS =  15 * 60_000; // 15 min — upcoming fixtures

  let lastUpcomingFetch = 0;

  function openSource(game) {
    if (sources.has(game.id)) return;
    const es = new EventSource(`https://sse.squiggle.com.au/events/${game.id}`);
    es.addEventListener("score", (evt) => {
      const d = JSON.parse(evt.data);
      const teamName = d.side === "hteam" ? game.hteam : game.ateam;
      const prev = state.eventsByGame[game.id] ?? [];
      const next = [...prev, {...d, teamName}].slice(-5);
      state = {...state, eventsByGame: {...state.eventsByGame, [game.id]: next}};
      notify(state);
    });
    sources.set(game.id, es);
  }

  function pruneClosedGames(liveIds) {
    for (const [id, es] of sources) {
      if (!liveIds.has(id)) { es.close(); sources.delete(id); }
    }
  }

  async function poll() {
    const now = Date.now();
    const needUpcoming = (now - lastUpcomingFetch) >= UPCOMING_MS;

    try {
      const requests = [fetch(`https://api.squiggle.com.au/?q=games;year=${currentYear};live=1`)];
      if (needUpcoming) requests.push(fetch(`https://api.squiggle.com.au/?q=games;year=${currentYear};complete=0`));

      const [liveRes, upcomingRes] = await Promise.all(requests);
      const live = liveRes.ok ? ((await liveRes.json()).games ?? []) : [];
      const upcoming = needUpcoming
        ? (upcomingRes?.ok ? ((await upcomingRes.json()).games ?? []) : state.upcoming)
        : state.upcoming;
      if (needUpcoming) lastUpcomingFetch = now;

      const liveIds = new Set(live.map((g) => g.id));
      pruneClosedGames(liveIds);
      live.forEach((g) => openSource(g));

      const eventsByGame = Object.fromEntries(live.map((g) => [g.id, state.eventsByGame[g.id] ?? []]));
      state = {live, upcoming, eventsByGame, fetchedAt: new Date(), error: false};
      notify(state);
    } catch {
      state = {...state, fetchedAt: new Date(), error: true};
      notify(state);
    }

    if (active) setTimeout(poll, state.live.length > 0 ? LIVE_MS : IDLE_MS);
  }

  poll();
  return () => { active = false; sources.forEach((es) => es.close()); };
});
```

<div class="hero">
  <h1>FootyTrack</h1>
  <p>AFL stats and insights · ${currentYear} Season · Round ${currentRound}</p>
  <p class="muted small">Last updated: ${new Date(latest.lastUpdated).toLocaleString("en-AU", {timeZone: "Australia/Melbourne", dateStyle: "medium", timeStyle: "short"})}</p>
</div>

```js
// Live / upcoming section — driven by Squiggle API
(function() {
  if (!squiggle) return html`<div class="card live-card"><p class="muted small" style="margin:0">Loading live scores…</p></div>`;

  const {live, upcoming, fetchedAt, error} = squiggle;

  // Next incomplete round from upcoming
  const nextRound = upcoming.length > 0 ? Math.min(...upcoming.map((g) => g.round)) : null;
  const nextGames = upcoming.filter((g) => g.round === nextRound)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const hasLive = live.length > 0;
  if (!hasLive && nextGames.length === 0) return html``;

  const updatedStr = fetchedAt
    ? fetchedAt.toLocaleTimeString("en-AU", {timeZone: "Australia/Melbourne", hour: "2-digit", minute: "2-digit"})
    : "";

  const games = hasLive
    ? [...live].sort((a, b) => a.round - b.round)
    : nextGames;

  const heading = hasLive
    ? html`<span>Round ${live[0]?.round} <span class="live-heading-pill">● LIVE</span></span>`
    : html`<span>Round ${nextRound} — Upcoming</span>`;

  return html`<div class="card live-card" style="margin-top:1.5rem;">
    <div class="live-card-header">
      <strong>${heading}</strong>
      <span class="muted small">${error ? "⚠ fetch error" : `Updated ${updatedStr}`}</span>
    </div>
    <div class="game-list">${games.map((g) => gameCard(g, squiggle.eventsByGame?.[g.id] ?? []))}</div>
  </div>`;
})()
```

<div class="grid grid-cols-2" style="margin-top: 1rem; align-items: start; grid-auto-rows: auto;">

<div class="card">

## Current Ladder

```js
Plot.plot({
  marginLeft: 160,
  height: 400,
  x: {label: "Points", grid: true},
  y: {label: null},
  marks: [
    Plot.barX(currentStandings, {
      x: "pts",
      y: "name",
      sort: {y: "x", reverse: true},
      fill: (d) => teamColor(d.name),
      tip: true,
      title: (d) => `${d.name}\n${d.pts} pts · ${d.wins}W ${d.losses}L · ${d.percentage.toFixed(1)}%`,
    }),
    Plot.ruleX([0]),
  ],
})
```

</div>

<div class="card">

## Round ${currentRound} Results & Upcoming

```js
(function() {
  const results = latest.currentRoundGames;
  const upcoming = (latest.upcoming ?? []).filter((g) => g.round > currentRound);
  const byRound = d3.group(upcoming, (d) => d.round);

  return html`<div class="game-list">
    ${results.map((g) => gameCard(g))}
    ${byRound.size > 0 ? [...byRound.entries()].map(([round, games]) => html`
      <div class="round-divider">Round ${round}</div>
      ${games.map((g) => gameCard(g))}
    `) : ""}
  </div>`;
})()
```

</div>

</div>

<style>
.hero { text-align: center; padding: 2rem 0 1rem; }
.hero h1 { font-size: 3rem; font-weight: 800; margin: 0; }
.hero p { margin: 0.25rem 0; font-size: 1.1rem; color: var(--theme-foreground-muted); }
.muted { color: var(--theme-foreground-muted) !important; }
.small { font-size: 0.85rem !important; }

/* Game cards */
.game-list { display: flex; flex-direction: column; gap: 0.5rem; }
.game-card { padding: 0.6rem 0.8rem; border-radius: 6px; background: var(--theme-background-alt); }
.game-card--live { border-left: 3px solid #e63; }
.game-teams { display: flex; align-items: center; gap: 0.5rem; font-weight: 600; }
.game-team { display: flex; align-items: center; gap: 0.4rem; flex: 1; color: var(--c, inherit); transition: opacity 0.15s; }
.game-team.away { flex-direction: row-reverse; text-align: right; }
.game-score { display: flex; flex-direction: column; align-items: center; gap: 0.15rem; font-variant-numeric: tabular-nums; color: var(--theme-foreground-muted); flex-shrink: 0; padding: 0 0.4rem; font-size: 0.9rem; }
.meta { font-size: 0.8rem; color: var(--theme-foreground-muted); margin-top: 0.2rem; }
.round-divider { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--theme-foreground-muted); padding: 0.4rem 0 0.1rem; border-top: 1px solid var(--theme-foreground-faintest); margin-top: 0.25rem; }
.team-logo-sm { width: 24px; height: 24px; object-fit: contain; flex-shrink: 0; }

/* Live badges */
.live-pill { font-size: 0.65rem; font-weight: 700; color: #e63; letter-spacing: 0.04em; animation: livepulse 1.4s ease-in-out infinite; display: block; }
.live-heading-pill { font-size: 0.8rem; font-weight: 700; color: #e63; animation: livepulse 1.4s ease-in-out infinite; }
@keyframes livepulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

/* Live card */
.live-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }

/* Scoring event feed */
.event-feed { margin-top: 0.5rem; border-top: 1px solid var(--theme-foreground-faintest); padding-top: 0.4rem; display: flex; flex-direction: column; gap: 0.2rem; }
.event-row { display: grid; grid-template-columns: 6rem 1fr auto auto; align-items: center; gap: 0.5rem; font-size: 0.78rem; }
.event-time { color: var(--theme-foreground-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.event-team-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.event-badge { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.04em; padding: 0.1rem 0.35rem; border-radius: 3px; white-space: nowrap; }
.event-goal { background: #2a7a2a22; color: #2a7; }
.event-behind { background: var(--theme-foreground-faintest); color: var(--theme-foreground-muted); }
.event-score { font-variant-numeric: tabular-nums; color: var(--theme-foreground-muted); white-space: nowrap; font-size: 0.75rem; }
</style>
