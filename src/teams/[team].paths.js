import {csvParse} from "d3-dsv";
import {readFileSync} from "node:fs";

const games = csvParse(readFileSync("data/games.csv", "utf-8"));
const teams = [...new Set(games.map((d) => d.hteam))].sort();

export default teams.map((team) => ({
  team: team.toLowerCase().replace(/\s+/g, "-"),
}));
