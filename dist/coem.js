const nullable = str => (str ? str : '');

class CoemError {
  constructor(msg, startCoordinates, endCoordinates) {
    this.msg = msg;
    this.startCoordinates = startCoordinates;
    this.endCoordinates = endCoordinates;
  }

  toString() {
    return this.msg;
  }
}

class RuntimeError extends CoemError {
  constructor(msg, token) {
    super(
      `${nullable(token.lexeme && `at "${token.lexeme}": `)}${msg}`,
      token.startCoordinates,
      token.endCoordinates
    );
  }
}

class ReturnError {
  constructor(val) {
    this.value = val;
  }
}

const parseError = (msg, token) => {
  if (token.type === token.EOF) {
    return new CoemError(msg, token.startCoordinates, token.endCoordinates);
  } else {
    return new CoemError(
      `${nullable(token.lexeme && `at "${token.lexeme}": `)}${msg}`,
      token.startCoordinates,
      token.endCoordinates
    );
  }
};

const runtimeError = (msg, token) => new RuntimeError(msg, token);

const formatCoemError = (e, code) => {
  if (e instanceof CoemError) {
    const frontIndex = code.lastIndexOf('\n', e.startCoordinates.index);
    const preErrorStart = frontIndex < 0 ? 0 : frontIndex;
    const preErrorSection = code.substring(preErrorStart, e.startCoordinates.index);

    // Error String
    const errorSection = code.substring(e.startCoordinates.index, e.endCoordinates.index);

    // Post Error String
    const backIndex = code.indexOf('\n', e.endCoordinates.index);
    const postErrorStart = backIndex < 0 ? code.length : backIndex;
    const postErrorSection = code.substring(e.endCoordinates.index, postErrorStart);

    // Print Critical Code
    const errorType = e instanceof RuntimeError ? 'Runtime Error' : 'Parse Error';
    return {
      oneLiner: `${errorType}: ${e.toString()} at ${e.endCoordinates.line}:${e.endCoordinates.col +
        1}`,
      preErrorSection,
      errorSection,
      postErrorSection
    };
  } else {
    return {
      oneLiner: `Unexpected javascript Error: ${e}`
    };
  }
};

const noop = () => {};

const tokens = `
  COLON,
  COMMA, DOT,
  EMDASH,
  AMPERSAND,
  POUND,
  DAGGER,

  IDENTIFIER, STRING,
  COMMENT,

  AND, OR,
  IS, AM, ARE,
  IF, ELSE, WHILE,
  LET, BE,
  TO, 
  TRUE, FALSE, NOTHING,
  NOT,

  THIS, HERE, NOW,

  NEWLINE,

  EOF
`
  .split(',')
  .map(token => token.trim());

let tokenEnum = {};
tokens.forEach((token, i) => {
  tokenEnum[token] = i;
});

const keywords = {
  and: tokenEnum.AND,
  or: tokenEnum.OR,
  is: tokenEnum.IS,
  am: tokenEnum.AM,
  are: tokenEnum.ARE,
  not: tokenEnum.NOT,
  true: tokenEnum.TRUE,
  false: tokenEnum.FALSE,
  nothing: tokenEnum.NOTHING,
  let: tokenEnum.LET,
  be: tokenEnum.BE,
  to: tokenEnum.TO,
  if: tokenEnum.IF,
  else: tokenEnum.ELSE,
  while: tokenEnum.WHILE,
};

const tokenMap = {
  '—': tokenizer => {
    tokenizer.addToken(tokenEnum.EMDASH);
  },
  ':': tokenizer => {
    tokenizer.addToken(tokenEnum.COLON);
  },
  ',': tokenizer => {
    tokenizer.addToken(tokenEnum.COMMA);
  },
  '.': tokenizer => {
    tokenizer.addToken(tokenEnum.DOT);
  },
  '&': tokenizer => {
    tokenizer.addToken(tokenEnum.AMPERSAND);
  },
  '#': tokenizer => {
    tokenizer.addToken(tokenEnum.POUND);
  },
  '†': tokenizer => {
    // comments
    // while (tokenizer.peek() !== '\n' && tokenizer.peek() !== '') tokenizer.advance();
    tokenizer.handleComments();
  },
  ' ': noop,
  '\t': noop,
  '\r': noop,
  '\n': tokenizer => {
    tokenizer.addToken(tokenEnum.NEWLINE);
    tokenizer.newline();
  },
  '“': tokenizer => {
    tokenizer.handleStringLiterals();
  }
};

// const isAlpha = str => /[a-zA-Z_]/.test(str)
// const isAlphaNumeric = str => isAlpha(str) || isDigit(str)

const isIdentifierChar = (c) => {
  return (
    (c >= 'A' && c <= 'Z') ||
    (c >= 'a' && c <= 'z') ||
    (c == '(' || c == ')') ||
    (c == '[' || c == ']') ||
    (c == '|' || c == '?' || c == '*' || c == '+')
  );
};

class Tokenizer {
  static get tokens() {
    return tokens;
  }

  static get tokenEnum() {
    return tokenEnum;
  }
  constructor(source) {
    this.source = source;
    this.length = source.length;
    this.tokens = [];
    this.startPosition = null;
    this.column = 0;
    this.start = 0;
    this.line = 1;
    this.current = 0;
  }

  handleStringLiterals() {
    while (this.peek() !== '”' && this.peek() !== '') {
      if (this.peek() === '\n') this.newline();
      this.advance();
    }

    if (this.peek() === '') {
      throw new CoemError('Unfinished string', this.startPosition, this.endPosition);
    }

    // The closing ".
    this.advance();

    // Trim the surrounding quotes.
    const value = this.source.substring(this.start + 1, this.current - 1);
    this.addToken(tokenEnum.STRING, value);
  }

  handleComments() {
    this.addToken(tokenEnum.DAGGER);

    while (this.peek() !== '\n' && this.peek() !== '') {
      this.advance();
    }

    const text = this.source.substring(this.start + 1, this.current);
    this.addToken(tokenEnum.STRING, text);
  }

  handleIdentifiers() {
    while (isIdentifierChar(this.peek())) this.advance();
    const value = this.source.substring(this.start, this.current);
    if (keywords[value]) {
      this.addToken(keywords[value], value);
    } else {
      this.addToken(tokenEnum.IDENTIFIER, value);
    }
  }

  scanTokens() {
    while (this.current < this.length) {
      const c = this.advance();
      this.startPosition = new Coordinate(this.column - 1, this.line, this.current - 1);
      if (!tokenMap[c]) {
        if (isIdentifierChar(c)) {
          this.handleIdentifiers();
        } else {
          // Column isn't -1 because we haven't iterated column yet
          throw new CoemError(
            `Unexpected character ${c}`,
            this.startPosition,
            new Coordinate(this.column, this.line, this.current)
          );
        }
      } else {
        tokenMap[c](this);
      }
      this.start = this.current;
    }
    this.addToken(tokenEnum.EOF);
    return this.tokens;
  }

  get endPosition() {
    return new Coordinate(this.column - 1, this.line, this.current);
  }

  addToken(type, literal = null) {
    const text = this.source.substring(this.start, this.current);
    this.tokens.push(
      new Token(
        type,
        text,
        literal,
        new Coordinate(this.column, this.line, this.current),
        this.startPosition
      )
    );
  }

  increment() {
    this.current++;
    this.column++;
  }

  newline() {
    this.line++;
    this.column = 0;
  }

  advance() {
    this.increment();
    return this.source.charAt(this.current - 1);
  }

  peek() {
    return this.source.charAt(this.current);
  }

  nextMatch(expected) {
    if (this.peek() !== expected) return false;
    this.increment();
    return true;
  }
}

class Coordinate {
  constructor(col, line, index) {
    this.col = col;
    this.line = line;
    this.index = index;
  }
}

class Token {
  constructor(type, lexeme, literal, endCoordinates, startCoordinates) {
    this.type = type;
    this.lexeme = lexeme;
    this.literal = literal;
    this.startCoordinates = startCoordinates;
    this.endCoordinates = endCoordinates;
  }
}

class Binary {
  constructor(left, operator, right) {
    this.left = left;
    this.operator = operator;
    this.right = right;
  }
}

class Logical extends Binary {}

class Unary {
  constructor(operator, right) {
    this.operator = operator;
    this.right = right;
  }
}

class Literal {
  constructor(value) {
    this.value = value;
  }
}

class Var {
  constructor(name) {
    this.name = name;
  }
}

class ExpressionStatement {
  constructor(expression) {
    this.expression = expression;
  }
}

class VarStatement {
  constructor(name, value) {
    this.name = name;
    this.value = value;
  }
}

class Block {
  constructor(statements) {
    this.statements = statements;
  }
}

class Condition {
  constructor(condition, thenBranch, elseBranch) {
    this.condition = condition;
    this.thenBranch = thenBranch;
    this.elseBranch = elseBranch;
  }
}

class While {
  constructor(condition, body) {
    this.condition = condition;
    this.body = body;
  }
}

class Call {
  constructor(callee, dash, args) {
    this.callee = callee;
    this.dash = dash;
    this.arguments = args;
  }
}

class Return {
  constructor(keyword, value) {
    this.keyword = keyword;
    this.value = value;
  }
}

class CoemFunction {
  constructor(name, params, bodyStatements) {
    this.name = name;
    this.params = params;
    this.bodyStatements = bodyStatements;
  }
}

class Directive {
  constructor(name, value) {
    this.name = name;
    this.value = value;
  }
}

class Comment {
  constructor(text) {
    this.text = text;
  }
}

const token$1 = Tokenizer.tokenEnum;

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.current = 0;
    this.isParamListStarted = false;
  }

  parse() {
    let statements = [];
    while (!this.isAtEnd) {
      while (this.check(token$1.NEWLINE)) {
        this.consume(token$1.NEWLINE, "Expect newline between statements.");
      }
      statements.push(this.declaration());
    }

    return statements;
  }

  declaration() {
    if (this.match(token$1.DAGGER)) return this.comment();
    if (this.match(token$1.POUND)) return this.directive();
    if (this.match(token$1.TO)) return this.function();
    if (this.match(token$1.LET)) return this.varDeclaration();

    return this.statement();
  }

  directive() {
    if (this.match(token$1.IDENTIFIER, token$1.BE)) {
      const name = this.previous();
      const value = this.consume(token$1.IDENTIFIER, "Expect value after directive name.");
      return new Directive(name, value);
    }
  }

  comment() {
    const text = this.advance();
    return new Comment(text);
  }

  function() {
    const name = this.consume(token$1.IDENTIFIER, `Expect function name.`);
    this.consume(token$1.EMDASH, `Expect '—' after function name.`);
    let params = [];
    if (!this.check(token$1.EMDASH)) {
      do {
        if (params.length >= 255) {
          throw parseError("Can't have more than 255 arguments.", this.peek());
        }

        params.push(this.consume(token$1.IDENTIFIER, 'Expect identifier name.'));
      } while (this.match(token$1.COMMA));
    }
    this.consume(token$1.EMDASH, `Expect '—' after arguments.`);

    this.consume(token$1.COLON, `Expect ':' before function body.`);
    const body = this.block();
    return new CoemFunction(name, params, body);
  }

  block() {
    let statements = [];

    while (this.check(token$1.NEWLINE)) {
      this.consume(token$1.NEWLINE, "Expect newline between statements.");
    }

    while (!this.check(token$1.DOT) && !this.isAtEnd) {
      while (this.check(token$1.NEWLINE)) {
        this.consume(token$1.NEWLINE, "Expect newline between statements.");
      }
      if (!this.check(token$1.DOT) && !this.isAtEnd) {
        statements.push(this.declaration());
      }
    }

    this.consume(token$1.DOT, "Expect '.' after block.");
    return statements;
  }

  varDeclaration() {
    const name = this.consume(token$1.IDENTIFIER, 'Expected variable name');

    let value = null;
    if (this.match(token$1.BE)) {
      value = this.expression();
    }

    return new VarStatement(name, value);
  }

  expression() {
    return this.or();
  }

  or() {
    return this.matchBinary('and', Logical, token$1.OR)
  }

  and() {
    return this.matchBinary('equality', Logical, token$1.AND)
  }

  matchBinary(method, Class, ...operators) {
    let expr = this[method]();
    while (this.match(...operators)) {
      const operator = this.previous();
      const right = this[method]();
      expr = new Class(expr, operator, right);
    }
    return expr
  }

  equality() {
    // return this.matchBinary('comparison', Binary, token.BANG_EQUAL, token.EQUAL_EQUAL)
    // const expr = this.comparison();
    let expr = this.unary();

    // while (this.match(token.BANG_EQUAL, token.EQUAL_EQUAL, token.IS, token.AM, token.ARE)) {
    while (this.match(token$1.IS, token$1.AM, token$1.ARE)) {
      const operator = this.previous();
      const right = this.unary();
      expr = new Binary(expr, operator, right);
    }

    return expr;
  }

  unary() {
    if (this.match(token$1.NOT)) {
      const operator = this.previous();
      const right = this.unary();
      return new Unary(operator, right);
    }
    return this.call();
  }

  call() {
    let expr = this.primary();
    if (!this.isParamListStarted) {
      //eslint-disable-next-line
      while (true) {
        if (this.match(token$1.EMDASH)) {
          expr = this.finishCall(expr);
        } else {
          break;
        }
      }
    }

    return expr;
  }

  primary() {
    if (this.match(token$1.FALSE)) return new Literal(false);
    if (this.match(token$1.TRUE)) return new Literal(true);
    if (this.match(token$1.NOTHING)) return new Literal(null);

    if (this.match(token$1.STRING)) {
      return new Literal(this.previous().literal);
    }

    if (this.match(token$1.IDENTIFIER)) {
      return new Var(this.previous());
    }

    throw parseError('Expect expression.', this.peek());
  }

  finishCall(callee) {
    let args = [];

    if (!this.check(token$1.EMDASH)) {
      do {
        if (args.length >= 255) {
          throw parseError("Can't have more than 255 arguments.", this.peek());
        }
        this.isParamListStarted = true;
        args.push(this.expression());
        this.isParamListStarted = false;
      } while (this.match(token$1.COMMA));
    }

    const dash = this.consume(token$1.EMDASH, "Expect '—' after arguments.");

    return new Call(callee, dash, args);
  }

  statement() {
    if (this.match(token$1.IF)) return this.ifStatement();
    if (this.match(token$1.AMPERSAND)) return this.returnStatement();
    if (this.match(token$1.WHILE)) return this.whileStatement();
    if (this.match(token$1.COLON)) return new Block(this.block());

    return this.expressionStatement()
  }

  ifStatement() {
    this.consume(token$1.EMDASH, `Expect '—' after 'if'.`);
    this.isParamListStarted = true;
    const cond = this.expression();
    this.consume(token$1.EMDASH, `Expect '—' after if condition.`);
    this.isParamListStarted = false;

    const thenBranch = this.statement();
    let elseBranch = null;
    if (this.match(token$1.ELSE)) {
      elseBranch = this.statement();
    }

    return new Condition(cond, thenBranch, elseBranch);
  }

  returnStatement() {
    const ampersand = this.previous();
    let value = null;
    if (!this.check(token$1.NEWLINE)) {
      value = this.expression();
    }

    return new Return(ampersand, value);
  }

  whileStatement() {
    this.consume(token$1.EMDASH, `Expect '—' after 'while'.`);
    this.isParamListStarted = true;
    const cond = this.expression();
    this.consume(token$1.EMDASH, `Expect '—' after condition.`);
    this.isParamListStarted = false;
    const body = this.statement();

    return new While(cond, body);
  }

  expressionStatement() {
    const expr = this.expression();

    // if it's a bare expression, print the expression
    // but don't print a print statement
    let wrapped = expr;
    if (expr instanceof Call) {
      const callee = expr.callee;
      if (!callee.name === "print") {
        wrapped = this.printExpression(expr);
      }
    } else {
      wrapped = this.printExpression(expr);
    }

    return new ExpressionStatement(wrapped);
  }

  printExpression(expr) {
    const printToken = new Token(token$1.IDENTIFIER, "print", null, this.peek().endCoordinates, this.peek().startCoordinates);
    const printExpr = new Var(printToken);
    const dash = new Token(token$1.emdash, "—", null, this.peek().endCoordinates, this.peek().startCoordinates);
    let args = [expr];
    const call = new Call(printExpr, dash, args);
    return call;
  }

  consume(type, err) {
    if (this.check(type)) return this.advance();

    throw parseError(err, this.peek());
  }

  // Checks if current token is one of the following tokens and advances to next token
  match(...tokens) {
    for (let token of tokens) {
      if (this.check(token)) {
        this.advance();
        return true;
      }
    }

    return false;
  }

  // Verifies current token is equal to type
  check(type) {
    return !this.isAtEnd && this.peek().type === type;
  }

  get isAtEnd() {
    return this.peek().type === token$1.EOF;
  }

  // Gets current token
  peek() {
    return this.tokens[this.current];
  }

  // Gets previous token
  previous() {
    if (this.current <= 0) throw parseError('Expected previous but found nothing.', this.peek());
    return this.tokens[this.current - 1];
  }

  // Advances parser to the next token
  advance() {
    if (!this.isAtEnd) this.current++;
    return this.previous();
  }
}

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
      return this.values.set(pattern, value);
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

const token = Tokenizer.tokenEnum;

const isTruthy = val => Boolean(val);
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
    return `<${this.declaration.name.lexeme}()>`
  };
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

    this.environment.setBuiltin('print', nativePrint);
    this.environment.setBuiltin('know', nativePrint);
    this.environment.setBuiltin('say', nativePrint);
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

    let args = expr.arguments.map(arg => this.evaluate(arg));

    if (!callee.call) {
      throw runtimeError('Can only call functions.', expr.dash);
    }

    return callee.call(this, args, expr.callee)
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

// adapted from YALI.js by Daniel Berezin (danman113)

// function run(code, environment, printfn, debug = false) {
function run(code, environment, debug = false) {
  const tokenizer = new Tokenizer(code);
  const tokens = tokenizer.scanTokens();
  // if (debug) console.log(tokens);
  const parser = new Parser(tokens);
  const statements = parser.parse();
  if (debug) console.log(statements);
  // const interpreter = new Interpreter(environment, printfn);
  const interpreter = new Interpreter(environment, code);
  for (let statement of statements) {
    interpreter.interpret(statement);
  }
  const echo = interpreter.getEcho();
  return echo;
  // return lastStatement;
}

function parse(code) {
  const tokenizer = new Tokenizer(code);
  const tokens = tokenizer.scanTokens();
  const parser = new Parser(tokens);
  const statements = parser.parse();
  return statements;
}

// export { Environment, Interpreter, Parser, Tokenizer, formatCoemError, parse, run };
