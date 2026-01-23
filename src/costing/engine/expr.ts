type Token =
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: 'op'; v: '+' | '-' | '*' | '/' }
  | { t: 'paren'; v: '(' | ')' };

function tokenizeExpr(expr: string): Token[] {
  const tokens: Token[] = [];
  const s = expr.trim();
  let i = 0;

  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ t: 'paren', v: ch });
      i += 1;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ t: 'op', v: ch });
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const start = i;
      i += 1;
      while (i < s.length && /[0-9.]/.test(s[i])) i += 1;
      const raw = s.slice(start, i);
      const n = Number.parseFloat(raw);
      if (!Number.isFinite(n)) throw new Error(`Invalid number '${raw}'`);
      tokens.push({ t: 'num', v: n });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      i += 1;
      while (i < s.length && /[a-zA-Z0-9_.]/.test(s[i])) i += 1;
      tokens.push({ t: 'id', v: s.slice(start, i) });
      continue;
    }
    throw new Error(`Invalid character '${ch}' in expression`);
  }

  return tokens;
}

function toRpn(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const ops: Token[] = [];

  const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

  for (const tok of tokens) {
    if (tok.t === 'num' || tok.t === 'id') {
      output.push(tok);
      continue;
    }
    if (tok.t === 'op') {
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (top.t === 'op' && prec[top.v] >= prec[tok.v]) output.push(ops.pop()!);
        else break;
      }
      ops.push(tok);
      continue;
    }
    if (tok.t === 'paren' && tok.v === '(') {
      ops.push(tok);
      continue;
    }
    if (tok.t === 'paren' && tok.v === ')') {
      while (ops.length && !(ops[ops.length - 1].t === 'paren' && ops[ops.length - 1].v === '(')) {
        output.push(ops.pop()!);
      }
      const last = ops.pop();
      if (!last || last.t !== 'paren' || last.v !== '(') throw new Error('Mismatched parentheses');
      continue;
    }
  }

  while (ops.length) {
    const t = ops.pop()!;
    if (t.t === 'paren') throw new Error('Mismatched parentheses');
    output.push(t);
  }

  return output;
}

export function evalArithmeticExpr(expr: string, resolveIdentifier: (id: string) => number): number {
  const rpn = toRpn(tokenizeExpr(expr));
  const stack: number[] = [];

  for (const tok of rpn) {
    if (tok.t === 'num') {
      stack.push(tok.v);
      continue;
    }
    if (tok.t === 'id') {
      const v = resolveIdentifier(tok.v);
      if (!Number.isFinite(v)) throw new Error(`Identifier '${tok.v}' is not a finite number`);
      stack.push(v);
      continue;
    }
    if (tok.t === 'op') {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) throw new Error('Invalid expression');
      if (tok.v === '+') stack.push(a + b);
      if (tok.v === '-') stack.push(a - b);
      if (tok.v === '*') stack.push(a * b);
      if (tok.v === '/') stack.push(a / b);
      continue;
    }
  }

  if (stack.length !== 1) throw new Error('Invalid expression');
  return stack[0];
}

