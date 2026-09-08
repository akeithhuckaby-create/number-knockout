// Exact rational functions of positive rational powers of dice 1–6.
// Canonical monomials: rational coefficient * 2^a * 3^b * 5^c, 0 <= a,b,c < 1.
// Matching these forms proves cancellation without floating-point tolerances.
const PRIMES = [2n, 3n, 5n],
  ZERO_KEY = "0/1,0/1,0/1";
export class MathIssue extends Error {
  constructor(message, code = "expression") {
    super(message);
    this.code = code;
  }
}
const abs = (n) => (n < 0n ? -n : n);
function gcd(a, b) {
  a = abs(a);
  b = abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1n;
}
function rat(n, d = 1n) {
  if (!d) throw new MathIssue("Division by zero is not allowed.");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
const addR = (a, b) => rat(a.n * b.d + b.n * a.d, a.d * b.d),
  mulR = (a, b) => rat(a.n * b.n, a.d * b.d),
  divR = (a, b) => rat(a.n * b.d, a.d * b.n),
  eqR = (a, b) => a.n === b.n && a.d === b.d;
const keyR = (a) => `${a.n}/${a.d}`,
  readR = (s) => {
    const [n, d] = s.split("/");
    return rat(BigInt(n), BigInt(d));
  };
const constant = (n) => new Map(n ? [[ZERO_KEY, rat(BigInt(n))]] : []);
function setTerm(p, k, v) {
  if (!v.n) p.delete(k);
  else p.set(k, v);
}
function addP(a, b, sign = 1n) {
  const p = new Map(a);
  for (const [k, v] of b)
    setTerm(p, k, addR(p.get(k) || rat(0n), rat(sign * v.n, v.d)));
  return p;
}
function mulP(a, b) {
  const p = new Map();
  for (const [ka, va] of a)
    for (const [kb, vb] of b) {
      let coeff = mulR(va, vb);
      const ea = ka.split(",").map(readR),
        eb = kb.split(",").map(readR);
      const exps = ea.map((v, i) => {
        const x = addR(v, eb[i]),
          whole = x.n / x.d;
        if (whole) coeff = mulR(coeff, rat(PRIMES[i] ** whole));
        return keyR(rat(x.n % x.d, x.d));
      });
      const k = exps.join(",");
      setTerm(p, k, addR(p.get(k) || rat(0n), coeff));
    }
  if (p.size > 64)
    throw new MathIssue(
      "Could not verify: this expression is too complex.",
      "limit",
    );
  return p;
}
export function parsePower(value = "1") {
  const s = String(value).trim();
  if (!/^-?\d{1,4}(?:\/[1-9]\d{0,3})?$/.test(s))
    throw new MathIssue(
      "Enter a whole power or a fraction, such as 2 or 3/2.",
      "power",
    );
  const [a, b = "1"] = s.split("/"),
    r = rat(BigInt(a), BigInt(b));
  if (abs(r.n) > 128n || r.d > 64n)
    throw new MathIssue(
      "This app verifies powers up to ±128 with denominators up to 64.",
      "limit",
    );
  return r;
}
export function normalizePower(value) {
  const r = parsePower(value);
  return r.d === 1n ? String(r.n) : keyR(r);
}
function poweredDie(value, power) {
  const e = parsePower(power);
  let remaining = BigInt(value),
    coeff = rat(1n);
  const exps = PRIMES.map((p) => {
    let count = 0n;
    while (remaining % p === 0n && remaining > 1n) {
      count++;
      remaining /= p;
    }
    const x = rat(e.n * count, e.d);
    let whole = x.n / x.d;
    if (x.n < 0n && x.n % x.d) whole--;
    coeff = mulR(coeff, whole >= 0n ? rat(p ** whole) : rat(1n, p ** -whole));
    return keyR(rat(x.n - whole * x.d, x.d));
  });
  return { num: new Map([[exps.join(","), coeff]]), den: constant(1) };
}
function combine(a, op, b) {
  if (op === "+")
    return {
      num: addP(mulP(a.num, b.den), mulP(b.num, a.den)),
      den: mulP(a.den, b.den),
    };
  if (op === "-")
    return {
      num: addP(mulP(a.num, b.den), mulP(b.num, a.den), -1n),
      den: mulP(a.den, b.den),
    };
  if (op === "*") return { num: mulP(a.num, b.num), den: mulP(a.den, b.den) };
  if (!b.num.size) throw new MathIssue("Division by zero is not allowed.");
  return { num: mulP(a.num, b.den), den: mulP(a.den, b.num) };
}
function rationalValue(v) {
  if (!v.num.size) return rat(0n);
  if (v.num.size !== v.den.size) return null;
  const [k, d] = v.den.entries().next().value;
  if (!v.num.has(k)) return null;
  const ratio = divR(v.num.get(k), d);
  for (const [key, value] of v.den)
    if (!v.num.has(key) || !eqR(v.num.get(key), mulR(value, ratio)))
      return null;
  return ratio;
}
function approximateP(p) {
  let sum = 0;
  for (const [k, c] of p)
    sum +=
      (Number(c.n) / Number(c.d)) *
      k
        .split(",")
        .map(readR)
        .reduce(
          (r, e, i) => r * Number(PRIMES[i]) ** (Number(e.n) / Number(e.d)),
          1,
        );
  return sum;
}
export function dieToken(id, value, power = "1") {
  return { kind: "die", id, value, power: normalizePower(power) };
}
export const opToken = (value) => ({ kind: "op", value });
export function evaluate(tokens, dice, { requireAll = true } = {}) {
  let i = 0;
  const used = new Set();
  try {
    if (!tokens.length)
      return {
        ok: false,
        complete: false,
        used: [],
        message: "Choose a die to begin.",
        code: "empty",
      };
    if (tokens.length > 64)
      throw new MathIssue(
        "Keep the expression to 64 pieces or fewer.",
        "limit",
      );
    function atom() {
      const t = tokens[i++];
      if (!t)
        throw new MathIssue(
          "Add the next die or close the expression.",
          "incomplete",
        );
      if (t.kind === "op" && t.value === "(") {
        const a = sum();
        if (tokens[i]?.value !== ")")
          throw new MathIssue("Close the parenthesis.", "incomplete");
        i++;
        return a;
      }
      if (t.kind === "op" && t.value === "-") {
        const a = atom();
        return { num: addP(new Map(), a.num, -1n), den: a.den };
      }
      if (t.kind !== "die")
        throw new MathIssue("Choose a die here.", "incomplete");
      if (
        !Number.isInteger(t.id) ||
        t.id < 0 ||
        t.id >= dice.length ||
        t.value !== dice[t.id] ||
        t.value < 1 ||
        t.value > 6
      )
        throw new MathIssue(
          "This die does not belong to the current roll.",
          "inventory",
        );
      if (used.has(t.id))
        throw new MathIssue("Each die can be used only once.", "inventory");
      used.add(t.id);
      return poweredDie(t.value, t.power ?? "1");
    }
    function product() {
      let a = atom();
      while (tokens[i]?.kind === "op" && ["*", "/"].includes(tokens[i].value)) {
        const op = tokens[i++].value;
        a = combine(a, op, atom());
      }
      return a;
    }
    function sum() {
      let a = product();
      while (tokens[i]?.kind === "op" && ["+", "-"].includes(tokens[i].value)) {
        const op = tokens[i++].value;
        a = combine(a, op, product());
      }
      return a;
    }
    const value = sum();
    if (i !== tokens.length)
      throw new MathIssue(
        tokens[i].kind === "die"
          ? "Add an operation between dice."
          : "Check the parentheses and operations.",
        "expression",
      );
    const rational = rationalValue(value),
      approx = approximateP(value.num) / approximateP(value.den),
      integer = rational?.d === 1n ? rational.n : null;
    const number =
      integer !== null && abs(integer) <= BigInt(Number.MAX_SAFE_INTEGER)
        ? Number(integer)
        : null;
    let display = rational
      ? rational.d === 1n
        ? String(rational.n)
        : `${rational.n}/${rational.d}`
      : `≈ ${Number.isFinite(approx) ? Number(approx.toPrecision(9)) : "too large to display"}`;
    if (display.length > 36) display = display.slice(0, 18) + "…";
    const allUsed = used.size === dice.length;
    return {
      ok: (!requireAll || allUsed) && integer !== null,
      complete: true,
      used: [...used],
      allUsed,
      integer: number,
      integerText: integer === null ? null : String(integer),
      display,
      approx,
      message:
        !allUsed && requireAll
          ? "Use every die once."
          : integer === null
            ? "The result must be an exact whole number."
            : "All 3 dice used.",
      code: !allUsed ? "inventory" : integer === null ? "noninteger" : "valid",
    };
  } catch (error) {
    return {
      ok: false,
      complete: false,
      used: [...used],
      message: error.message,
      code: error.code || "expression",
    };
  }
}
const SYMBOLS = { "+": "+", "-": "−", "*": "×", "/": "÷", "(": "(", ")": ")" };
export function expressionText(tokens) {
  return tokens
    .map((t) =>
      t.kind === "die"
        ? t.power === "1" || !t.power
          ? String(t.value)
          : t.power === "1/2"
            ? `√${t.value}`
            : `${t.value}^(${t.power})`
        : SYMBOLS[t.value] || t.value,
    )
    .join(" ");
}
export function validTokenShape(t) {
  return (
    t &&
    ((t.kind === "die" &&
      Number.isInteger(t.id) &&
      t.id >= 0 &&
      t.id < 3 &&
      Number.isInteger(t.value) &&
      t.value >= 1 &&
      t.value <= 6 &&
      typeof t.power === "string") ||
      (t.kind === "op" && ["+", "-", "*", "/", "(", ")"].includes(t.value)))
  );
}
