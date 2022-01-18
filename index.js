const { run, Environment } = require("./src/coem.js");

const source = `let me be true`;

function handleError(e, source = "") {
  if (!e) return null;
  console.error(e);
}

function handleOutput(txt) {
  console.log(txt);
}

const browserEnv = new Environment();
try {
  run(source, browserEnv, handleOutput);
  handleError(null);
} catch (e) {
  handleError(e, source);
}