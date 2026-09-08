import test from "node:test";
import assert from "node:assert/strict";
import {
  newGame,
  validateSave,
  isComputerPlayer,
  commitAction,
  finishTurn,
} from "../src/game.js";
import { chooseComputerAction, distanceToDragon } from "../src/computer.js";
import { createComputerTurnRunner } from "../src/computer-turn.js";
import { dieToken as d, opToken as o, evaluate } from "../src/math.js";
import { equationKey } from "../src/equations.js";
function apply(s, plan) {
  const next = structuredClone(s);
  if (plan.action !== "pass")
    next.draft = {
      action: plan.action,
      target: plan.target,
      tokens: plan.tokens,
      cursor: plan.tokens.length,
    };
  return commitAction(next, {
    pass: plan.action === "pass",
    departureCheck: plan.departureCheck,
  });
}
function arrange(s, pos, number) {
  const i = s.board.indexOf(number);
  [s.board[pos - 1], s.board[i]] = [s.board[i], s.board[pos - 1]];
}
test("solo settings restore, old saves remain two-player, and malformed modes do not start a computer", () => {
  const s = newGame({ mode: "computer", difficulty: "squire" });
  assert.equal(isComputerPlayer(s, 0), false);
  assert.equal(isComputerPlayer(s, 1), true);
  const restored = validateSave(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.mode, "computer");
  assert.equal(restored.difficulty, "squire");
  delete s.mode;
  delete s.difficulty;
  assert.equal(validateSave(s).mode, "two-player");
  s.mode = "unknown";
  assert.equal(validateSave(s), null);
  s.mode = "computer";
  s.difficulty = "impossible";
  assert.equal(validateSave(s), null);
});
test("computer uses legal exact actions, does not mutate the game or inspect future rolls, and wins when ready", () => {
  const s = newGame({ seed: 42, mode: "computer", starter: 1, dragon: 18 });
  s.dice = [2, 3, 5];
  s.players[1].pos = 35;
  const before = structuredClone(s),
    plan = chooseComputerAction(s);
  assert.equal(plan.action, "slay");
  assert.equal(evaluate(plan.tokens, s.dice).integer, 18);
  assert.deepEqual(s, before);
  assert.equal(apply(s, plan).state.winner, 1);
  const future = structuredClone(s);
  future.rng = 999999;
  future.seed = 1234;
  assert.deepEqual(chooseComputerAction(future), plan);
});
test("Squire clears a blocking wall; Knight defends against an imminent dragon attack", () => {
  const s = newGame({
    seed: 42,
    mode: "computer",
    difficulty: "squire",
    starter: 1,
  });
  s.players[1].pos = 1;
  s.dice = [4, 2, 2];
  s.walls[3] = 0;
  arrange(s, 3, 4);
  const clear = chooseComputerAction(s);
  assert.equal(clear.action, "break");
  assert.equal(clear.target, 3);
  assert.ok(apply(s, clear).ok);
  const t = newGame({
    seed: 42,
    mode: "computer",
    difficulty: "knight",
    starter: 1,
  });
  t.players[0].pos = 33;
  t.players[1].pos = 13;
  t.dice = [2, 3, 5];
  arrange(t, 34, 18);
  const defend = chooseComputerAction(t);
  assert.equal(defend.action, "build");
  assert.ok(apply(t, defend).ok);
  t.difficulty = "squire";
  assert.notEqual(chooseComputerAction(t).action, "build");
});
test("computer follows shared-stone equation restrictions and the same one-method exception", () => {
  for (const single of [false, true]) {
    let s = newGame({ seed: 42, mode: "computer", difficulty: "squire" });
    s.players.forEach((p) => (p.pos = 13));
    const dice = single ? [1, 2, 2] : [1, 2, 3],
      number = single ? 21 : 6;
    arrange(s, 14, number);
    s.dice = dice;
    const tokens = single
      ? [d(0, 1), o("+"), d(1, 2, "2"), o("+"), d(2, 2, "4")]
      : [d(0, 1), o("+"), d(1, 2), o("+"), d(2, 3)];
    s.draft = { action: "move", target: 14, tokens, cursor: 5 };
    s = finishTurn(commitAction(s).state);
    s.dice = dice;
    const plan = chooseComputerAction(s);
    assert.equal(plan.action, "move");
    assert.equal(plan.target, 14);
    assert.equal(equationKey(plan.tokens) === equationKey(tokens), single);
    assert.equal(
      plan.departureCheck.status,
      single ? "only-method" : "alternative",
    );
    const result = apply(s, plan);
    assert.ok(result.ok);
    assert.deepEqual(
      result.state.players.map((p) => p.pos),
      [14, 14],
    );
  }
});
test("computer passes without inventing an equation when its current roll cannot help", () => {
  const s = newGame({
    seed: 42,
    mode: "computer",
    difficulty: "squire",
    starter: 1,
  });
  s.dice = [6, 6, 6];
  arrange(s, 1, 21);
  arrange(s, 2, 17);
  const plan = chooseComputerAction(s);
  assert.equal(plan.action, "pass");
  assert.ok(apply(s, plan).ok);
});
test("complete computer races end in verified wins or legal draws with restorable turns", () => {
  for (const difficulty of ["squire", "knight"])
    for (const seed of [1, 42, 9182]) {
      let s = newGame({ seed, mode: "computer", difficulty });
      for (let i = 0; i < 200 && s.phase !== "over"; i++) {
        const plan = chooseComputerAction(s),
          result = apply(s, plan);
        assert.ok(result.ok, `${difficulty} seed ${seed} turn ${s.turn}`);
        assert.ok(validateSave(result.state));
        s =
          result.state.phase === "handoff"
            ? finishTurn(result.state)
            : result.state;
      }
      assert.equal(s.phase, "over", `${difficulty} seed ${seed} finishes`);
      if (s.winner !== "draw") assert.equal(s.history.at(-1).action, "slay");
    }
});
const tick = () => new Promise((resolve) => setImmediate(resolve));
function runnerHarness() {
  let key = "game:2:1",
    plans = [],
    delays = [],
    shown = [],
    commits = [],
    reports = [];
  const runner = createComputerTurnRunner({
    getKey: () => key,
    plan: (signal) =>
      new Promise((resolve, reject) => plans.push({ resolve, reject, signal })),
    delay: (ms, signal) =>
      new Promise((resolve) => delays.push({ resolve, ms, signal })),
    show: (plan) => shown.push(plan),
    commit: (plan) => {
      commits.push(plan);
      key = null;
      runner.sync();
    },
    report: (...r) => reports.push(r),
  });
  return {
    runner,
    plans,
    delays,
    shown,
    commits,
    reports,
    setKey: (k) => {
      key = k;
    },
  };
}
test("computer turn runner reveals and commits exactly once despite repeated renders", async () => {
  const h = runnerHarness();
  h.runner.sync();
  h.runner.sync();
  assert.equal(h.plans.length, 1);
  h.plans[0].resolve({ action: "move" });
  h.delays[0].resolve();
  await tick();
  assert.equal(h.shown.length, 1);
  assert.equal(h.commits.length, 0);
  h.runner.sync();
  h.delays[1].resolve();
  await tick();
  assert.equal(h.commits.length, 1);
  h.runner.sync();
  assert.equal(h.plans.length, 1);
});
test("pausing, practice, new quests and stale replies cannot commit an old computer turn", async () => {
  const h = runnerHarness();
  h.runner.sync();
  h.setKey(null);
  h.runner.sync();
  assert.ok(h.plans[0].signal.aborted);
  h.plans[0].resolve({ action: "old" });
  h.delays[0].resolve();
  await tick();
  assert.equal(h.shown.length, 0);
  h.setKey("new:2:1");
  h.runner.sync();
  h.plans[1].resolve({ action: "new" });
  h.delays[1].resolve();
  await tick();
  assert.equal(h.shown.length, 1);
  h.setKey(null);
  h.runner.sync();
  h.delays[2].resolve();
  await tick();
  assert.equal(h.commits.length, 0);
  h.setKey("new:2:1");
  h.runner.sync();
  assert.equal(h.plans.length, 3);
  h.runner.cancel();
});
test("computer search failures need a retry and do not spend a turn", async () => {
  const h = runnerHarness();
  h.runner.sync();
  h.plans[0].reject(Error("Search failed"));
  h.delays[0].resolve();
  await tick();
  assert.equal(h.reports.at(-1)[0], "error");
  assert.equal(h.commits.length, 0);
  h.runner.sync();
  assert.equal(h.plans.length, 1);
  h.runner.retry();
  assert.equal(h.plans.length, 2);
  h.runner.cancel();
});
