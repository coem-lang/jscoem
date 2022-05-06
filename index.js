import { run, Environment } from './src/main.js';

const source = `know—“something”—`;

function handleError(e, source = "") {
  if (!e) return null;
  console.error(e);
}

function handleOutput(...txt) {
  console.log(...txt);
}

const browserEnv = new Environment();
try {
  // console.log(run(source, browserEnv, handleOutput, false));
  let echo = run(source, browserEnv, false);
  console.log(echo);
  handleError(null);
} catch (e) {
  handleError(e, source);
}