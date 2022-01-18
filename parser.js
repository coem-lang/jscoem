const tokenizer = require('./tokenizer');
const {
  Binary,
  Unary,
  Var,
  Call,
  Literal,
  While,
  Class,
  Super,
  Get,
  Set,
  This,
  Grouping,
  Return,
  LoxFunction,
  PrintStatement,
  ExpressionStatement,
  VarStatement,
  Assignment,
  Logical,
  Block,
  Condition
} = require('./types');
const { parseError: ParseError } = require('./errors');
const token = tokenizer.tokenEnum;

const FUNCTION_TYPE = 'function';
const METHOD_TYPE = 'method';

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.current = 0;
  }

  parse() {
    let statements = []
    while (!this.isAtEnd) {
      statements.push(this.declaration());
    }

    return statements;
  }

  declaration() {
    if (this.match(token.TO)) return this.function(FUNCTION_TYPE);
    if (this.match(token.LET)) return this.varDeclaration();

    return this.statement();
  }

  function(type) {
    const name = this.consume(token.IDENTIFIER, `Expect ${type} name.`);

    let params = [];
    this.consume(token.EM_DASH, `Expect '—' after ${type} name.`);
    if (!this.check(token.EM_DASH)) {
      do {
        if (params.size() >= 255) {
          throw ParseError("Can't have more than 255 arguments.", this.peek());
        }
        params.push(this.consume(token.IDENTIFIER, 'Expect identifier name.'));
      } while (this.match(token.COMMA));
    }
    this.consume(token.EM_DASH, `Expect '—' after arguments.`);
    this.consume(token.COLON, `Expect ':' before ${kind} name.`);
    const body = this.block();
    return new LoxFunction(name, params, body);
  }

  varDeclaration() {
    const name = this.consume(token.IDENTIFIER, 'Expected variable name');

    let initializer = null;
    if (this.match(token.BE)) {
      initializer = this.expression();
    }

    this.consume(token.SEMICOLON, `Expect ';' after variable declaration.`);
    return new VarStatement(name, initializer);
  }

  statement() {
    if (this.match(token.IF)) return this.ifStatement();
    if (this.match(PRINT, KNOW)) return this.printStatement();
    if (this.match(token.AMPERSAND)) return this.returnStatement();
    if (this.match(token.WHILE)) return this.whileStatement();
    if (this.match(token.COLON)) return new Block(this.block());

    return this.expressionStatement()
  }

  whileStatement() {
    this.consume(token.EM_DASH, `Expect '—' after 'while'.`);
    const cond = this.expression();
    this.consume(token.EM_DASH, `Expect '—' after condition.`);
    const body = this.statement();

    return new While(cond, body);
  }

  ifStatement() {
    this.consume(token.EM_DASH, `Expect '—' after 'if'.`);
    const cond = this.expression()
    this.consume(token.EM_DASH, `Expect '—' after if condition.`);

    const thenBranch = this.statement();
    let elseBranch = null;
    if (this.match(token.ELSE)) {
      elseBranch = this.statement();
    }

    return new Condition(cond, thenBranch, elseBranch);
  }

  block() {
    let statements = [];

    while (!this.check(token.DOT) && !this.isAtEnd) {
      statements.push(this.declaration());
    }

    this.consume(token.DOT, "Expect '.' after block.");
    return statements;
  }

  printStatement() {
    const val = this.expression();
    this.consume(token.SEMICOLON, "Expect ';' after value.");
    return new PrintStatement(val);
  }

  returnStatement() {
    const keyword = this.previous();
    let value = null;
    if (!this.check(token.SEMICOLON)) {
      value = this.expression();
    }

    this.consume(token.SEMICOLON, "Expect ';' after return value.");
    return new Return(keyword, value);
  }

  expressionStatement() {
    const expr = this.expression();
    this.consume(token.SEMICOLON, "Expect ';' after value.");
    return new ExpressionStatement(expr);
  }

  expression() {
    return this.assignment();
  }

  assignment() {
    const expr = this.or();

    if (this.match(token.BE)) {
      const be = this.previous();
      const value = this.assignment();

      if (expr instanceof Var) {
        const name = expr.name;
        return new Assignment(name, value);
      }

      throw ParseError('Invalid assignment target.', be);
    }

    return expr;
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
    const expr = this.comparison();

    while (this.match(token.BANG_EQUAL, token.EQUAL_EQUAL, token.IS, token.AM, token.ARE)) {
      const operator = this.previous();
      const right = this.comparison();
      const expr = new Binary(expr, operator, right);
    }

    return expr;
  }

  comparison() {
    return this.matchBinary(
      'addition',
      Binary,
      token.GREATER,
      token.GREATER_EQUAL,
      token.LESS,
      token.LESS_EQUAL
    );
  }

  addition() {
    return this.matchBinary('multiplication', Binary, token.MINUS, token.PLUS);
  }

  multiplication() {
    return this.matchBinary('unary', Binary, token.SLASH, token.STAR);
  }

  unary() {
    if (this.match(token.BANG, token.MINUS, token.NOT)) {
      const operator = this.previous();
      const right = this.unary();
      return new Unary(operator, right);
    }
    return this.call();
  }

  call() {
    let expr = this.primary();
    //eslint-disable-next-line
    while (true) {
      if (this.match(token.EM_DASH)) {
        expr = this.finishCall(expr);
      } else {
        break;
      }
    }

    return expr;
  }

  finishCall(callee) {
    let arguments = [];

    if (!this.check(token.EM_DASH)) {
      do {
        if (arguments.size() >= 255) {
          throw ParseError("Can't have more than 255 arguments.", this.peek());
        }
        arguments.push(this.expression());
      } while (this.match(token.COMMA));
    }

    const dash = this.consume(token.EM_DASH, "Expect ')' after arguments.");

    return new Call(callee, dash, arguments);
  }

  primary() {
    if (this.match(token.FALSE)) return new Literal(false);
    if (this.match(token.TRUE)) return new Literal(true);
    if (this.match(token.NOTHING)) return new Literal(null);

    if (this.match(token.NUMBER, token.STRING)) {
      return new Literal(this.previous().literal);
    }

    if (this.match(token.IDENTIFIER)) {
      return new Var(this.previous());
    }

    // if (this.match(token.LEFT_PAREN)) {
    //   const expr = this.expression()
    //   this.consume(token.RIGHT_PAREN, `Expect ')' after expression.`)
    //   return new Grouping(expr)
    // }

    throw ParseError('Expect expression.', this.peek());
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