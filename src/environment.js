const { runtimeError } = require('./errors');

class Environment {
  constructor(enclosing = null) {
    this.values = new Map();
    this.enclosing = enclosing;
  }

  get(name) {
    const set = this.getSet(name.lexeme);
    if (set) {
      return set[1];
    }

    // if not found in this environment, try enclosing one
    if (this.enclosing) return this.enclosing.get(name);

    // if not found after recursively walking up the chain, throw error
    throw runtimeError(name, `Undefined variable '${name.lexeme}'.`);
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

    // redefine in current environment
    if (set) {
      return this.values.set(set[0], value);
    }

    if (this.enclosing) {
      let enclosingSet = this.enclosing.getSet(name);
      // redefine in enclosing environment
      if (enclosingSet) {
        return this.enclosing.set(name, value);
      }
    }
    
    // define new in current environment
    return this.values.set(pattern, value);
  }

  setBuiltin(name, func) {
    // this.values.set(name, typeof func === 'function' ? { call: func } : func);
    this.set(name, func);
  }
}

module.exports = Environment;