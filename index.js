import { run, Environment } from './src/main.js';

const source = `nothing`;

function handleError(e, source = "") {
  if (!e) return null;
  console.error(e);
}

function handleOutput(...txt) {
  console.log(...txt);
}

const browserEnv = new Environment();
try {
  run(source, browserEnv, handleOutput);
  handleError(null);
} catch (e) {
  handleError(e, source);
}