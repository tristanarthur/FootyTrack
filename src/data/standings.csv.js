import {readFile} from "node:fs/promises";
import {resolve} from "node:path";

const path = resolve(import.meta.dirname, "../../data/standings.csv");
process.stdout.write(await readFile(path, "utf8"));
