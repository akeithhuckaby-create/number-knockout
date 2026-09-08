import test from "node:test";
import assert from "node:assert/strict";
import {
  newGame,
  neighbours,
  DRAGON,
  canSlay,
  targets,
  commitAction,
  finishTurn,
  validateSave,
  departureRule,
} from "../src/game.js";
import { solve } from "../src/solver.js";
import { equationKey } from "../src/equations.js";
const distances = new Map(DRAGON.map((p) => [p, 0])),
  queue = [...DRAGON];
for (const p of queue)
  for (const n of neighbours(p))
    if (!distances.has(n)) {
      distances.set(n, distances.get(p) + 1);
      queue.push(n);
    }
test("three complete seeded races finish with verified dragon wins and restorable turns", () => {
  for (const seed of [1, 42, 9182]) {
    let s = newGame({ seed });
    for (let turn = 0; turn < 140 && s.phase !== "over"; turn++) {
      const solutions = solve(s.dice),
        byTarget = new Map(solutions.map((x) => [x.target, x]));
      s.draft.action = canSlay(s) && byTarget.has(s.dragon) ? "slay" : "move";
      const target = targets(s)
        .filter((t) => byTarget.has(t.required))
        .sort((a, b) => distances.get(a.pos) - distances.get(b.pos))[0];
      let solution = target && byTarget.get(target.required);
      if (target) {
        const rule = departureRule(s, target.pos);
        if (rule)
          solution = solve(s.dice, {
            min: target.required,
            max: target.required,
            exclude: [equationKey(rule.tokens)],
          })[0];
        s.draft.target = target.pos;
        s.draft.tokens = solution?.tokens || [];
      }
      const result = commitAction(s, { pass: !solution });
      assert.ok(result.ok);
      s = result.state;
      assert.ok(validateSave(s), `turn ${s.turn} restores`);
      if (s.phase !== "over") s = finishTurn(s);
    }
    assert.equal(s.phase, "over", `seed ${seed} ends`);
    assert.notEqual(s.winner, "draw");
    assert.equal(s.history.at(-1).action, "slay");
    assert.equal(s.history.at(-1).value, s.dragon);
  }
});
test("malformed saved chronicle and hint fields are safely repaired", () => {
  const s = newGame();
  s.history = [{ player: 0, action: "move", expression: "2+3+4", dice: {} }];
  s.hintsUsed = ["bad", {}];
  const restored = validateSave(s);
  assert.deepEqual(restored.history, []);
  assert.deepEqual(restored.hintsUsed, [0, 0]);
  s.phase = "over";
  s.winner = 0;
  assert.equal(validateSave(s), null);
});

test("saved history accepts numeric action results and discards markup in numeric fields", () => {
  const s = newGame();
  const entry = {
    player: 0,
    action: "move",
    turn: 1,
    name: "Gold Knight",
    dice: [4, 2, 2],
    expression: "4 × 2 − 2",
    value: 6,
    number: 6,
    target: 1,
  };
  s.history = [
    entry,
    { ...entry, value: '<img onerror="fail()">' },
    { ...entry, number: "<b>6</b>" },
  ];
  assert.deepEqual(validateSave(s).history, [entry]);
});
