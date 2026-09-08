import test from "node:test";
import assert from "node:assert/strict";
import {
  newGame,
  roll,
  targets,
  neighbours,
  commitAction,
  finishTurn,
  validateSave,
  wallCount,
} from "../src/game.js";
import { dieToken as d, opToken as o } from "../src/math.js";
test("dice exclude two or three ones across deterministic rolls", () => {
  const s = newGame({ seed: 123 });
  for (let i = 0; i < 2000; i++)
    assert.ok(roll(s).filter((v) => v === 1).length < 2);
});
test("one commit per turn and saved handoff finishes once", () => {
  const s = newGame({ seed: 1 });
  s.dice = [4, 2, 2];
  const i = s.board.indexOf(6);
  [s.board[0], s.board[i]] = [s.board[i], s.board[0]];
  s.draft.tokens = [d(0, 4), o("*"), d(1, 2), o("-"), d(2, 2)];
  const a = commitAction(s);
  assert.ok(a.ok);
  assert.equal(a.state.players[0].pos, 1);
  assert.equal(commitAction(a.state, { pass: true }).ok, false);
  const resumed = validateSave(a.state);
  assert.equal(resumed.current, 1);
  assert.equal(resumed.turn, 2);
  assert.deepEqual(finishTurn(resumed), resumed);
});
test("wall ownership, build capacity, break and restored capacity", () => {
  const s = newGame();
  s.players[1].pos = 14;
  s.walls = { 13: 1, 15: 0 };
  assert.ok(targets(s, "break").some((t) => t.pos === 13));
  assert.ok(!targets(s, "build").some((t) => [13, 14, 15].includes(t.pos)));
  s.dice = [2, 3, 4];
  s.board[12] = 1;
  s.draft = {
    action: "break",
    target: 13,
    tokens: [d(0, 2), o("*"), d(1, 3), o("-"), d(2, 4)],
  };
  const a = commitAction(s);
  assert.ok(a.ok);
  assert.equal(wallCount(a.state, 1), 0);
  assert.equal(a.state.players[0].pos, 0);
});
test("a draw requires six separate completed turns", () => {
  let s = newGame();
  for (let i = 0; i < 6; i++) {
    s = commitAction(s, { pass: true }).state;
    if (i < 5) s = finishTurn(s);
  }
  assert.equal(s.phase, "over");
  assert.equal(s.winner, "draw");
  assert.equal(s.history.length, 6);
});
test("save roundtrip includes draft and rejects corrupt boards", () => {
  const s = newGame();
  s.draft.tokens = [d(1, s.dice[1])];
  s.draft.cursor = 1;
  assert.deepEqual(validateSave(JSON.parse(JSON.stringify(s))), s);
  s.board[0] = s.board[1];
  assert.equal(validateSave(s), null);
});
test("dragon attack requires adjacency and finishes without moving to an unrelated tile", () => {
  const s = newGame();
  s.players[0].pos = 35;
  s.dragon = 18;
  s.dice = [2, 3, 5];
  s.draft = {
    action: "slay",
    target: 30,
    tokens: [d(0, 2, "2"), o("+"), d(1, 3, "2"), o("+"), d(2, 5)],
  };
  const a = commitAction(s);
  assert.ok(a.ok);
  assert.equal(a.state.winner, 0);
  assert.equal(a.state.players[0].pos, 35);
  assert.equal(
    targets(
      {
        ...s,
        players: [
          { name: "A", pos: 0 },
          { name: "B", pos: 0 },
        ],
      },
      "slay",
    ).length,
    0,
  );
});
