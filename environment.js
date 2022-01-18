const { runtimeError } = require('./errors');

class Environment {
  constructor(enclosing) {
    this.values = new Map();
    this.enclosing = enclosing;
  }

  get(name) {
    // if (this.values.has(name.name.lexeme)) {
    //   return this.values.get(name.name.lexeme)
    // }
    // if (this.enclosing) return this.enclosing.get(name)
    // throw runtimeError(`Undefined variable "${name.name.lexeme}"`, name.name)
    const set = getSet(name.lexeme);
    if (set) {
      return set[1];
    }

    // if not found in this environment, try enclosing one
    // if (enclosing != null) return enclosing.get(name);
    if (this.enclosing) return this.enclosing.get(name);

    // if not found after recursively walking up the chain, throw error
    throw new runtimeError(name, `Undefined variable '${name.lexeme}'.`);
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

  set(name, value) {
    let pattern = new RegExp(name);
    let set = this.getSet(name);
    if (set) {
      return this.values.set(set[0], value);
    } else {
      return this.values.set(pattern, value);
    }
  }

  setBuiltin(name, func) {
    this.values.set(name, typeof func === 'function' ? { call: func } : func);
  }

  assign(name, value) {
    let set = this.getSet(name.lexeme);
    if (set) {
      return this.values.set(set[0], value);
    }

    // try enclosing env
    if (this.enclosing) {
      return this.enclosing.assign(name, value);
    }

    // throw after recursion
    throw runtimeError(`Undefined variable '"${name.lexeme}"'.`);
  }
}

module.exports = Environment;