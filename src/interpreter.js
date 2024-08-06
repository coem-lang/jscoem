import { runtimeError, ReturnError } from "./errors.js";
import {
  Binary,
  Unary,
  Call,
  Literal,
  Logical,
  Var,
  Return,
  While,
  Block,
  CoemFunction,
  ExpressionStatement,
  VarStatement,
  Condition,
  Directive,
  Comment,
} from "./types.js";
import { Environment } from "./environment.js";
import { Tokenizer } from "./tokenizer.js";
const token = Tokenizer.tokenEnum;

const isTruthy = (val) => Boolean(val);
const isEqual = (a, b) => a === b;

class CoemCallable {
  constructor(declaration, closure) {
    this.declaration = declaration;
    this.closure = closure;
  }

  // call(interpreter, args) {
  call(interpreter, args, callee) {
    const env = new Environment(this.closure);
    for (let param = 0; param < this.declaration.params.length; param++) {
      env.set(this.declaration.params[param], args[param]);
    }
    try {
      interpreter.interpretBlock(this.declaration.bodyStatements, env);
    } catch (ret) {
      if (ret instanceof ReturnError) {
        return ret.value;
      } else {
        throw ret;
      }
    }
    return null;
  }

  toString() {
    return `<${this.declaration.name.lexeme}()>`;
  }
}
class Interpreter {
  // constructor(environment, printfunc = console.log) {
  constructor(environment, source) {
    // this.printfunction = printfunc;
    this.environment = environment || new Environment();

    this.source = source;
    this.echo = source;
    this.lines = [];
    const linesWhole = source.split("\n");
    for (let line of linesWhole) {
      if (line.trim().indexOf(" †") > -1) {
        this.lines.push(line.split(" †"));
      } else {
        this.lines.push([line]);
      }
    }

    const nativePrint = new CoemCallable(null, this.env);
    nativePrint.call = (interpreter, args, callee) => {
      let print = " ";
      let line = callee.name.startCoordinates.line - 1;
      if (args.length >= 1) {
        print += getArgPrint(args[0]);
        if (args.length > 1) {
          for (let i = 1; i < args.length; i++) {
            print += " " + getArgPrint(args[i]);
          }
        }
      }

      if (this.lines[line].length > 1) {
        this.lines[line][1] += print;
      } else {
        this.lines[line].push(print);
      }
    };

    const getArgPrint = (arg) => {
      if (Array.isArray(arg)) {
        return arg.join(", ");
      }
      return arg;
    };

    this.environment.setBuiltin("print", nativePrint);
    this.environment.setBuiltin("know", nativePrint);
    this.environment.setBuiltin("say", nativePrint);
  }

  interpret(expr) {
    return this.evaluate(expr);
  }

  evaluate(expr) {
    if (expr instanceof Block) return this.visitBlock(expr);
    else if (expr instanceof CoemFunction) return this.visitFunction(expr);
    else if (expr instanceof Logical) return this.visitLogical(expr);
    else if (expr instanceof Call) return this.visitCall(expr);
    else if (expr instanceof While) return this.visitWhile(expr);
    else if (expr instanceof Directive) return this.visitDirective(expr);
    else if (expr instanceof Condition) return this.visitCondition(expr);
    else if (expr instanceof VarStatement) return this.visitVarStatement(expr);
    else if (expr instanceof Return) return this.visitReturnStatement(expr);
    // Doesn't need its own, it can just evaluate like grouping
    else if (expr instanceof ExpressionStatement)
      return this.visitExpressionStmt(expr);
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
  // visitPrintStatement(expr) {
  //   console.log(expr);
  //   const val = this.evaluate(expr.expression);
  //   this.printfunction(val === null ? 'nothing' : val.toString());
  //   return val;
  // }

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

  visitDirective(expr) {
    this.environment.set(expr.name, expr.value);
    return null;
  }

  visitComment(expr) {
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
    if (variable.value !== null) {
      value = this.evaluate(variable.value);
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

  visitCall(expr) {
    const callee = this.evaluate(expr.callee);

    if (Array.isArray(callee)) callee = callee[0];

    let args = expr.arguments.map((arg) => this.evaluate(arg));

    if (!callee.call) {
      throw runtimeError("Can only call functions.", expr.dash);
    }

    return callee.call(this, args, expr.callee);
  }

  visitUnary(expr) {
    const right = this.evaluate(expr.right);
    switch (expr.operator.type) {
      case NOT:
        return !isTruthy(right);
    }
  }

  visitBinary(expr) {
    const left = this.evaluate(expr.left);
    const right = this.evaluate(expr.right);
    switch (expr.operator.type) {
      // Equality
      case token.IS:
      case token.AM:
      case token.ARE:
        return isEqual(left, right);
      // case token.BANG_EQUAL:
      //   return !isEqual(left, right);
    }
  }

  getEcho() {
    let echo = "";
    for (let i = 0; i < this.lines.length; i++) {
      if (this.lines[i].length > 1) {
        const line = this.lines[i].join(" †");
        echo += line;
      } else {
        echo += this.lines[i][0];
      }
      if (i < this.lines.length - 1) {
        echo += "\n";
      }
    }
    return echo;
  }
}

export { Interpreter };
