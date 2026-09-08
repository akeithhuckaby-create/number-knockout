import test from "node:test";
import assert from "node:assert/strict";
import { dieToken as d, opToken as o, evaluate } from "../src/math.js";
import { equationKey } from "../src/equations.js";
import {
  newGame,
  commitAction,
  finishTurn,
  previewAction,
  validateSave,
  departureRule,
  departureCheckKey,
} from "../src/game.js";
import { solve, assessDeparture } from "../src/solver.js";
const sum = [d(0, 1), o("+"), d(1, 2), o("+"), d(2, 3)];
const product = [d(0, 1), o("*"), d(1, 2), o("*"), d(2, 3)];
function sharedDeparture(dice = [1, 2, 3], number = 6, tokens = sum) {
  const s = newGame({
    seed: 42,
    board: Array.from({ length: 36 }, (_, i) => i + 1),
  });
  [s.board[13], s.board[number - 1]] = [s.board[number - 1], s.board[13]];
  s.players.forEach((p) => (p.pos = 13));
  s.dice = [...dice];
  s.draft = { action: "move", target: 14, tokens, cursor: tokens.length };
  const result = commitAction(s);
  assert.ok(result.ok);
  const next = finishTurn(result.state);
  next.dice = [...dice];
  next.draft = { action: "move", target: 14, tokens, cursor: tokens.length };
  return next;
}
test("number permutations, grouping, and die identities do not make a new method", () => {
  const key = equationKey(sum);
  for (const values of [
    [1, 2, 3],
    [1, 3, 2],
    [2, 1, 3],
    [2, 3, 1],
    [3, 1, 2],
    [3, 2, 1],
  ]) {
    const ds = values.map((v, i) => d(i, v));
    assert.equal(equationKey([ds[0], o("+"), ds[1], o("+"), ds[2]]), key);
    assert.equal(
      equationKey([ds[0], o("+"), o("("), ds[1], o("+"), ds[2], o(")")]),
      key,
    );
    assert.equal(
      equationKey([o("("), ds[0], o("+"), ds[1], o(")"), o("+"), ds[2]]),
      key,
    );
  }
  assert.notEqual(equationKey(product), key);
  assert.equal(
    equationKey([d(0, 4, "2/4"), o("+"), d(1, 2), o("+"), d(2, 3)]),
    equationKey([d(2, 4, "1/2"), o("+"), d(0, 2), o("+"), d(1, 3)]),
  );
});
test("equivalent subtraction and division rearrangements also count as repeats", () => {
  assert.equal(
    equationKey([d(0, 6), o("-"), d(1, 3), o("+"), d(2, 2)]),
    equationKey([d(2, 2), o("+"), o("("), d(0, 6), o("-"), d(1, 3), o(")")]),
  );
  assert.equal(
    equationKey([d(0, 6), o("/"), d(1, 3), o("*"), d(2, 2)]),
    equationKey([d(0, 6), o("/"), o("("), d(1, 3), o("/"), d(2, 2), o(")")]),
  );
  assert.equal(
    equationKey(sum),
    equationKey([
      d(0, 1),
      o("-"),
      o("("),
      o("-"),
      d(1, 2),
      o("-"),
      d(2, 3),
      o(")"),
    ]),
  );
  assert.notEqual(
    equationKey([d(0, 6), o("-"), d(1, 6), o("+"), d(2, 4)]),
    equationKey([d(0, 6), o("/"), d(1, 6), o("*"), d(2, 4)]),
  );
});
test("a copied shared-stone exit is rejected atomically, but a different method is allowed", () => {
  const s = sharedDeparture(),
    before = structuredClone(s);
  assert.equal(previewAction(s).code, "repeated-method");
  const denied = commitAction(s);
  assert.equal(denied.ok, false);
  assert.deepEqual(denied.state, before);
  s.dice = [3, 2, 1];
  s.draft.tokens = [d(0, 3), o("+"), d(1, 2), o("+"), d(2, 1)];
  assert.equal(previewAction(s).code, "repeated-method");
  s.draft.tokens = [d(0, 3), o("*"), d(1, 2), o("*"), d(2, 1)];
  const accepted = commitAction(s);
  assert.ok(accepted.ok);
  assert.deepEqual(
    accepted.state.players.map((p) => p.pos),
    [14, 14],
  );
  assert.equal(accepted.state.sharedExit[1], null);
});
test("the reminder survives refresh and passes, clears on departure, and never applies at the gates", () => {
  let s = sharedDeparture();
  s = validateSave(JSON.parse(JSON.stringify(s)));
  assert.equal(previewAction(s).code, "repeated-method");
  s = finishTurn(commitAction(s, { pass: true }).state);
  s = finishTurn(commitAction(s, { pass: true }).state);
  s.dice = [1, 2, 3];
  s.draft = { action: "move", target: 14, tokens: sum, cursor: 5 };
  assert.equal(previewAction(s).code, "repeated-method");
  s.draft.action = "build";
  assert.equal(departureRule(s), null);
  s.draft.action = "move";
  s.draft.target = 12;
  assert.equal(departureRule(s), null);
  const fresh = newGame({ board: Array.from({ length: 36 }, (_, i) => i + 1) });
  [fresh.board[0], fresh.board[5]] = [fresh.board[5], fresh.board[0]];
  fresh.dice = [1, 2, 3];
  fresh.draft = { action: "move", target: 1, tokens: sum, cursor: 5 };
  const start = commitAction(fresh);
  assert.ok(start.ok);
  assert.deepEqual(start.state.sharedExit, [null, null]);
  const old = newGame();
  delete old.sharedExit;
  assert.deepEqual(validateSave(old).sharedExit, [null, null]);
  const corrupt = sharedDeparture();
  corrupt.sharedExit[1].tokens = product.map((t) =>
    t.kind === "die" ? { ...t, value: 6 } : t,
  );
  assert.equal(validateSave(corrupt), null);
});
test("Oracle finds a different verified method and keeps restricted and ordinary caches separate", () => {
  const excluded = equationKey(sum);
  const ordinary = solve([1, 2, 3], { min: 6, max: 6 })[0];
  assert.equal(equationKey(ordinary.tokens), excluded);
  const alternative = solve([1, 2, 3], {
    min: 6,
    max: 6,
    exclude: [excluded],
  })[0];
  assert.ok(alternative);
  assert.notEqual(equationKey(alternative.tokens), excluded);
  assert.equal(evaluate(alternative.tokens, [1, 2, 3]).integer, 6);
  const remapped = solve([3, 1, 2], { min: 6, max: 6, exclude: [excluded] })[0];
  assert.notEqual(equationKey(remapped.tokens), excluded);
  assert.equal(evaluate(remapped.tokens, [3, 1, 2]).integer, 6);
  assert.equal(
    equationKey(solve([1, 2, 3], { min: 6, max: 6 })[0].tokens),
    excluded,
  );
  const s = sharedDeparture();
  s.draft.tokens = alternative.tokens;
  assert.ok(previewAction(s).ok);
});

test("powers on one do not disguise a repeated method", () => {
  const powered = structuredClone(sum);
  powered[0].power = "128/63";
  assert.equal(equationKey(powered), equationKey(sum));
  assert.equal(assessDeparture([1, 2, 3], 6, sum).status, "alternative");
});
test("the single-method exception is checked for the current dice and exact target", () => {
  const tokens = [d(0, 1), o("+"), d(1, 2, "2"), o("+"), d(2, 2, "4")];
  const s = sharedDeparture([1, 2, 2], 21, tokens);
  s.hints = false;
  const result = assessDeparture(s.dice, 21, tokens);
  assert.equal(result.status, "only-method");
  assert.equal(evaluate(result.solution.tokens, s.dice).integer, 21);
  assert.equal(previewAction(s).code, "repeated-method");
  const departureCheck = { key: departureCheckKey(s), ...result };
  assert.equal(previewAction(s, { departureCheck }).code, "only-method");
  const moved = commitAction(s, { departureCheck });
  assert.ok(moved.ok);
  assert.equal(moved.entry.exception, "oracle-only-method");
  assert.deepEqual(
    moved.state.players.map((p) => p.pos),
    [14, 14],
  );
  assert.ok(validateSave(moved.state));
  const remapped = assessDeparture([2, 1, 2], 21, tokens);
  assert.equal(remapped.status, "only-method");
  assert.equal(evaluate(remapped.solution.tokens, [2, 1, 2]).integer, 21);
  assert.equal(assessDeparture([6, 6, 6], 21, tokens).status, "unavailable");
});
test("stale, absent, failed, and alternative-found checks never allow a repeated method", () => {
  const tokens = [d(0, 1), o("+"), d(1, 2, "2"), o("+"), d(2, 2, "4")];
  const s = sharedDeparture([1, 2, 2], 21, tokens);
  const departureCheck = {
    key: departureCheckKey(s),
    ...assessDeparture(s.dice, 21, tokens),
  };
  for (const change of [
    (q) => q.turn++,
    (q) => (q.id += "new"),
    (q) => {
      q.sharedExit[1].from = 12;
      q.players[1].pos = 12;
    },
    (q) => {
      q.dice = [2, 1, 2];
      q.draft.tokens = [d(1, 1), o("+"), d(0, 2, "2"), o("+"), d(2, 2, "4")];
    },
  ]) {
    const q = structuredClone(s);
    change(q);
    assert.equal(commitAction(q, { departureCheck }).ok, false);
  }
  for (const status of ["checking", "error", "alternative", "unavailable"])
    assert.equal(
      commitAction(s, { departureCheck: { ...departureCheck, status } }).ok,
      false,
    );
  const restored = validateSave(JSON.parse(JSON.stringify(s)));
  assert.equal(commitAction(restored).ok, false);
  const other = sharedDeparture();
  const alternative = {
    key: departureCheckKey(other),
    ...assessDeparture(other.dice, 6, sum),
  };
  assert.equal(commitAction(other, { departureCheck: alternative }).ok, false);
});
