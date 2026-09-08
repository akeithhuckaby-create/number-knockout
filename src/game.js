import { evaluate, expressionText, validTokenShape } from "./math.js";
import { equationKey } from "./equations.js";
import {
  ROUTE_ID,
  DRAGON_POS,
  ENTRY_POSITIONS,
  POSITIONS,
  neighbours,
} from "./route.js";
export { neighbours } from "./route.js";
export const VERSION = 3,
  DRAGON = [DRAGON_POS],
  MAX_WALLS = 3,
  ACTIONS = ["move", "build", "break", "slay"];
export const GAME_MODES = ["two-player", "computer"];
export const COMPUTER_LEVELS = ["squire", "knight"];
export const isComputerPlayer = (s, player = s.current) =>
  s.mode === "computer" && player === 1;
function nextRandom(s) {
  let t = (s.rng += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  s.rng >>>= 0;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function roll(s) {
  let d;
  do {
    d = Array.from({ length: 3 }, () => 1 + Math.floor(nextRandom(s) * 6));
  } while (d.filter((v) => v === 1).length >= 2);
  return d;
}
export const wallCount = (s, p) =>
  Object.values(s.walls).filter((v) => v === p).length;
export function newGame({
  seed = Date.now() >>> 0,
  names = ["Gold Knight", "Blue Knight"],
  hints = true,
  starter = 0,
  board = null,
  dragon = null,
  mode = "two-player",
  difficulty = "knight",
} = {}) {
  const s = {
    version: VERSION,
    route: ROUTE_ID,
    mode: GAME_MODES.includes(mode) ? mode : "two-player",
    difficulty: COMPUTER_LEVELS.includes(difficulty) ? difficulty : "knight",
    id: `${seed}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    seed: seed >>> 0,
    rng: seed >>> 0,
    board: Array.from({ length: 36 }, (_, i) => i + 1),
    dragon: 0,
    players: names.map((name) => ({
      name: String(name || "Knight")
        .trim()
        .slice(0, 28),
      pos: 0,
    })),
    current: starter,
    starter,
    walls: {},
    passes: [0, 0],
    turn: 1,
    phase: "input",
    winner: null,
    history: [],
    hints,
    hintsUsed: [0, 0],
    sharedExit: [null, null],
    draft: { tokens: [], action: "move", target: null, cursor: 0 },
  };
  for (let i = 35; i > 0; i--) {
    const j = Math.floor(nextRandom(s) * (i + 1));
    [s.board[i], s.board[j]] = [s.board[j], s.board[i]];
  }
  if (board) s.board = [...board];
  s.dragon = dragon ?? 15 + Math.floor(nextRandom(s) * 16);
  s.dice = roll(s);
  return s;
}
export function reachable(s, player = s.current) {
  const pos = s.players[player].pos,
    opp = 1 - player;
  return (pos ? neighbours(pos) : ENTRY_POSITIONS).filter(
    (p) => POSITIONS.has(p) && s.walls[p] !== opp,
  );
}
export function canSlay(s) {
  const p = s.players[s.current].pos;
  return p > 0 && neighbours(p).some((n) => DRAGON.includes(n));
}
export function targets(s, action = s.draft.action) {
  if (s.phase === "over") return [];
  let positions = [];
  if (action === "move") positions = reachable(s);
  if (action === "build" && wallCount(s, s.current) < MAX_WALLS) {
    const p = s.players[1 - s.current].pos;
    positions = p
      ? neighbours(p).filter(
          (n) =>
            POSITIONS.has(n) &&
            s.walls[n] === undefined &&
            !s.players.some((k) => k.pos === n),
        )
      : [];
  }
  if (action === "break")
    positions = Object.keys(s.walls)
      .map(Number)
      .filter((p) => s.walls[p] !== s.current);
  if (action === "slay")
    return canSlay(s)
      ? [{ pos: 30, number: s.dragon, required: s.dragon }]
      : [];
  return positions.map((pos) => ({
    pos,
    number: s.board[pos - 1],
    required: s.board[pos - 1] * (action === "break" ? 2 : 1),
  }));
}
export function actionReason(s, action) {
  if (action === "build")
    return wallCount(s, s.current) >= 3
      ? "All three walls are in play."
      : s.players[1 - s.current].pos
        ? "No connected stones beside your opponent are open."
        : "Your opponent must enter the board first.";
  if (action === "break") return "There are no opposing walls to break.";
  if (action === "slay")
    return "Follow the trail to a stone connected to the dragon.";
  return "No connected stones are open. Break a wall or pass.";
}
export function previewAction(s, { departureCheck = null } = {}) {
  if (s.phase !== "input")
    return {
      ok: false,
      message:
        s.phase === "over" ? "This quest has ended." : "The turn is changing.",
    };
  const math = evaluate(s.draft.tokens, s.dice);
  if (!math.ok) return { ...math, math };
  const choices = targets(s),
    chosen = choices.find((t) => t.pos === s.draft.target),
    matching = choices.filter((t) => t.required === math.integer);
  if (chosen && chosen.required !== math.integer)
    return {
      ok: false,
      math,
      message: `This equals ${math.display}; you need ${chosen.required}.`,
    };
  const target = chosen || matching[0];
  if (!target)
    return {
      ok: false,
      math,
      message: `No legal ${s.draft.action === "move" ? "destination" : "target"} matches ${math.display}.`,
    };
  const rule = departureRule(s, target.pos);
  if (rule && equationKey(s.draft.tokens) === equationKey(rule.tokens)) {
    if (
      departureCheck?.key === departureCheckKey(s, target.pos) &&
      departureCheck.status === "only-method"
    )
      return {
        ok: true,
        math,
        target,
        code: "only-method",
        message:
          "Repeat allowed — the Oracle found no different method for these dice and this target.",
      };
    return {
      ok: false,
      math,
      target,
      code: "repeated-method",
      message: `${s.players[rule.by].name} already used that method to reach ${target.number}. Use different operations, powers, or meaningful grouping. Reordering does not count.`,
    };
  }
  return {
    ok: true,
    math,
    target,
    message:
      s.draft.action === "slay"
        ? "Ready to slay the dragon."
        : `Ready — ${math.display} is an exact match.`,
  };
}
export function departureRule(s, target = s.draft.target) {
  const rule = s.sharedExit?.[s.current];
  return s.draft.action === "move" &&
    rule?.from === s.players[s.current].pos &&
    (target == null || rule.to === target)
    ? rule
    : null;
}
// A search result applies to this exact turn, roll, shared origin, and destination.
// It is kept outside saved state so refresh always performs a fresh check.
export function departureCheckKey(s, target = s.draft.target) {
  const rule = departureRule(s, target);
  return rule
    ? JSON.stringify([
        s.id,
        s.turn,
        s.current,
        rule.from,
        rule.to,
        s.dice,
        equationKey(rule.tokens),
      ])
    : null;
}
export function commitAction(
  state,
  { pass = false, departureCheck = null } = {},
) {
  if (state.phase !== "input")
    return { ok: false, state, message: "Wait for the next turn." };
  const preview = pass ? null : previewAction(state, { departureCheck });
  if (!pass && !preview.ok)
    return { ok: false, state, message: preview.message };
  const s = structuredClone(state),
    player = s.current,
    action = pass ? "pass" : s.draft.action;
  const entry = {
    turn: s.turn,
    player,
    name: s.players[player].name,
    action,
    dice: [...s.dice],
    expression: pass ? "" : expressionText(s.draft.tokens),
    value: preview?.math.integer ?? null,
    target: preview?.target.pos ?? null,
    number: preview?.target.number ?? null,
    ...(preview?.code === "only-method"
      ? { exception: "oracle-only-method" }
      : {}),
  };
  if (pass) s.passes[player]++;
  else s.passes[player] = 0;
  if (action === "move") {
    const from = s.players[player].pos;
    s.sharedExit ??= [null, null];
    s.sharedExit[player] = null;
    if (from > 0 && s.players[1 - player].pos === from)
      s.sharedExit[1 - player] = {
        from,
        to: preview.target.pos,
        by: player,
        dice: [...s.dice],
        tokens: structuredClone(s.draft.tokens),
      };
    s.players[player].pos = preview.target.pos;
  }
  if (action === "build") s.walls[preview.target.pos] = player;
  if (action === "break") delete s.walls[preview.target.pos];
  if (action === "slay") {
    s.winner = player;
    s.phase = "over";
  } else if (s.passes.every((n) => n >= 3)) {
    s.phase = "over";
    s.winner = "draw";
  } else s.phase = "handoff";
  s.history.push(entry);
  s.history = s.history.slice(-500);
  return { ok: true, state: s, entry };
}
export function finishTurn(state) {
  if (state.phase !== "handoff") return state;
  const s = structuredClone(state);
  s.current = 1 - s.current;
  s.turn++;
  s.dice = roll(s);
  s.phase = "input";
  s.draft = { tokens: [], action: "move", target: null, cursor: 0 };
  return s;
}
export function validateSave(raw) {
  try {
    if (
      !raw ||
      raw.version !== VERSION ||
      raw.route !== ROUTE_ID ||
      !Array.isArray(raw.board) ||
      raw.board.length !== 36 ||
      new Set(raw.board).size !== 36 ||
      !raw.board.every((n) => Number.isInteger(n) && n >= 1 && n <= 36)
    )
      return null;
    if (
      ![0, 1].includes(raw.current) ||
      !Array.isArray(raw.players) ||
      raw.players.length !== 2 ||
      !raw.players.every(
        (p) =>
          typeof p.name === "string" &&
          p.name.length <= 28 &&
          Number.isInteger(p.pos) &&
          (p.pos === 0 || POSITIONS.has(p.pos)),
      )
    )
      return null;
    if (
      !Array.isArray(raw.dice) ||
      raw.dice.length !== 3 ||
      !raw.dice.every((d) => Number.isInteger(d) && d >= 1 && d <= 6) ||
      raw.dice.filter((d) => d === 1).length >= 2
    )
      return null;
    if (
      !Number.isInteger(raw.dragon) ||
      raw.dragon < 15 ||
      raw.dragon > 30 ||
      !["input", "handoff", "over"].includes(raw.phase) ||
      !Number.isInteger(raw.rng) ||
      raw.rng < 0 ||
      raw.rng > 4294967295
    )
      return null;
    if (
      !raw.walls ||
      Object.keys(raw.walls).some(
        (k) =>
          !/^\d+$/.test(k) ||
          !POSITIONS.has(Number(k)) ||
          ![0, 1].includes(raw.walls[k]),
      ) ||
      [0, 1].some((p) => wallCount(raw, p) > 3)
    )
      return null;
    if (
      !Array.isArray(raw.passes) ||
      raw.passes.length !== 2 ||
      raw.passes.some((p) => !Number.isInteger(p) || p < 0) ||
      !Array.isArray(raw.history) ||
      raw.history.length > 500
    )
      return null;
    if (
      !Number.isInteger(raw.turn) ||
      raw.turn < 1 ||
      typeof raw.id !== "string"
    )
      return null;
    if (raw.phase === "over" && ![0, 1, "draw"].includes(raw.winner))
      return null;
    if (raw.phase !== "over" && raw.winner !== null) return null;
    if (raw.players.some((p, i) => p.pos && raw.walls[p.pos] === 1 - i))
      return null;
    const s = structuredClone(raw);
    s.mode ??= "two-player";
    s.difficulty ??= "knight";
    if (!GAME_MODES.includes(s.mode) || !COMPUTER_LEVELS.includes(s.difficulty))
      return null;
    if (s.sharedExit === undefined) s.sharedExit = [null, null];
    if (!Array.isArray(s.sharedExit) || s.sharedExit.length !== 2) return null;
    for (const [player, rule] of s.sharedExit.entries()) {
      if (rule === null) continue;
      if (
        !rule ||
        !POSITIONS.has(rule.from) ||
        s.players[player].pos !== rule.from ||
        !POSITIONS.has(rule.to) ||
        !neighbours(rule.from).includes(rule.to) ||
        rule.by !== 1 - player ||
        !Array.isArray(rule.dice) ||
        rule.dice.length !== 3 ||
        !rule.dice.every((n) => Number.isInteger(n) && n >= 1 && n <= 6) ||
        rule.dice.filter((n) => n === 1).length >= 2 ||
        !Array.isArray(rule.tokens) ||
        rule.tokens.length > 64 ||
        !rule.tokens.every(validTokenShape)
      )
        return null;
      const proof = evaluate(rule.tokens, rule.dice);
      if (!proof.ok || proof.integer !== s.board[rule.to - 1]) return null;
      equationKey(rule.tokens);
    }
    s.players.forEach((p) => (p.name = p.name.slice(0, 28)));
    s.history = s.history.filter(
      (e) =>
        e &&
        Number.isInteger(e.player) &&
        [0, 1].includes(e.player) &&
        [...ACTIONS, "pass"].includes(e.action) &&
        Number.isInteger(e.turn) &&
        e.turn > 0 &&
        typeof e.name === "string" &&
        e.name.length <= 28 &&
        Array.isArray(e.dice) &&
        e.dice.length === 3 &&
        e.dice.every((n) => Number.isInteger(n) && n >= 1 && n <= 6) &&
        (e.value === null ||
          (Number.isInteger(e.value) && e.value >= 1 && e.value <= 72)) &&
        (e.number === null ||
          (Number.isInteger(e.number) && e.number >= 1 && e.number <= 36)) &&
        (e.target === null ||
          POSITIONS.has(e.target) ||
          e.target === DRAGON_POS) &&
        typeof e.expression === "string" &&
        e.expression.length < 2000,
    );
    if (
      s.phase === "over" &&
      s.winner !== "draw" &&
      (s.history.at(-1)?.action !== "slay" ||
        s.history.at(-1)?.player !== s.winner ||
        s.history.at(-1)?.value !== s.dragon)
    )
      return null;
    if (
      !s.draft ||
      !ACTIONS.includes(s.draft.action) ||
      !Array.isArray(s.draft.tokens) ||
      s.draft.tokens.length > 64 ||
      !s.draft.tokens.every(validTokenShape)
    )
      s.draft = { tokens: [], action: "move", target: null, cursor: 0 };
    s.draft.cursor = Math.max(
      0,
      Math.min(s.draft.tokens.length, Math.trunc(Number(s.draft.cursor)) || 0),
    );
    if (
      !Number.isInteger(s.draft.target) ||
      s.draft.target < 1 ||
      s.draft.target > 36
    )
      s.draft.target = null;
    s.hintsUsed =
      Array.isArray(s.hintsUsed) &&
      s.hintsUsed.length === 2 &&
      s.hintsUsed.every((n) => Number.isSafeInteger(n) && n >= 0)
        ? s.hintsUsed
        : [0, 0];
    s.hints = s.hints !== false;
    s.starter = [0, 1].includes(s.starter) ? s.starter : 0;
    return s.phase === "handoff" ? finishTurn(s) : s;
  } catch {
    return null;
  }
}
export function migrateLegacy(old) {
  if (
    !old ||
    old.gameOver !== false ||
    !Array.isArray(old.knightPos) ||
    old.knightPos.length !== 2 ||
    old.knightPos.some((p) => p !== 0) ||
    !Array.isArray(old.obsEntries) ||
    old.obsEntries.length
  )
    return null;
  const s = newGame();
  Object.assign(s, {
    board: old.boardNums,
    dragon: old.dragon?.number,
    current: old.currentPlayer,
    dice: old.dice,
    passes: old.skipCount || [0, 0],
  });
  return validateSave(s);
}
export function migrateGridSave(old) {
  if (
    !old ||
    old.version !== 2 ||
    old.phase !== "input" ||
    old.players?.length !== 2 ||
    old.players.some((p) => p.pos !== 0) ||
    Object.keys(old.walls || {}).length ||
    old.history?.length
  )
    return null;
  return validateSave({
    ...old,
    version: VERSION,
    route: ROUTE_ID,
    draft: { ...old.draft, action: "move", target: null },
  });
}
