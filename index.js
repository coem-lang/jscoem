const { run, Environment } = require("./src/coem.js");

const source = `let me be true`;

function handleError(e, source = "") {
  console.error(e);
}

function handleOutput(txt) {
  output += txt + '\n';
  console.log(txt);
}

const browserEnv = new Environment();
try {
  console.log(source);
  run(source, browserEnv, handleOutput);
  handleError(null);
} catch (e) {
  handleError(e, source);
}