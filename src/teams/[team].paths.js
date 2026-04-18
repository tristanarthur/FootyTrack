import {readFileSync} from "node:fs";
import {join} from "node:path";

const csv = readFileSync(join(process.cwd(), "data/games.csv"), "utf-8");
const [header, ...rows] = csv.trim().split("\n");
const hteamIdx = header.split(",").indexOf("hteam");
const teams = [...new Set(rows.map((r) => r.split(",")[hteamIdx]))].filter(Boolean).sort();

export default teams.map((team) => ({
  team: team.toLowerCase().replace(/\s+/g, "-"),
}));
