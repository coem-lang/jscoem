const tokens = `
  COLON,
  COMMA, DOT,
  EMDASH,
  AMPERSAND,
  POUND,

  IDENTIFIER, STRING,

  AND, OR,
  IS, AM, ARE,
  IF, ELSE, WHILE,
  LET, BE,
  TO, 
  TRUE, FALSE, NOTHING,
  NOT,

  NEWLINE,

  EOF
`
  .split(',')
  .map(token => token.trim());

let tokenEnum = {};
tokens.forEach((token, i) => {
  tokenEnum[token] = i;
});

({
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
});
