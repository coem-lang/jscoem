const { CoemError } = require('./errors');
const noop = () => {};

const tokens = `
  COLON,
  COMMA, DOT, MINUS, PLUS, SLASH, STAR,
  EM_DASH, SEMICOLON, AMPERSAND,

  BANG, BANG_EQUAL,
  EQUAL, EQUAL_EQUAL,
  GREATER, GREATER_EQUAL,
  LESS, LESS_EQUAL,

  IDENTIFIER, STRING, NUMBER,

  AND, OR, // logic
  IS, AM, ARE, // comparison
  IF, ELSE, FOR, WHILE, // control flow
  LET, BE, // variables
  TO, 
  PRINT, KNOW,
  CLASS, SUPER, THIS, // classes
  TRUE, FALSE, NOTHING, // values
  NOT,

  EOF
`
  .split(',')
  .map(token => token.trim());

let tokenEnum = {};
tokens.forEach((token, i) => {
  tokenEnum[token] = i;
})

const keywords = {
  and: tokenEnum.AND,
  else: tokenEnum.ELSE,
  for: tokenEnum.FOR,
  to: tokenEnum.TO,
  if: tokenEnum.IF,
  or: tokenEnum.OR,
  print: tokenEnum.PRINT,
  know: tokenEnum.KNOW,
  true: tokenEnum.TRUE,
  false: tokenEnum.FALSE,
  nothing: tokenEnum.NOTHING,
  let: tokenEnum.LET,
  while: tokenEnum.WHILE,
  be: tokenEnum.BE,
  is: tokenEnum.IS,
  am: tokenEnum.AM,
  are: tokenEnum.ARE,
  not: tokenEnum.NOT
};

const tokenMap = {
  '—': tokenizer => {
    tokenizer.addToken(tokenEnum.EM_DASH);
  },
  ':': tokenizer => {
    tokenizer.addToken(tokenEnum.COLON);
  },
  ',': tokenizer => {
    tokenizer.addToken(tokenEnum.COMMA);
  },
  '.': tokenizer => {
    // Handles leading decimals for number literals
    if (isDigit(tokenizer.peek())) {
      tokenizer.handleNumberLiterals();
    } else {
      tokenizer.addToken(tokenEnum.DOT);
    }
  },
  '-': tokenizer => {
    tokenizer.addToken(tokenEnum.MINUS);
  },
  '+': tokenizer => {
    tokenizer.addToken(tokenEnum.PLUS);
  },
  ';': tokenizer => {
    tokenizer.addToken(tokenEnum.SEMICOLON);
  },
  '/': tokenizer => {
    if (tokenizer.nextMatch('/')) {
      // Eat all those delish comments
      while (tokenizer.peek() !== '\n' && tokenizer.peek() !== '') tokenizer.advance();
    } else {
      tokenizer.addToken(tokenEnum.SLASH);
    }
  },
  '*': tokenizer => {
    tokenizer.addToken(tokenEnum.STAR);
  },
  '&': tokenizer => {
    tokenizer.addToken(tokenEnum.AMPERSAND);
  },
  '!': tokenizer => {
    tokenizer.addToken(tokenizer.nextMatch('=') ? tokenEnum.BANG_EQUAL : tokenEnum.BANG);
  },
  '=': tokenizer => {
    tokenizer.addToken(tokenizer.nextMatch('=') ? tokenEnum.EQUAL_EQUAL : tokenEnum.EQUAL);
  },
  '>': tokenizer => {
    tokenizer.addToken(tokenizer.nextMatch('=') ? tokenEnum.GREATER_EQUAL : tokenEnum.GREATER);
  },
  '<': tokenizer => {
    tokenizer.addToken(tokenizer.nextMatch('=') ? tokenEnum.LESS_EQUAL : tokenEnum.LESS);
  },
  ' ': noop,
  '\t': noop,
  '\r': noop,
  '\n': tokenizer => {
    tokenizer.newline();
  },
  '"': tokenizer => {
    tokenizer.handleStringLiterals();
  }
}

const isDigit = str => /\d/.test(str)
// const isAlpha = str => /[a-zA-Z_]/.test(str)
// const isAlphaNumeric = str => isAlpha(str) || isDigit(str)

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
    while (this.peek() !== '"' && this.peek() !== '') {
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

  handleNumberLiterals() {
    let hasDecimal = false;
    while (isDigit(this.peek()) || (!hasDecimal && this.peek() === '.')) {
      if (this.peek() === '.') hasDecimal = true;
      this.advance();
    }
    const value = this.source.substring(this.start, this.current);
    this.addToken(tokenEnum.NUMBER, parseFloat(value));
  }

  handleIdentifiers() {
    while (isNotBoundary(this.peek())) this.advance();
    const value = this.source.substring(this.start, this.current);
    if (keywords[value]) {
      this.addToken(keywords[value], value);
    } else {
      this.addToken(tokenEnum.IDENTIFIER, value);
    }
  }

  scanTokens() {
    while (this.current < this.length) {
      const c = this.advance()
      this.startPosition = new Coordinate(this.column - 1, this.line, this.current - 1)
      if (!tokenMap[c]) {
        if (isDigit(c)) {
          this.handleNumberLiterals();
        } else if (isAlpha(c)) {
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

module.exports = Tokenizer;