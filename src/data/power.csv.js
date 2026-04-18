import {readFile} from "node:fs/promises";
import {resolve} from "node:path";

function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = [];
    let cur = "", inQuote = false;
    for (const ch of line) {
      if (ch === '"') inQuote = !inQuote;
      else if (ch === "," && !inQuote) { values.push(cur); cur = ""; }
      else cur += ch;
    }
    values.push(cur);
    return Object.fromEntries(headers.map((h, i) => [h, values[i]?.trim() ?? ""]));
  });
}

const [powerRaw, sourcesRaw, teamsRaw] = await Promise.all([
  readFile(resolve(import.meta.dirname, "../../data/power.csv"), "utf8"),
  readFile(resolve(import.meta.dirname, "../../data/sources.csv"), "utf8"),
  readFile(resolve(import.meta.dirname, "../../data/teams.csv"), "utf8"),
]);

const sourceMap = Object.fromEntries(parseCSV(sourcesRaw).map((s) => [s.id, s.name]));
const teamMap = Object.fromEntries(parseCSV(teamsRaw).map((t) => [t.id, t.name]));

const cols = ["year", "round", "sourceid", "source", "teamid", "team", "rank", "power", "updated"];
const lines = [cols.join(",")];

for (const row of parseCSV(powerRaw)) {
  const source = row.source || sourceMap[row.sourceid] || `Model ${row.sourceid}`;
  const team = row.team || teamMap[row.teamid] || `Team ${row.teamid}`;
  lines.push([
    row.year, row.round, row.sourceid, source,
    row.teamid, team, row.rank, row.power, row.updated,
  ].join(","));
}

process.stdout.write(lines.join("\n") + "\n");
