const { runtimeError, ReturnError } = require('./errors');
const {
  Binary,
  Unary,
  Call,
  Literal,
  Logical,
  Var,
  Return,
  While,
  Block,
  LoxFunction,
  ExpressionStatement,
  VarStatement,
  PrintStatement,
  Assignment,
  Condition
} = require('./types');
const Environment = require('./environment');
const tokenizer = require('./tokenizer');
const token = tokenizer.tokenEnum;

const isTruthy = val => Boolean(val);
const isEqual = (a, b) => a === b;
const checkNumber = (token, ...operands) => {
  for (let operand of operands) {
    if (isNaN(operand)) {
      throw runtimeError('Operand must be a number!', token);
    }
  }
};

class CoemCallable {;
  constructor(declaration, closure) {;
    this.declaration = declaration
    this.closure = closure
  }
;
  call(interpreter, args, isInit = false) {
 ;   const env = new Environment(this.closure);
    for (let param = 0; param < this.declaration.params.length; param++) {
      env.set(this.declaration.params[param], args[param]);;
    }
    try {
      interpreter.interpretBlock(this.declaration.bodyStatements, env);;
    } catch (ret) {
      if (ret instanceof ReturnError) {
        return ret.value;
      } else {
        throw ret;
      }
    }

    // Always return "this" if a function is an initializer
    if (isInit) return this.closure.get({ name: { lexeme: 'this' } })
    return null
  }

  bind(instance) {
    const env = new Environment(this.closure)
    env.set({ lexeme: 'this' }, instance)
    return new CoemCallable(this.declaration, env);
  };

  toString() {
    return `<${this.declaration.name.lexeme}()>`
  };
}
;
class Interpreter {
  constructor(environment, printfunc = console.log) {;
    this.printfunction = printfunc;
    this.environment = environment || new Environment();
    this.environment.setBuiltin('clock', () => new Date().getTime());;
  }

  interpret(expr) {
    return this.evaluate(expr);
  }

  evaluate(expr) {
    if (expr instanceof Block) return this.visitBlock(expr);
    else if (expr instanceof LoxFunction) return this.visitFunction(expr);
    else if (expr instanceof Assignment) return this.visitAssignment(expr);
    else if (expr instanceof Get) return this.visitGet(expr);
    else if (expr instanceof Set) return this.visitSet(expr);
    else if (expr instanceof Logical) return this.visitLogical(expr);
    else if (expr instanceof Call) return this.visitCall(expr);
    else if (expr instanceof While) return this.visitWhile(expr);
    else if (expr instanceof Condition) return this.visitCondition(expr);
    else if (expr instanceof VarStatement) return this.visitVarStatement(expr);
    else if (expr instanceof PrintStatement) return this.visitPrintStatement(expr);
    else if (expr instanceof Return) return this.visitReturnStatement(expr);
    // Doesn't need its own, it can just evaluate like grouping
    else if (expr instanceof ExpressionStatement) return this.visitExpressionStmt(expr);
    else if (expr instanceof Var) return this.visitVar(expr);
    else if (expr instanceof Literal) return this.visitLiteral(expr);
    else if (expr instanceof Unary) return this.visitUnary(expr);
    else if (expr instanceof Binary) return this.visitBinary(expr);
  }

  visitLiteral(expr) {
    return expr.value;
  }
  visitExpressionStmt(expr) {
    return this.evaluate(expr.expression);
  }
  visitPrintStatement(expr) {
    const val = this.evaluate(expr.expression);
    this.printfunction(val === null ? 'nil' : val.toString());
    return val;
  }

  visitFunction(expr) {
    const fn = new CoemCallable(expr, this.environment);
    this.environment.set(expr.name, fn);
  }

  visitLogical(expr) {
    const left = this.evaluate(expr.left);
    if (expr.operator.type === token.OR) {
      if (isTruthy(left)) return left;
    } else {
      if (!isTruthy(left)) return left;
    }

    return this.evaluate(expr.right);
  }

  visitWhile(expr) {
    while (isTruthy(this.evaluate(expr.condition))) {
      this.evaluate(expr.body);
    }
    return null;
  }

  visitReturnStatement(stmt) {
    var val = null;
    if (stmt.value) val = this.evaluate(stmt.value);

    throw new ReturnError(val);
  }

  visitVar(variable) {
    return this.environment.get(variable);
  }

  visitVarStatement(variable) {
    let value = null;
    if (variable.initializer !== null) {
      value = this.evaluate(variable.initializer);
    }
    this.environment.set(variable.name, value);
    return null;
  }

  visitBlock(expr) {
    this.interpretBlock(expr.statements, new Environment(this.environment));
    return null;
  }

  visitCondition(expr) {
    if (isTruthy(this.evaluate(expr.condition))) {
      this.evaluate(expr.thenBranch);
    } else if (expr.elseBranch) {
      this.evaluate(expr.elseBranch);
    }
    return null;
  }

  interpretBlock(statements, env) {
    const prevEnvironment = this.environment;
    try {
      this.environment = env;
      for (let stmt of statements) {
        this.interpret(stmt);
      }
      this.environment = prevEnvironment;
    } catch (e) {
      this.environment = prevEnvironment;
      throw e;
    }
  }

  visitAssignment(expr) {
    const value = this.evaluate(expr.value);
    this.environment.assign(expr.name, value);
    return value;
  }

  visitCall(expr) {
    const callee = this.evaluate(expr.callee);

    let args = expr.arguments.map(arg => this.evaluate(arg));

    if (!callee.call) {
      throw runtimeError('Can only call functions and classes.', expr.paren);
    }

    return callee.call(this, args)
  }

  visitUnary(expr) {
    const right = this.evaluate(expr.right);
    switch (expr.operator.type) {
      case token.MINUS:
        checkNumber(expr.operator, right);
        return -right;
      case token.BANG:
      case NOT:
        return !isTruthy(right);
    }
  }

  visitBinary(expr) {
    const left = this.evaluate(expr.left);
    const right = this.evaluate(expr.right);
    switch (expr.operator.type) {
      // Math
      case token.MINUS:
        checkNumber(expr.operator, right, left);
        return left - right;
      case token.PLUS:
        return left + right;
      case token.SLASH:
        checkNumber(expr.operator, right, left);
        return left / right;
      case token.STAR:
        checkNumber(expr.operator, right, left);
        return left * right;
      // Comparisons
      case token.GREATER:
        checkNumber(expr.operator, right, left);
        return left > right;
      case token.GREATER_EQUAL:
        checkNumber(expr.operator, right, left);
        return left >= right;
      case token.LESS:
        checkNumber(expr.operator, right, left);
        return left < right;
      case token.LESS_EQUAL:
        checkNumber(expr.operator, right, left);
        return left <= right;
      // Equality
      case token.EQUAL_EQUAL:
      case IS:
      case AM:
      case ARE:
        return isEqual(left, right);
      case token.BANG_EQUAL:
        return !isEqual(left, right);
    }
  }
}

module.exports = {
  Interpreter,
  LoxClass,
  LoxInstance
};