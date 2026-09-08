import test from "node:test";
import assert from "node:assert/strict";
import { solve } from "../src/solver.js";
import { evaluate } from "../src/math.js";
test("Oracle verifies every suggested expression and remaps duplicate dice", () => {
  for (const dice of [
    [4, 2, 2],
    [2, 3, 5],
    [6, 6, 3],
    [1, 2, 3],
  ]) {
    const results = solve(dice);
    assert.ok(results.length > 15);
    for (const s of results) {
      const check = evaluate(s.tokens, dice);
      assert.equal(check.ok, true);
      assert.equal(check.integer, s.target);
    }
  }
  const first = solve([4, 2, 2]);
  const reordered = solve([2, 4, 2]);
  assert.equal(first.length, reordered.length);
  for (const s of reordered)
    assert.equal(evaluate(s.tokens, [2, 4, 2]).integer, s.target);
});
test("Oracle returns a simple solution for the starting lesson", () => {
  const s = solve([4, 2, 2]).find((s) => s.target === 6);
  assert.ok(s);
  assert.ok(s.tokens.every((t) => t.kind !== "die" || t.power === "1"));
});
test("Oracle range limits are explicit", () => {
  assert.throws(() => solve([1, 2, 3], { min: 1, max: 999 }), /200/);
});
