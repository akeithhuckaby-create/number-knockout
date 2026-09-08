import test from "node:test";
import assert from "node:assert/strict";
import {
  ROUTE_NODES,
  ROUTE_EDGES,
  ROUTE_POINTS,
  neighbours,
  stepsToLair,
} from "../src/route.js";
import { newGame, targets, reachable, canSlay } from "../src/game.js";
import { readGame, SAVE_KEY } from "../src/storage.js";

test("all 34 stones belong to the visible trail; every connection is usable in both directions", () => {
  assert.equal(ROUTE_NODES.length, 34);
  assert.equal(new Set(ROUTE_NODES.map((n) => n.id)).size, 34);
  for (const n of ROUTE_NODES) {
    assert.ok(stepsToLair(n.id) > 0);
    assert.ok(!neighbours(n.id).includes(0));
  }
  for (const [a, b] of ROUTE_EDGES) {
    assert.ok(neighbours(a).includes(b));
    if (a !== 0) assert.ok(neighbours(b).includes(a));
  }
  assert.deepEqual(neighbours(0), [1, 2]);
});
test("trail lines never cross or pass through an unrelated stone", () => {
  const cross = (a, b, c) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < ROUTE_EDGES.length; i++) {
    const [a, b] = ROUTE_EDGES[i],
      p = ROUTE_POINTS.get(a),
      q = ROUTE_POINTS.get(b);
    for (let j = i + 1; j < ROUTE_EDGES.length; j++) {
      const [c, d] = ROUTE_EDGES[j];
      if ([a, b].some((x) => [c, d].includes(x))) continue;
      const r = ROUTE_POINTS.get(c),
        s = ROUTE_POINTS.get(d);
      assert.ok(
        !(
          cross(p, q, r) * cross(p, q, s) < 0 &&
          cross(r, s, p) * cross(r, s, q) < 0
        ),
        `crossing ${a}-${b} / ${c}-${d}`,
      );
    }
    for (const r of ROUTE_NODES) {
      if ([a, b].includes(r.id)) continue;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((r.x - p.x) * (q.x - p.x) + (r.y - p.y) * (q.y - p.y)) /
            ((q.x - p.x) ** 2 + (q.y - p.y) ** 2),
        ),
      );
      assert.ok(
        Math.hypot(r.x - p.x - t * (q.x - p.x), r.y - p.y - t * (q.y - p.y)) >
          45,
        `stone ${r.id} touches unrelated edge ${a}-${b}`,
      );
    }
  }
});
test("fork movement follows edges and respects occupancy and wall ownership", () => {
  const s = newGame();
  assert.deepEqual(reachable(s), [1, 2]);
  s.players[0].pos = 14;
  assert.deepEqual(new Set(reachable(s)), new Set([13, 15, 22]));
  assert.ok(
    !reachable(s).includes(23),
    "nearby stone across a gap is not a move",
  );
  s.players[1].pos = 13;
  s.walls = { 15: 1, 22: 0 };
  assert.deepEqual(reachable(s), [22]);
  s.players[1].pos = 3;
  assert.deepEqual(
    new Set(targets(s, "build").map((t) => t.pos)),
    new Set([1, 2, 4, 9]),
  );
});
test("only the two connected lair approaches permit a dragon attack", () => {
  const s = newGame();
  for (const pos of [0, ...ROUTE_NODES.map((n) => n.id)]) {
    s.players[0].pos = pos;
    assert.equal(canSlay(s), [35, 36].includes(pos));
    assert.ok(!reachable(s).includes(30));
  }
});
test("advanced grid saves stay untouched; only a quest still at the gates migrates", () => {
  const old = { ...newGame({ seed: 42 }), version: 2 };
  delete old.route;
  const map = new Map([["knights-path:v2", JSON.stringify(old)]]);
  const storage = {
    getItem: (k) => map.get(k),
    setItem: (k, v) => map.set(k, v),
  };
  const compatible = readGame(storage);
  assert.ok(compatible.migrated);
  assert.equal(compatible.state.version, 3);
  old.players[0].pos = 1;
  const raw = JSON.stringify(old);
  map.set("knights-path:v2", raw);
  const result = readGame(storage);
  assert.ok(result.recovery);
  assert.equal(result.raw, raw);
  assert.match(result.reason, /different rules/);
  assert.equal(map.get("knights-path:v2"), raw);
  assert.equal(map.get(SAVE_KEY), undefined);
});
