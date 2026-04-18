import {readFile} from "node:fs/promises";
import {resolve} from "node:path";

// Minimal CSV parser (handles quoted fields)
function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = [];
    let cur = "", inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === "," && !inQuote) { values.push(cur); cur = ""; }
      else { cur += ch; }
    }
    values.push(cur);
    return Object.fromEntries(headers.map((h, i) => [h, values[i]?.trim() ?? ""]));
  });
}

const gamesPath = resolve(import.meta.dirname, "../../data/games.csv");
const raw = await readFile(gamesPath, "utf8");
const games = parseCSV(raw).map((d) => ({
  ...d,
  year: +d.year,
  round: +d.round,
  complete: +d.complete,
  hscore: +d.hscore,
  ascore: +d.ascore,
  margin: +d.margin,
  hgoals: +d.hgoals,
  agoals: +d.agoals,
}));

// Most recent completed year/round
const completed = games.filter((g) => g.complete === 100);
const byYear = {};
for (const g of completed) {
  if (!byYear[g.year] || g.round > byYear[g.year]) byYear[g.year] = g.round;
}
const currentYear = Math.max(...Object.keys(byYear).map(Number));
const currentRound = byYear[currentYear];

// Current round results
const currentRoundGames = games
  .filter((g) => g.year === currentYear && g.round === currentRound)
  .map(({id, date, hteam, ateam, hscore, ascore, winner, margin, venue, complete}) => ({
    id, date, hteam, ateam, hscore, ascore, winner, margin, venue, complete,
  }));

// Upcoming games (not yet complete)
const upcoming = games
  .filter((g) => g.complete < 100 && g.year === currentYear)
  .sort((a, b) => new Date(a.date) - new Date(b.date))
  .slice(0, 9)
  .map(({id, date, hteam, ateam, venue, round, roundname}) => ({
    id, date, hteam, ateam, venue, round, roundname,
  }));

process.stdout.write(
  JSON.stringify({currentYear, currentRound, lastUpdated: new Date().toISOString(), currentRoundGames, upcoming})
);
