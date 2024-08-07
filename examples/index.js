// $ .../index.js file-name.coem

import { readFile } from "fs/promises";
import { join } from "path";

import { run, Environment } from "../src/main.js";

const coemFileName = process.argv[2];

if (!coemFileName) {
  console.log("no coem file name provided");
  process.exit();
}

const coem = await readFile(join(import.meta.dirname, coemFileName), "utf8");

const debug = false;
try {
  const echo = await run(coem, new Environment(), debug);
  console.log(echo);
} catch (e) {
  console.error(e);
}
