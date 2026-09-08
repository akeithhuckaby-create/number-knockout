import {
  targets,
  previewAction,
  departureRule,
  departureCheckKey,
} from "./game.js";
import { neighbours, ENTRY_POSITIONS, DRAGON_POS } from "./route.js";
import { solve, assessDeparture } from "./solver.js";

// Estimate turns to the dragon. An opposing wall costs a break and an entry;
// dice are not predicted and the next random roll is never inspected.
export function distanceToDragon(s, player, start = s.players[player].pos) {
  const distances = new Map([[start, 0]]),
    pending = new Set([start]);
  while (pending.size) {
    const p = [...pending].sort(
      (a, b) => distances.get(a) - distances.get(b),
    )[0];
    pending.delete(p);
    if (p === DRAGON_POS) return distances.get(p);
    for (const n of p === 0 ? ENTRY_POSITIONS : neighbours(p)) {
      if (n === 0) continue;
      const cost = distances.get(p) + (s.walls[n] === 1 - player ? 2 : 1);
      if (cost < (distances.get(n) ?? Infinity)) {
        distances.set(n, cost);
        pending.add(n);
      }
    }
  }
  return Infinity;
}

export function chooseComputerAction(s) {
  if (s.phase !== "input") throw Error("It is not time to choose an action.");
  const player = s.current,
    opponent = 1 - player;
  const answers = new Map(
    solve(s.dice).map((answer) => [answer.target, answer]),
  );
  const mine = distanceToDragon(s, player),
    theirs = distanceToDragon(s, opponent);
  const candidates = [];
  for (const action of ["slay", "move", "break", "build"]) {
    if (action === "build" && s.difficulty === "squire") continue;
    for (const target of targets(s, action)) {
      let solution = answers.get(target.required),
        departureCheck = null;
      const draft = { action, target: target.pos, tokens: [], cursor: 0 };
      const proposed = { ...s, draft };
      const rule = departureRule(proposed, target.pos);
      if (rule) {
        const result = assessDeparture(s.dice, target.required, rule.tokens);
        solution = result.solution;
        departureCheck = {
          key: departureCheckKey(proposed, target.pos),
          ...result,
        };
      }
      if (!solution) continue;
      draft.tokens = solution.tokens;
      draft.cursor = draft.tokens.length;
      if (!previewAction(proposed, { departureCheck }).ok) continue;
      let score = 0,
        reason = "";
      if (action === "slay") {
        score = 10000;
        reason = "Making the dragon’s number to win the quest.";
      }
      if (action === "move") {
        const remaining = distanceToDragon(s, player, target.pos),
          progress = mine - remaining;
        const visits = s.history
          .slice(-12)
          .filter(
            (e) =>
              e.player === player &&
              e.action === "move" &&
              e.target === target.pos,
          ).length;
        score = progress * 100 + 10 - visits * 12;
        reason =
          progress > 0
            ? "Moving closer to the dragon."
            : "Trying another branch of the trail.";
      }
      if (action === "break") {
        const after = { ...s, walls: { ...s.walls } };
        delete after.walls[target.pos];
        const gain = mine - distanceToDragon(after, player);
        if (gain <= 0) continue;
        score = 110 * gain;
        reason = "Clearing an opposing wall from the route ahead.";
      }
      if (action === "build") {
        const after = { ...s, walls: { ...s.walls, [target.pos]: player } };
        const delay = distanceToDragon(after, opponent) - theirs;
        if (delay <= 0) continue;
        score = delay * 50 + (theirs <= 3 ? 180 : mine > theirs + 2 ? 80 : 0);
        reason = "Placing a wall to slow your approach to the dragon.";
      }
      score -= Math.min(solution.cost ?? 0, 100) * 0.01;
      if (score > 0)
        candidates.push({
          action,
          target: target.pos,
          tokens: solution.tokens,
          departureCheck,
          reason,
          score,
        });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.target - b.target);
  return (
    candidates[0] || {
      action: "pass",
      target: null,
      tokens: [],
      departureCheck: null,
      reason: "No useful action found for this roll. Passing the turn.",
    }
  );
}
