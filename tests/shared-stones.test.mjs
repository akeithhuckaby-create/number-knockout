import test from "node:test";
import assert from "node:assert/strict";
import {
  newGame,
  reachable,
  targets,
  commitAction,
  validateSave,
} from "../src/game.js";
import { dieToken as d, opToken as o } from "../src/math.js";

test("either knight can join the other, resume together, and leave independently", () => {
  for (const mover of [0, 1]) {
    const s = newGame({
      board: Array.from({ length: 36 }, (_, i) => i + 1),
      starter: mover,
    });
    s.players[mover].pos = 13;
    s.players[1 - mover].pos = 14;
    [s.board[13], s.board[5]] = [s.board[5], s.board[13]];
    s.dice = [4, 2, 2];
    s.draft = {
      action: "move",
      target: 14,
      cursor: 5,
      tokens: [d(0, 4), o("*"), d(1, 2), o("-"), d(2, 2)],
    };
    const joined = commitAction(s);
    assert.ok(joined.ok);
    assert.deepEqual(
      joined.state.players.map((p) => p.pos),
      [14, 14],
    );
    const resumed = validateSave(JSON.parse(JSON.stringify(joined.state)));
    assert.ok(resumed);
    assert.equal(resumed.current, 1 - mover);
    assert.deepEqual(
      resumed.players.map((p) => p.pos),
      [14, 14],
    );
    assert.ok(
      !reachable(resumed).includes(14),
      "sharing does not allow standing still as a move",
    );
    resumed.dice = [3, 3, 4];
    resumed.draft = {
      action: "move",
      target: 13,
      cursor: 5,
      tokens: [d(0, 3), o("*"), d(1, 3), o("+"), d(2, 4)],
    };
    const leaving = commitAction(resumed);
    assert.ok(leaving.ok);
    assert.equal(leaving.state.players[mover].pos, 14);
    assert.equal(leaving.state.players[1 - mover].pos, 13);
  }
});

test("opposing walls still block occupied stones and neither knight can be built over", () => {
  const s = newGame();
  s.players[0].pos = 13;
  s.players[1].pos = 14;
  s.walls[14] = 1;
  assert.ok(!reachable(s).includes(14));
  assert.ok(!targets(s, "build").some((t) => t.pos === 13));
  delete s.walls[14];
  assert.ok(reachable(s).includes(14));
  s.players[0].pos = 14;
  assert.ok(validateSave(s));
  s.walls[14] = 0;
  assert.equal(
    validateSave(s),
    null,
    "a shared stone cannot put Blue inside an opposing Gold wall",
  );
});

test("sharing a lair approach still awards victory only to the knight who attacks", () => {
  const s = newGame({ starter: 1, dragon: 18 });
  s.players.forEach((p) => (p.pos = 35));
  s.dice = [2, 3, 5];
  s.draft = {
    action: "slay",
    target: 30,
    cursor: 5,
    tokens: [d(0, 2, "2"), o("+"), d(1, 3, "2"), o("+"), d(2, 5)],
  };
  const result = commitAction(s);
  assert.ok(result.ok);
  assert.equal(result.state.winner, 1);
  assert.equal(result.state.phase, "over");
  assert.deepEqual(
    result.state.players.map((p) => p.pos),
    [35, 35],
  );
  assert.ok(validateSave(result.state));
  assert.equal(commitAction(result.state).ok, false);
});
