import fs from "node:fs";
import path from "node:path";
import { datasetSchema } from "../src/lib/types";

const outputPath = path.join(process.cwd(), "src/lib/data/synced-dataset.json");

const dataset = {
  version: `manual-${new Date().toISOString().slice(0, 10)}`,
  heroes: [],
  items: [],
  enemies: [],
  teamModifiers: [],
  scenarios: [],
};

const validated = datasetSchema.parse(dataset);
fs.writeFileSync(outputPath, JSON.stringify(validated, null, 2));

console.log(`Wrote ${outputPath}`);
console.log("Note: plug Google Sheet/wiki extraction into this script for repeatable ingestion.");
