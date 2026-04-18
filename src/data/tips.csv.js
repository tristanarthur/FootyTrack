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

const [tipsRaw, sourcesRaw] = await Promise.all([
  readFile(resolve(import.meta.dirname, "../../data/tips.csv"), "utf8"),
  readFile(resolve(import.meta.dirname, "../../data/sources.csv"), "utf8"),
]);

const sourceMap = Object.fromEntries(parseCSV(sourcesRaw).map((s) => [s.id, s.name]));
const tips = parseCSV(tipsRaw);

const cols = ["gameid", "sourceid", "source", "year", "round", "hteamid", "ateamid",
              "tipteamid", "tip", "margin", "confidence", "correct", "bits", "updated"];
const lines = [cols.join(",")];

for (const row of tips) {
  const source = row.source || sourceMap[row.sourceid] || `Model ${row.sourceid}`;
  lines.push(cols.map((c) => {
    const v = c === "source" ? source : (row[c] ?? "");
    return String(v).includes(",") ? `"${v}"` : v;
  }).join(","));
}

process.stdout.write(lines.join("\n") + "\n");
