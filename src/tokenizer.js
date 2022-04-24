import { CoemError } from './errors.js';
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
})

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
}

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
      const c = this.advance()
      this.startPosition = new Coordinate(this.column - 1, this.line, this.current - 1)
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

  untokenize(tokens) {
    let text = "";
    let line = 1;
    let col = 1;
    for (let token of tokens) {
      console.log(token);
    }
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

export { Tokenizer, Token };