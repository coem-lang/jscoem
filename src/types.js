class Binary {
  constructor(left, operator, right) {
    this.left = left
    this.operator = operator
    this.right = right
  }
}

class Logical extends Binary {}

class Unary {
  constructor(operator, right) {
    this.operator = operator
    this.right = right
  }
}

class Literal {
  constructor(value) {
    this.value = value
  }
}

class Var {
  constructor(name) {
    this.name = name
  }
}

class ExpressionStatement {
  constructor(expression) {
    this.expression = expression;
  }
}

class VarStatement {
  constructor(name, value) {
    this.name = name
    this.value = value
  }
}

class Block {
  constructor(statements) {
    this.statements = statements
  }
}

class Condition {
  constructor(condition, thenBranch, elseBranch) {
    this.condition = condition
    this.thenBranch = thenBranch
    this.elseBranch = elseBranch
  }
}

class While {
  constructor(condition, body) {
    this.condition = condition
    this.body = body
  }
}

class Call {
  constructor(callee, dash, args) {
    this.callee = callee
    this.dash = dash
    this.arguments = args
  }
}

class Return {
  constructor(keyword, value) {
    this.keyword = keyword
    this.value = value
  }
}

class CoemFunction {
  constructor(name, params, bodyStatements) {
    this.name = name
    this.params = params
    this.bodyStatements = bodyStatements
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

export {
  Var,
  Binary,
  Unary,
  Block,
  Call,
  While,
  Literal,
  Return,
  Logical,
  CoemFunction,
  Condition,
  ExpressionStatement,
  VarStatement,
  Directive,
  Comment
};