const tokenizer = require('./tokenizer');
const {
  Binary,
  Unary,
  Var,
  Call,
  Literal,
  While,
  Return,
  CoemFunction,
  ExpressionStatement,
  VarStatement,
  Logical,
  Block,
  Condition
} = require('./types');
const { parseError: ParseError } = require('./errors');
const token = tokenizer.tokenEnum;

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.current = 0;
    this.isParamListStarted = false;
  }

  parse() {
    let statements = []
    while (!this.isAtEnd) {
      while (this.check(token.NEWLINE)) {
        this.consume(token.NEWLINE, "Expect newline between statements.");
      }
      statements.push(this.declaration());
    }

    return statements;
  }

  declaration() {
    if (this.match(token.POUND)) return this.directive();
    if (this.match(token.TO)) return this.function();
    if (this.match(token.LET)) return this.varDeclaration();

    return this.statement();
  }

  directive() {
    if (this.match(token.IDENTIFIER, token.BE)) {
      const name = this.previous();
      const value = this.consume(token.IDENTIFIER, "Expect value after directive name.");
      return new DirectiveStatement(name, value);
    }
  }

  function() {
    const name = this.consume(token.IDENTIFIER, `Expect function name.`);
    this.consume(token.EMDASH, `Expect '—' after function name.`);
    let params = [];
    if (!this.check(token.EMDASH)) {
      do {
        if (params.length >= 255) {
          throw ParseError("Can't have more than 255 arguments.", this.peek());
        }

        params.push(this.consume(token.IDENTIFIER, 'Expect identifier name.'));
      } while (this.match(token.COMMA));
    }
    this.consume(token.EMDASH, `Expect '—' after arguments.`);

    this.consume(token.COLON, `Expect ':' before function body.`);
    const body = this.block();
    return new CoemFunction(name, params, body);
  }

  block() {
    let statements = [];

    while (this.check(token.NEWLINE)) {
      this.consume(token.NEWLINE, "Expect newline between statements.");
    }

    while (!this.check(token.DOT) && !this.isAtEnd) {
      while (this.check(token.NEWLINE)) {
        this.consume(token.NEWLINE, "Expect newline between statements.");
      }
      if (!this.check(token.DOT) && !this.isAtEnd) {
        statements.push(this.declaration());
      }
    }

    this.consume(token.DOT, "Expect '.' after block.");
    return statements;
  }

  varDeclaration() {
    const name = this.consume(token.IDENTIFIER, 'Expected variable name');

    let value = null;
    if (this.match(token.BE)) {
      value = this.expression();
    }

    return new VarStatement(name, value);
  }

  expression() {
    return this.or();
  }

  or() {
    return this.matchBinary('and', Logical, token.OR)
  }

  and() {
    return this.matchBinary('equality', Logical, token.AND)
  }

  matchBinary(method, Class, ...operators) {
    let expr = this[method]()
    while (this.match(...operators)) {
      const operator = this.previous()
      const right = this[method]()
      expr = new Class(expr, operator, right)
    }
    return expr
  }

  equality() {
    // return this.matchBinary('comparison', Binary, token.BANG_EQUAL, token.EQUAL_EQUAL)
    // const expr = this.comparison();
    let expr = this.unary();

    // while (this.match(token.BANG_EQUAL, token.EQUAL_EQUAL, token.IS, token.AM, token.ARE)) {
    while (this.match(token.IS, token.AM, token.ARE)) {
      const operator = this.previous();
      const right = this.unary();
      expr = new Binary(expr, operator, right);
    }

    return expr;
  }

  unary() {
    if (this.match(token.NOT)) {
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
        if (this.match(token.EMDASH)) {
          expr = this.finishCall(expr);
        } else {
          break;
        }
      }
    }

    return expr;
  }

  primary() {
    if (this.match(token.FALSE)) return new Literal(false);
    if (this.match(token.TRUE)) return new Literal(true);
    if (this.match(token.NOTHING)) return new Literal(null);

    if (this.match(token.STRING)) {
      return new Literal(this.previous().literal);
    }

    if (this.match(token.IDENTIFIER)) {
      return new Var(this.previous());
    }

    throw ParseError('Expect expression.', this.peek());
  }

  finishCall(callee) {
    let args = [];

    if (!this.check(token.EMDASH)) {
      do {
        if (args.length >= 255) {
          throw ParseError("Can't have more than 255 arguments.", this.peek());
        }
        this.isParamListStarted = true;
        args.push(this.expression());
        this.isParamListStarted = false;
      } while (this.match(token.COMMA));
    }

    const dash = this.consume(token.EMDASH, "Expect '—' after arguments.");

    return new Call(callee, dash, args);
  }

  statement() {
    if (this.match(token.IF)) return this.ifStatement();
    if (this.match(token.AMPERSAND)) return this.returnStatement();
    if (this.match(token.WHILE)) return this.whileStatement();
    if (this.match(token.COLON)) return new Block(this.block());

    return this.expressionStatement()
  }

  ifStatement() {
    this.consume(token.EMDASH, `Expect '—' after 'if'.`);
    this.isParamListStarted = true;
    const cond = this.expression();
    this.consume(token.EMDASH, `Expect '—' after if condition.`);
    this.isParamListStarted = false;

    const thenBranch = this.statement();
    let elseBranch = null;
    if (this.match(token.ELSE)) {
      elseBranch = this.statement();
    }

    return new Condition(cond, thenBranch, elseBranch);
  }

  returnStatement() {
    const ampersand = this.previous();
    let value = null;
    if (!this.check(token.NEWLINE)) {
      value = this.expression();
    }

    return new Return(ampersand, value);
  }

  whileStatement() {
    this.consume(token.EMDASH, `Expect '—' after 'while'.`);
    this.isParamListStarted = true;
    const cond = this.expression();
    this.consume(token.EMDASH, `Expect '—' after condition.`);
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
    const printToken = new Token(token.IDENTIFIER, "print", null, peek().endCoordinates, peek().startCoordinates);
    const printExpr = new Var(printToken);
    const dash = new Token(token.emdash, "—", NULL, peek().endCoordinates, peek().startCoordinates);
    let args = [expr];
    const call = new Call(printExpr, dash, args);
    return call;
  }

  consume(type, err) {
    if (this.check(type)) return this.advance();

    throw ParseError(err, this.peek());
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
    return this.peek().type === token.EOF;
  }

  // Gets current token
  peek() {
    return this.tokens[this.current];
  }

  // Gets previous token
  previous() {
    if (this.current <= 0) throw ParseError('Expected previous but found nothing.', this.peek());
    return this.tokens[this.current - 1];
  }

  // Advances parser to the next token
  advance() {
    if (!this.isAtEnd) this.current++;
    return this.previous();
  }
}

module.exports = Parser;