import { runtimeError } from './errors.js';

class Environment {

  constructor(enclosing = null) {
    this.values = new Map();
    this.enclosing = enclosing;
  }

  get(token) {
    const set = this.getSet(token.name.lexeme);
    if (set) {
      return set[1];
    }

    // if not found in this environment, try enclosing one
    if (this.enclosing) return this.enclosing.get(token);

    // return the variable name as a string
    return token.name.lexeme;

    // if not found after recursively walking up the chain, throw error
    // throw runtimeError(`Undefined variable '${token.name.lexeme}'.`, token.name);
  }

  getSet(name) {
    // check each regex against name
    for (const [key, value] of this.values.entries()) {
      if (key.test(name)) {
        return [key, value];
      }
    }
    return null;
  }

  set(token, value) {
    return this.setNameValue(token.lexeme, value);
  }

  setNameValue(name, value) {
    if (name === "as" && value.literal === "palimpsest") {
      Environment.asPalimpsest = true;
      return;
    }

    let pattern = new RegExp(name);
    let set = this.getSet(name);

    // redefine in current environment
    if (set) {
      if (Environment.asPalimpsest) {
        let values = set[1];
        values.push(value);
      }
      return this.values.set(set[0], value);
    }

    if (this.enclosing) {
      let enclosingSet = this.enclosing.getSet(name);
      // redefine in enclosing environment
      if (enclosingSet) {
        return this.enclosing.setNameValue(name, value);
      }
    }

    // define new in current environment
    if (Environment.asPalimpsest) {
      return this.values.set(pattern, [value]);
    } else {
      return this.values.set(pattern, value);
    }
  }

  setBuiltin(name, func) {
    // this.values.set(name, typeof func === 'function' ? { call: func } : func);
    this.setNameValue(name, func);
  }
}

Environment.asPalimpsest = false;

export { Environment };