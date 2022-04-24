// adapted from YALI.js by Daniel Berezin (danman113)
// https://github.com/danman113/YALI.js

import { Tokenizer } from './tokenizer.js';
import { Parser } from './parser.js';
import { Interpreter } from './interpreter.js';
import { Environment } from './environment.js';

function run(code, environment, printfn, debug = false) {
  const tokenizer = new Tokenizer(code);
  const tokens = tokenizer.scanTokens();
  // if (debug) console.log(tokens);
  const parser = new Parser(tokens);
  const statements = parser.parse();
  if (debug) console.log(statements);
  const interpreter = new Interpreter(environment, printfn);
  let lastStatement;
  for (let statement of statements) {
    lastStatement = interpreter.interpret(statement);
  }
  return lastStatement;
}

function parse(code) {
  const tokenizer = new Tokenizer(code);
  const tokens = tokenizer.scanTokens();
  const parser = new Parser(tokens);
  const statements = parser.parse();
  return statements;
}

export { formatCoemError } from './errors.js';
export {
  run,
  parse,
  Parser,
  Tokenizer,
  Interpreter,
  Environment
};