import { dieToken, opToken, evaluate, expressionText } from "./math.js";
import { equationKey } from "./equations.js";
export const SEARCH_POWERS = [
  "1",
  "0",
  "2",
  "3",
  "1/2",
  "-1",
  "4",
  "1/3",
  "3/2",
  "5",
  "6",
];
const POWER_COST = [0, 5, 3, 5, 5, 7, 8, 8, 9, 11, 14];
const OPS = ["+", "-", "*", "/"],
  OP_COST = [0, 1, 1, 3];
const permutations = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];
const calc = (a, o, b) =>
  o === "+"
    ? a + b
    : o === "-"
      ? a - b
      : o === "*"
        ? a * b
        : b === 0
          ? NaN
          : a / b;
const powerValue = (d, p) => {
  const [a, b = 1] = p.split("/").map(Number);
  return d ** (a / b);
};
const cache = new Map();
export function solve(dice, { min = 1, max = 72, exclude = [] } = {}) {
  if (
    !Array.isArray(exclude) ||
    exclude.length > 8 ||
    exclude.some((k) => typeof k !== "string" || k.length > 4000)
  )
    throw Error("Invalid previous equation.");
  const excluded = new Set(exclude);
  if (
    dice.length !== 3 ||
    dice.some((n) => !Number.isInteger(n) || n < 1 || n > 6)
  )
    throw Error("Choose three dice from 1 to 6.");
  if (
    !Number.isInteger(min) ||
    !Number.isInteger(max) ||
    min < 1 ||
    max > 999 ||
    max < min ||
    max - min > 199
  )
    throw Error("Choose a range of up to 200 targets between 1 and 999.");
  const order = [0, 1, 2].sort((a, b) => dice[a] - dice[b] || a - b),
    sorted = order.map((i) => dice[i]),
    key = `${sorted}|${min}:${max}|${JSON.stringify([...excluded].sort())}`;
  if (cache.has(key)) return remap(cache.get(key), order);
  const best = new Map(),
    values = sorted.map((d) => SEARCH_POWERS.map((p) => powerValue(d, p)));
  for (const ids of permutations)
    for (let a = 0; a < SEARCH_POWERS.length; a++)
      for (let b = 0; b < SEARCH_POWERS.length; b++)
        for (let c = 0; c < SEARCH_POWERS.length; c++) {
          const [i, j, k] = ids,
            nums = [values[i][a], values[j][b], values[k][c]],
            pcost = POWER_COST[a] + POWER_COST[b] + POWER_COST[c];
          for (let x = 0; x < 4; x++)
            for (let y = 0; y < 4; y++)
              for (let grouping = 0; grouping < 2; grouping++) {
                const cost = pcost + OP_COST[x] + OP_COST[y] + grouping * 0.1;
                const n = grouping
                  ? calc(nums[0], OPS[x], calc(nums[1], OPS[y], nums[2]))
                  : calc(calc(nums[0], OPS[x], nums[1]), OPS[y], nums[2]);
                const target = Math.round(n);
                if (
                  !Number.isFinite(n) ||
                  Math.abs(n - target) > 1e-8 ||
                  target < min ||
                  target > max ||
                  (best.get(target)?.cost ?? Infinity) <= cost
                )
                  continue;
                const ds = ids.map((id, index) =>
                  dieToken(id, sorted[id], SEARCH_POWERS[[a, b, c][index]]),
                );
                const raw = grouping
                  ? [
                      ds[0],
                      opToken(OPS[x]),
                      opToken("("),
                      ds[1],
                      opToken(OPS[y]),
                      ds[2],
                      opToken(")"),
                    ]
                  : [
                      opToken("("),
                      ds[0],
                      opToken(OPS[x]),
                      ds[1],
                      opToken(")"),
                      opToken(OPS[y]),
                      ds[2],
                    ];
                // Numerical filtering only finds candidates. Exact evaluation is the acceptance gate.
                if (evaluate(raw, sorted).integer !== target) continue;
                const flat = [
                  ds[0],
                  opToken(OPS[x]),
                  ds[1],
                  opToken(OPS[y]),
                  ds[2],
                ];
                const variants =
                  evaluate(flat, sorted).integer === target
                    ? [flat, raw]
                    : [raw];
                const tokens = variants.find(
                  (t) => !excluded.size || !excluded.has(equationKey(t)),
                );
                if (!tokens) continue;
                best.set(target, {
                  target,
                  cost,
                  tokens,
                  expression: expressionText(tokens),
                });
              }
        }
  const result = [...best.values()].sort((a, b) => a.target - b.target);
  cache.set(key, result);
  if (cache.size > 96) cache.delete(cache.keys().next().value);
  return remap(result, order);
}
function remap(result, order) {
  return result.map((s) => ({
    ...s,
    tokens: s.tokens.map((t) =>
      t.kind === "die" ? { ...t, id: order[t.id] } : { ...t },
    ),
  }));
}
// A gameplay exception based on the complete preset search, not a proof of
// uniqueness across every custom exponent supported by the expression editor.
export function assessDeparture(dice, target, previous) {
  const key = equationKey(previous);
  const alternative = solve(dice, {
    min: target,
    max: target,
    exclude: [key],
  })[0];
  if (alternative) return { status: "alternative", solution: alternative };
  const used = new Set();
  const tokens = previous.map((t) => {
    if (t.kind !== "die") return { ...t };
    const id = dice.findIndex((value, i) => value === t.value && !used.has(i));
    used.add(id);
    return { ...t, id };
  });
  const proof = evaluate(tokens, dice);
  if (!proof.ok || proof.integer !== target)
    return { status: "unavailable", solution: null };
  return {
    status: "only-method",
    solution: { target, tokens, expression: expressionText(tokens) },
  };
}
export function clue(solution, level = 1) {
  if (!solution)
    return "No solution found in this search. You can still try your own expression.";
  const powers = solution.tokens.filter(
    (t) => t.kind === "die" && t.power !== "1",
  );
  if (level === 1) {
    if (powers.length)
      return `Try a free power on the ${powers[0].value} die. Its exponent does not use another die.`;
    const ops = [
      ...new Set(
        solution.tokens
          .filter((t) => t.kind === "op" && !["(", ")"].includes(t.value))
          .map(
            (t) =>
              ({
                "+": "addition",
                "-": "subtraction",
                "*": "multiplication",
                "/": "division",
              })[t.value],
          ),
      ),
    ];
    return `Try ${ops.join(" and ")}. Use each of your three dice once.`;
  }
  if (level === 2) {
    const cut = solution.tokens.findIndex(
      (t) => t.kind === "op" && !["(", ")"].includes(t.value),
    );
    return `Start with ${expressionText(solution.tokens.slice(0, cut + 1))} …`;
  }
  return `${solution.expression} = ${solution.target}`;
}
