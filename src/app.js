import {
  newGame,
  DRAGON,
  targets,
  wallCount,
  actionReason,
  previewAction,
  commitAction,
  finishTurn,
} from "./game.js";
import { dieToken, opToken, evaluate, expressionText } from "./math.js";
import {
  insertPiece,
  deletePiece,
  changePower,
  availableDice,
} from "./editor.js";
import {
  readGame,
  writeGame,
  readSettings,
  writeSettings,
  SAVE_KEY,
} from "./storage.js";
import { clue } from "./solver.js";
import { playSound } from "./sound.js";
import {
  ROUTE_NODES,
  ROUTE_EDGES,
  ROUTE_POINTS,
  LAIR,
  edgePath,
} from "./route.js";
let mapExpanded = false;
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const label = {
    move: "Advance",
    build: "Build wall",
    break: "Break wall",
    slay: "Slay dragon",
    pass: "Pass",
  },
  symbol = { move: "➜", build: "♜", break: "⚒", slay: "⚔", pass: "»" },
  operators = { "+": "+", "-": "−", "*": "×", "/": "÷", "(": "(", ")": ")" };
const COLORS = ["Gold", "Blue"],
  ART = ["gold-knight", "blue-knight"];
let storage;
try {
  storage = window.localStorage;
} catch {
  storage = {
    getItem() {
      return null;
    },
    setItem() {
      throw Error("Unavailable");
    },
  };
}
const loaded = readGame(storage);
let state = loaded.state || newGame(),
  settings = readSettings(storage),
  saveBlocked = !!loaded.recovery,
  saveOK = true;
let selected = null,
  undo = [],
  powersOpen = false,
  historyOpen = false,
  helpOpen = false,
  tutorial = null,
  tutorialBackup = null,
  animation = null,
  timer = null,
  toastTimer = null;
let hint = { level: 0, target: null, solution: null, status: "idle" },
  worker = null,
  requestNumber = 0,
  requests = new Map();
let practice =
    document.body.dataset.page === "practice" || location.hash === "#practice",
  practiceDice = [2, 3, 5],
  practiceMin = 1,
  practiceMax = 36,
  practiceResults = null,
  practiceBusy = false;
const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
const reduced = () =>
  settings.motion === "reduce" ||
  (settings.motion === "system" && motionQuery.matches);
function announce(text) {
  $("#announcer").textContent = text;
}
function toast(text) {
  clearTimeout(toastTimer);
  $("#toast").textContent = text;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 4500);
}
function save() {
  if (tutorial || saveBlocked) return;
  saveOK = writeGame(storage, state);
  if (!saveOK)
    announce("Saving is unavailable. Your quest is playable for this session.");
}
function applySettings() {
  document.documentElement.dataset.contrast = settings.contrast
    ? "high"
    : "normal";
  document.documentElement.dataset.motion = reduced() ? "reduce" : "full";
}
function sound(action) {
  playSound(action, settings.sound);
}
function avatar(player, extra = "") {
  return `<span class="portrait ${player === 0 ? "gold" : "blue"} ${extra}" aria-hidden="true"><img src="./assets/${ART[player]}.jpg" alt=""></span>`;
}
function header() {
  return `<header class="masthead"><a class="brand" href="./" data-do="home" aria-label="Knight’s Path home"><img class="crest" src="./assets/crest.jpg" alt=""><span><span class="game-title">Knight’s Path</span><span class="tagline">A little strategy. A little courage. A lot of possibility.</span></span></a><nav aria-label="Game menu"><button class="icon-button" data-do="rules" aria-label="Help" title="How to play"><span aria-hidden="true">?</span><span class="nav-label">Help</span></button><button class="icon-button" data-do="sound" aria-label="${settings.sound ? "Mute sound" : "Enable sound"}" aria-pressed="${settings.sound}" title="${settings.sound ? "Mute" : "Enable"} sound"><span aria-hidden="true">${settings.sound ? "♪" : "♩"}</span><span class="nav-label">${settings.sound ? "Sound on" : "Sound off"}</span></button><button class="icon-button" data-do="menu" aria-label="Menu"><span aria-hidden="true">☰</span><span class="nav-label">Menu</span></button></nav></header>`;
}
function playerStrip() {
  return `<section class="player-strip" aria-label="Players">${state.players.map((p, i) => `<article class="player-card ${i === 0 ? "gold" : "blue"} ${state.current === i ? "active" : ""}">${avatar(i)}<div class="player-info"><h2>${esc(p.name)}</h2><p>${state.phase === "over" ? (state.winner === i ? "Victorious" : state.winner === "draw" ? "Quest drawn" : "Well played") : state.current === i ? "Your turn" : p.pos === 0 ? "At the gates" : "Awaiting turn"}</p></div><div class="wall-stock" aria-label="${wallCount(state, i)} of 3 walls in play"><span aria-hidden="true">♜</span><span>${wallCount(state, i)}<small> / 3 walls</small></span></div></article>`).join("")}</section>`;
}
function board() {
  const choices = targets(state),
    legal = new Set(choices.map((t) => t.pos)),
    active = state.draft.target;
  const playerPos = state.players[state.current].pos;
  const segments = ROUTE_EDGES.map(([a, b]) => {
    const linked =
      state.draft.action === "move" &&
      ((a === playerPos && legal.has(b)) || (b === playerPos && legal.has(a)));
    const chosen = linked && (a === active || b === active);
    return `<path class="trail-shadow" d="${edgePath(a, b)}"/><path class="trail-bed" d="${edgePath(a, b)}"/><path class="trail-stones ${linked ? "trail-open" : ""} ${chosen ? "trail-chosen" : ""}" d="${edgePath(a, b)}"/>`;
  }).join("");
  const stones = ROUTE_NODES.map((node) => {
    const pos = node.id,
      number = state.board[pos - 1],
      occupant = state.players.findIndex((p) => p.pos === pos),
      wall = state.walls[pos],
      selectedTile = active === pos;
    const name = `Stone ${number}${occupant >= 0 ? `, ${state.players[occupant].name}` : ""}${wall !== undefined ? `, ${COLORS[wall]} wall` : ""}${legal.has(pos) ? `, available to ${label[state.draft.action].toLowerCase()}` : ", unavailable"}`;
    return `<button type="button" class="tile route-stone ${legal.has(pos) ? "available" : ""} ${selectedTile ? "targeted" : ""} ${occupant >= 0 ? "occupied " + (occupant === 0 ? "gold" : "blue") : ""} ${animation?.target === pos ? "just-" + animation.action : ""}" style="left:${node.x / 10}%;top:${node.y / 9.1}%;--tilt:${node.tilt}deg" data-do="target" data-pos="${pos}" aria-label="${esc(name)}" aria-pressed="${selectedTile}" ${state.phase !== "input" ? "disabled" : ""}><span class="tile-number">${number}</span>${occupant >= 0 ? `<span class="piece ${occupant === 0 ? "gold" : "blue"}" aria-hidden="true"><img src="./assets/${ART[occupant]}.jpg" alt=""><span>${COLORS[occupant][0]}</span></span>` : ""}${wall !== undefined ? `<span class="player-wall ${wall === 0 ? "gold" : "blue"}" aria-hidden="true">♜<small>${COLORS[wall][0]}</small></span>` : ""}${selectedTile ? '<span class="target-corner" aria-hidden="true">◆</span>' : ""}</button>`;
  }).join("");
  return `<section class="board-section" aria-label="Quest trail"><div class="board-heading"><span><span class="eyebrow">THE WINDING ROAD</span><span class="turn-count">Turn ${state.turn}</span></span><button class="map-zoom" data-do="zoom-map" aria-pressed="${mapExpanded}">${mapExpanded ? "− Whole trail" : "+ Enlarge map"}</button></div><div class="board-frame path-frame"><div class="map-scroll ${mapExpanded ? "map-expanded" : ""}" tabindex="${mapExpanded ? "0" : "-1"}" aria-label="${mapExpanded ? "Enlarged map. Scroll to explore." : "Overview of the winding trail."}"><div class="route-map ${state.current === 0 ? "gold" : "blue"}"><svg class="trail-lines" viewBox="0 0 1000 910" aria-hidden="true"><defs><pattern id="road-stone" width="24" height="16" patternUnits="userSpaceOnUse"><image href="./assets/wall.jpg" x="-8" y="-26" width="145" height="73"/></pattern></defs>${segments}</svg><span class="region-label label-keep">THE OLD KEEP</span><span class="region-label label-wood">WHISPERING WOODS</span><span class="region-label label-pass">THE HIGH PASS</span><span class="region-label label-gates">THE GATES</span>${[0, 1].map((p) => `<div class="entry ${p === 0 ? "gold" : "blue"}" aria-label="${esc(state.players[p].name)} ${state.players[p].pos === 0 ? "at the gates" : "on the trail"}">${state.players[p].pos === 0 ? `<img src="./assets/${ART[p]}.jpg" alt=""><span>${COLORS[p][0]}</span>` : ""}</div>`).join("")}${stones}<button class="dragon route-lair ${state.draft.action === "slay" && legal.has(30) ? "available" : ""} ${state.draft.action === "slay" && active === 30 ? "targeted" : ""} ${state.phase === "over" && state.winner !== "draw" ? "defeated" : ""}" style="left:${LAIR.x / 10}%;top:${LAIR.y / 9.1}%" data-do="dragon" aria-label="Dragon, target ${state.dragon}${targets(state, "slay").length ? ", connected to your stone" : ", further along the trail"}" ${state.phase !== "input" ? "disabled" : ""}><img src="./assets/${state.phase === "over" && state.winner !== "draw" ? "victory" : "dragon"}.jpg" alt="${state.phase === "over" && state.winner !== "draw" ? "The dragon rests beside a crown" : "Emerald dragon guarding its lair"}"><span class="dragon-caption">THE DRAGON</span><strong>${state.dragon}</strong><span class="dragon-foot">${state.phase === "over" && state.winner !== "draw" ? "Defeated" : "Journey’s end"}</span></button></div></div></div><div class="trail-legend"><span><i aria-hidden="true"></i> Outlined stones are available</span><span>${mapExpanded ? "Scroll or swipe to explore" : "Follow the connected trail"}</span></div><details class="chronicle" ${historyOpen ? "open" : ""}><summary><span aria-hidden="true">▤</span> Battle Chronicle <small>${state.history.length} ${state.history.length === 1 ? "turn" : "turns"}</small></summary><ol>${state.history.length ? state.history.map((e) => `<li><span class="history-turn">${e.turn}</span><div><strong class="${e.player === 0 ? "text-gold" : "text-blue"}">${esc(e.name)}</strong> · ${e.action === "pass" ? "Passed" : label[e.action]}${e.number ? " · " + esc(e.number) : ""}<p>${e.expression ? `${esc(e.expression)} = ${esc(e.value)}` : "A moment to regroup."}<span> Dice ${esc(e.dice?.join(" · "))}</span></p></div></li>`).join("") : "<li>Your first step begins the story.</li>"}</ol></details></section>`;
}
function zoomMap() {
  mapExpanded = !mapExpanded;
  render();
  if (!mapExpanded) return;
  const container = $(".map-scroll"),
    map = $(".route-map");
  const point =
    ROUTE_POINTS.get(state.draft.target || state.players[state.current].pos) ||
    ROUTE_POINTS.get(0);
  container.scrollTo({
    left: (point.x / 1000) * map.clientWidth - container.clientWidth / 2,
    top: (point.y / 910) * map.clientHeight - container.clientHeight / 2,
    behavior: "instant",
  });
}
function tokenHTML(t, i) {
  return `<button class="expression-piece ${t.kind === "die" ? "die-token" : "operator-token"} ${selected === i ? "selected" : ""}" data-do="select-piece" data-index="${i}" aria-label="${t.kind === "die" ? `Die ${t.id + 1}: ${t.value}${t.power !== "1" ? " to the power " + t.power : ""}` : operators[t.value]}, select to replace" aria-pressed="${selected === i}">${t.kind === "die" ? `${t.power === "1/2" ? '<span class="root-mark">√</span>' : ""}${t.value}${!["1", "1/2"].includes(t.power) ? `<sup>${esc(t.power)}</sup>` : ""}` : operators[t.value]}</button>`;
}
function expressionEditor() {
  const d = state.draft,
    math = evaluate(d.tokens, state.dice),
    inventory = availableDice(d, state.dice, selected);
  let expression = "";
  for (let i = 0; i <= d.tokens.length; i++) {
    expression += `<button class="insertion-point ${d.cursor === i && selected === null ? "current" : ""}" data-do="cursor" data-index="${i}" aria-label="Insert at position ${i + 1}" tabindex="-1"><span></span></button>`;
    if (i < d.tokens.length) expression += tokenHTML(d.tokens[i], i);
  }
  const poweredIndex =
    selected !== null && d.tokens[selected]?.kind === "die"
      ? selected
      : d.tokens.findLastIndex((t) => t.kind === "die");
  const poweredDie = d.tokens[poweredIndex];
  return `<div class="equation-box"><div class="equation-label"><span>YOUR EXPRESSION</span><span>${d.tokens.filter((t) => t.kind === "die").length} / 3 dice</span></div><div class="expression-line ${!d.tokens.length ? "is-empty" : ""}" aria-label="Expression editor">${!d.tokens.length ? '<span class="expression-placeholder">Choose a die below…</span>' : expression}${math.complete ? `<span class="equals">=</span><output class="expression-result ${math.ok ? "valid" : ""}" aria-label="Result ${esc(math.display)}">${esc(math.display)}</output>` : ""}</div><p class="math-feedback ${math.ok ? "valid" : ""}">${math.ok ? "✓ " : ""}${esc(math.message)}</p>${selected !== null ? `<div class="selection-note">Piece ${selected + 1} selected. Choose a replacement.<button class="text-button" data-do="after-piece">Insert after →</button></div>` : ""}</div><div class="dice-rack ${animation?.action === "roll" ? "rolling" : ""}" aria-label="Your three rolled dice">${inventory.map((d) => `<button class="rolled-die ${d.used ? "used" : ""}" data-do="die" data-id="${d.id}" aria-label="Die ${d.id + 1}: ${d.value}${d.used ? ", already used" : ""}" ${d.used ? "disabled" : ""}><span>${d.value}</span><small>${d.used ? "USED" : ["I", "II", "III"][d.id]}</small></button>`).join("")}</div><div class="operation-grid" aria-label="Operations">${["+", "-", "*", "/"].map((op) => `<button class="operation" data-do="op" data-op="${op}" aria-label="${{ "+": "Add", "-": "Subtract", "*": "Multiply", "/": "Divide" }[op]}">${operators[op]}</button>`).join("")}</div><div class="editor-utility"><button data-do="op" data-op="(" aria-label="Open parenthesis">(</button><button data-do="op" data-op=")" aria-label="Close parenthesis">)</button><button class="power-toggle" data-do="powers" aria-expanded="${powersOpen}" aria-controls="power-panel"><span>x<sup>2</sup></span> Powers & roots <span class="chevron">${powersOpen ? "⌃" : "⌄"}</span></button></div>${
    powersOpen
      ? `<section class="power-panel" id="power-panel"><p>${poweredDie ? `Power applies to your <strong>${poweredDie.value}</strong> die (piece ${poweredIndex + 1}).` : "Add a die to your expression, then choose its power."}</p><div class="power-presets">${[
          ["1", "x"],
          ["0", "x⁰"],
          ["2", "x²"],
          ["3", "x³"],
          ["1/2", "√x"],
          ["1/3", "∛x"],
          ["-1", "x⁻¹"],
        ]
          .map(
            ([value, display]) =>
              `<button data-do="power" data-power="${value}" ${!poweredDie ? "disabled" : ""} aria-label="Power ${value}">${display}</button>`,
          )
          .join(
            "",
          )}</div><form id="power-form"><label for="custom-power">Custom power</label><div class="input-row"><input id="custom-power" name="power" inputmode="text" placeholder="e.g. 3/2" maxlength="10" aria-describedby="power-help"><button type="submit" ${!poweredDie ? "disabled" : ""}>Apply</button></div></form><p id="power-help" class="fine-print">Free powers use no dice. Fractions like 3/2 are welcome. This app supports powers ±128, denominators up to 64.</p></section>`
      : ""
  }<div class="edit-actions"><button data-do="undo" ${undo.length ? "" : "disabled"}>↶ <span>Undo</span></button><button data-do="delete" ${d.tokens.length ? "" : "disabled"} aria-label="Delete selected piece or preceding piece">⌫ <span>Delete</span></button><button data-do="clear" ${d.tokens.length ? "" : "disabled"}>× <span>Clear</span></button></div>`;
}
function turnPanel() {
  if (state.phase === "over") return endPanel();
  const d = state.draft,
    choices = targets(state),
    target = choices.find((t) => t.pos === d.target),
    preview = previewAction(state),
    match = preview.target,
    required = target?.required ?? match?.required;
  const title = required
    ? `Make ${required} to ${d.action === "move" ? "advance" : d.action === "build" ? "build" : d.action === "break" ? "break the wall" : "slay the dragon"}`
    : "Choose your next move";
  const button = preview.ok
    ? d.action === "move"
      ? `Move to ${match.number} →`
      : d.action === "build"
        ? `Build on ${match.number}`
        : d.action === "break"
          ? `Break wall ${match.number}`
          : "Slay the dragon ⚔"
    : "Forge your expression";
  const enabled = state.phase === "input";
  return `<section class="turn-panel ornate ${state.current === 0 ? "gold" : "blue"}" id="turn-panel" tabindex="-1" aria-label="Turn controls"><div class="panel-turn"><span>${esc(state.players[state.current].name)}’s turn</span><i aria-hidden="true">◆</i></div><h1 class="turn-title">${title}</h1><div class="action-tabs" role="group" aria-label="Choose action">${["move", "build", "break", "slay"].map((action) => `<button data-do="action" data-action="${action}" class="${d.action === action ? "active" : ""}" aria-pressed="${d.action === action}" title="${targets(state, action).length ? label[action] : actionReason(state, action)}"><span aria-hidden="true">${symbol[action]}</span><span>${label[action]}</span></button>`).join("")}</div><div class="target-control"><label for="target-select">${d.action === "break" ? "Make twice the wall number" : "Your target"}</label><select id="target-select" ${choices.length ? "" : "disabled"}><option value="">${choices.length ? "Select on the board or here" : "No available targets"}</option>${choices.map((t) => `<option value="${t.pos}" ${d.target === t.pos ? "selected" : ""}>${d.action === "slay" ? "Dragon" : d.action === "break" ? "Wall" : "Stone"} ${t.number}${d.action === "break" ? ` · make ${t.required}` : ""}</option>`).join("")}</select></div>${!choices.length ? `<p class="context-note">${esc(actionReason(state, d.action))}</p>` : ""}<fieldset class="editor-fieldset" ${!enabled ? "disabled" : ""}>${expressionEditor()}<p class="action-feedback ${preview.ok ? "ready" : ""}" aria-live="polite">${state.phase === "handoff" ? `Passing the turn to ${esc(state.players[1 - state.current].name)}…` : preview.math?.complete ? esc(preview.message) : target ? `Use all three dice to make ${target.required}.` : "Follow the trail to an outlined stone. Make its number."}</p><button class="primary commit" data-do="commit" ${preview.ok ? "" : "disabled"}>${button}</button><div class="turn-secondary"><button data-do="hint" ${!state.hints || hint.level >= 3 ? "disabled" : ""}>✦ <span>${hint.level >= 3 ? "All clues shown" : hint.level ? "Another clue" : "Ask the Oracle"}</span></button><button data-do="pass">» <span>Pass turn</span></button></div>${!state.hints ? '<p class="fine-print centered">Hints are off for this quest.</p>' : ""}${hint.status !== "idle" ? `<aside class="hint-box"><div class="eyebrow">THE ORACLE · ${hint.status === "loading" ? "SEARCHING" : `CLUE ${hint.level} OF 3`}</div><p>${hint.status === "loading" ? "Looking for a verified path…" : esc(clue(hint.solution, hint.level))}</p>${hint.level >= 3 && hint.solution ? '<p class="fine-print">Each rolled die is used once. Powers are free, and the result has been checked exactly.</p><button data-do="apply-hint">Use this expression →</button>' : ""}</aside>` : ""}</fieldset>${state.passes.some((n) => n >= 2) ? `<p class="draw-note">${state.players.map((p, i) => `${esc(p.name)}: ${Math.min(state.passes[i], 3)}/3 passes`).join(" · ")}<br>Three consecutive personal passes each ends the quest in a draw.</p>` : ""}<p class="keyboard-tip">Keyboard: numbers · + − * / · ( ) · Enter</p></section>`;
}
function endPanel() {
  const draw = state.winner === "draw",
    entry = state.history.at(-1);
  return `<section class="turn-panel ornate end-panel" id="turn-panel" tabindex="-1"><div class="eyebrow">${draw ? "A WORTHY STALEMATE" : "THE KINGDOM IS YOURS"}</div><span class="victory-mark" aria-hidden="true">${draw ? "⚖" : "♛"}</span><h1>${draw ? "A quest well fought" : esc(state.players[state.winner].name) + " wins!"}</h1><p>${draw ? "Both knights have passed on their last three turns. Gather your courage for another quest." : "The dragon falls. Courage, strategy, and a little arithmetic have carried you home."}</p>${!draw ? `<div class="winning-equation">${esc(entry.expression)} <strong>= ${esc(entry.value)}</strong></div>` : ""}<div class="match-stats"><span><strong>${state.history.length}</strong> turns played</span><span><strong>${state.hintsUsed.reduce((a, b) => a + b, 0)}</strong> Oracle clues</span></div><button class="primary" data-do="rematch" data-same="true">Rematch this board →</button><button data-do="rematch">Begin a new quest</button><button class="text-button" data-do="share">Share Knight’s Path ↗</button><p class="fine-print">${esc(state.players[1 - state.starter].name)} goes first next time.</p></section>`;
}
function tutorialBanner() {
  return tutorial
    ? `<aside class="lesson-banner"><div><span class="eyebrow">GUIDED QUEST · ${tutorial.step + 1} OF ${LESSONS.length}</span><h2>${LESSONS[tutorial.step].title}</h2><p>${LESSONS[tutorial.step].text}</p>${tutorial.done ? '<strong class="lesson-success">✓ Well done. You’ve got it.</strong>' : ""}</div><div class="lesson-buttons">${tutorial.done ? `<button class="primary" data-do="next-lesson">${tutorial.step === LESSONS.length - 1 ? "Finish tutorial" : "Next lesson"} →</button>` : '<button data-do="lesson-example">Show example</button>'}<button class="text-button" data-do="exit-tutorial">Exit tutorial</button></div></aside>`
    : "";
}
function footer() {
  return `<footer class="app-footer"><span>${tutorial ? "Tutorial · Your saved quest is safe" : saveBlocked ? "Saved quest protected · playing without autosave" : saveOK ? "◇ Saved on this browser" : "⚠ Saving unavailable · session only"}</span><button class="text-button" data-do="practice">Visit the Oracle ↗</button><span>Made for curious minds.</span></footer>`;
}
function render() {
  document.title = practice
    ? "The Oracle · Knight’s Path"
    : "Knight’s Path · A Math Adventure";
  $(".skip-link").textContent = practice
    ? "Skip to practice controls"
    : "Skip to turn controls";
  const oldMap = $(".map-scroll"),
    mapScroll = oldMap ? { x: oldMap.scrollLeft, y: oldMap.scrollTop } : null;
  const focused = document.activeElement,
    key = focused?.dataset?.do,
    id = focused?.id;
  const focusData = focused?.dataset ? Object.entries(focused.dataset) : [];
  applySettings();
  $("#app").innerHTML =
    `<div class="app-shell">${header()}${practice ? practiceScreen() : `${playerStrip()}${tutorialBanner()}<main class="game-layout">${board()}${turnPanel()}</main>${footer()}`}</div>`;
  if (mapExpanded && mapScroll && $(".map-scroll"))
    $(".map-scroll").scrollTo(mapScroll.x, mapScroll.y);
  const details = $(".chronicle");
  details?.addEventListener("toggle", () => (historyOpen = details.open));
  if (id && id !== "app")
    document.getElementById(id)?.focus({ preventScroll: true });
  else if (key) {
    const candidate = [...document.querySelectorAll(`[data-do="${key}"]`)].find(
      (e) => focusData.every(([k, v]) => e.dataset[k] === v),
    );
    if (candidate && !candidate.disabled)
      candidate.focus({ preventScroll: true });
  }
}
function resetEditor() {
  selected = null;
  undo = [];
  hint = { level: 0, target: null, solution: null, status: "idle" };
  powersOpen = false;
}
function edit(change) {
  if (state.phase !== "input" || practice) return;
  undo.push(structuredClone(state.draft));
  if (undo.length > 60) undo.shift();
  try {
    state.draft = change(state.draft);
    selected = null;
    save();
    render();
  } catch (error) {
    undo.pop();
    toast(error.message);
  }
}
function changeAction(action) {
  if (state.phase !== "input") return;
  state.draft.action = action;
  state.draft.target = null;
  hint = { level: 0, target: null, solution: null, status: "idle" };
  const choices = targets(state);
  if (choices.length === 1) state.draft.target = choices[0].pos;
  save();
  render();
  announce(
    choices.length
      ? `${label[action]}. ${choices.length} available targets.`
      : actionReason(state, action),
  );
}
function chooseTarget(pos) {
  if (state.phase !== "input") return;
  const target = targets(state).find((t) => t.pos === pos);
  if (!target) {
    toast(
      "That stone is not available for this action. Choose an outlined stone connected by the trail.",
    );
    return;
  }
  state.draft.target = pos;
  hint = { level: 0, target: null, solution: null, status: "idle" };
  save();
  render();
  announce(
    `Make ${target.required} to ${label[state.draft.action].toLowerCase()}.`,
  );
  if (innerWidth <= 900) {
    $("#turn-panel").scrollIntoView({
      behavior: reduced() ? "instant" : "smooth",
      block: "start",
    });
    $("#turn-panel").focus({ preventScroll: true });
  }
}
function animateMove(from, entry) {
  const piece = document.querySelector(`[data-pos="${entry.target}"] .piece`);
  const grid = document.querySelector(".route-map");
  if (!piece || !grid) return;
  const end = piece.getBoundingClientRect(),
    boardRect = grid.getBoundingClientRect();
  const ghost = document.createElement("span");
  ghost.className = "travel-piece";
  ghost.setAttribute("aria-hidden", "true");
  ghost.innerHTML = `<img src="./assets/${ART[entry.player]}.jpg" alt="">`;
  Object.assign(ghost.style, {
    left: `${from.x - boardRect.x}px`,
    top: `${from.y - boardRect.y}px`,
    width: `${end.width}px`,
    height: `${end.height}px`,
  });
  grid.append(ghost);
  piece.style.visibility = "hidden";
  const motion = ghost.animate(
    [
      { transform: "translate(0,0)" },
      { transform: `translate(${end.x - from.x}px,${end.y - from.y}px)` },
    ],
    { duration: 450, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" },
  );
  const cleanup = () => {
    ghost.remove();
    if (piece.isConnected) piece.style.visibility = "";
  };
  motion.finished.then(cleanup, cleanup);
}
function perform(pass = false) {
  if (
    tutorial &&
    !pass &&
    state.draft.action !== LESSONS[tutorial.step].action
  ) {
    toast(`For this lesson, choose ${label[LESSONS[tutorial.step].action]}.`);
    return;
  }
  if (tutorial && pass) {
    toast("Try the example to complete this lesson, or exit the tutorial.");
    return;
  }
  const previousPosition = state.players[state.current].pos;
  const previousElement = previousPosition
    ? document.querySelector(`[data-pos="${previousPosition}"]`)
    : document.querySelector(`.entry.${state.current === 0 ? "gold" : "blue"}`);
  const previousRect = previousElement?.getBoundingClientRect();
  const result = commitAction(state, { pass });
  if (!result.ok) {
    toast(result.message);
    return;
  }
  state = result.state;
  animation = result.entry;
  sound(result.entry.action);
  save();
  render();
  if (!reduced() && !tutorial && result.entry.action === "move" && previousRect)
    animateMove(previousRect, result.entry);
  announce(
    `${result.entry.name}: ${pass ? "passed" : label[result.entry.action] + (result.entry.number ? " " + result.entry.number : "")}.`,
  );
  if (tutorial) {
    tutorial.done = true;
    render();
    $(".lesson-banner").scrollIntoView({
      behavior: reduced() ? "instant" : "smooth",
      block: "start",
    });
    return;
  }
  if (state.phase === "over") {
    showVictory();
    return;
  }
  const id = state.id;
  clearTimeout(timer);
  timer = setTimeout(
    () => {
      if (state.id !== id || state.phase !== "handoff") return;
      state = finishTurn(state);
      resetEditor();
      animation = { action: "roll" };
      save();
      render();
      sound("roll");
      announce(
        `${state.players[state.current].name}’s turn. Dice ${state.dice.join(", ")}.`,
      );
      $("#turn-panel").focus({ preventScroll: true });
      animation = null;
    },
    reduced() ? 160 : 900,
  );
}
function newMatch(options = {}) {
  clearTimeout(timer);
  state = newGame(options);
  mapExpanded = false;
  saveBlocked = false;
  tutorial = null;
  tutorialBackup = null;
  animation = { action: "roll" };
  resetEditor();
  save();
  practice = false;
  setRoute(false);
  closeDialog();
  render();
  window.scrollTo(0, 0);
  sound("roll");
  announce(
    `${state.players[state.current].name} goes first. Dice ${state.dice.join(", ")}.`,
  );
}
function rematch(same) {
  newMatch({
    names: state.players.map((p) => p.name),
    hints: state.hints,
    starter: 1 - state.starter,
    ...(same ? { board: state.board, dragon: state.dragon } : {}),
  });
}
function openDialog(title, content, { closable = true, kind = "" } = {}) {
  const d = $("#dialog");
  if (d.open) d.close();
  d.className = kind;
  d.innerHTML = `<div class="dialog-top"><span class="eyebrow">KNIGHT’S PATH</span>${closable ? '<button class="close-button" data-do="close" aria-label="Close dialog">×</button>' : ""}</div><h2 id="dialog-title">${title}</h2>${content}`;
  d.showModal();
}
function closeDialog() {
  $("#dialog").close();
}
function welcome() {
  openDialog(
    loaded.state ? "Your quest awaits." : "Three dice. One grand adventure.",
    `<p class="dialog-lead">${loaded.state ? "Your knights, dice, and last expression are just as you left them." : "Forge an expression. Find your path. Be the first knight to conquer the dragon."}</p><div class="welcome-art"><img src="./assets/dragon.jpg" alt="The emerald dragon awaits"></div><p class="welcome-caption">2 players · 1 device · endless possibilities</p><div class="dialog-actions">${loaded.state ? '<button class="primary" data-do="resume">Continue quest →</button>' : '<button class="primary" data-do="setup">Begin a quest →</button>'}<button data-do="tutorial">Learn as you play</button><button class="text-button" data-do="practice">Practice with the Oracle ↗</button></div>`,
    { kind: "welcome-dialog" },
  );
}
function setup() {
  openDialog(
    "Choose your champions",
    `<p class="dialog-lead">Pass one device between two players. Make numbers to move, outwit your opponent, and reach the dragon.</p><form id="setup-form"><div class="setup-players">${[0, 1].map((i) => `<label class="setup-player ${i === 0 ? "gold" : "blue"}">${avatar(i)}<span>${COLORS[i]} champion</span><input name="player${i}" aria-label="${COLORS[i]} player name" maxlength="28" placeholder="${COLORS[i]} Knight" value="${esc(state.players[i].name)}"></label>`).join("")}</div><label class="check-row"><input name="hints" type="checkbox" checked> Allow Oracle hints <small>Clues teach without costing a turn.</small></label><div class="rules-glance"><p><b>01</b> Use all three dice once. Powers are free.</p><p><b>02</b> Make a connected stone’s number to advance.</p><p><b>03</b> Reach the dragon and make its number to win.</p></div><button class="primary" type="submit">Open the gates →</button></form>`,
  );
}
function confirmNew() {
  if (
    state.phase === "over" ||
    (!state.history.length && !state.draft.tokens.length)
  ) {
    setup();
    return;
  }
  openDialog(
    "Begin another quest?",
    `<p>This replaces your current quest on this browser. Your knights have played ${state.history.length} turns.</p><div class="dialog-actions"><button class="primary" data-do="setup">Choose a new quest</button><button data-do="close">Keep playing</button></div>`,
  );
}
function menu() {
  openDialog(
    "The adventurer’s kit",
    `<div class="menu-grid"><button data-do="rules">? <span>How to play</span></button><button data-do="tutorial">⚑ <span>Guided tutorial</span></button><button data-do="practice">✦ <span>Oracle practice</span></button><button data-do="share">↗ <span>Share game link</span></button><button data-do="settings">⚙ <span>Preferences</span></button><button data-do="new">↻ <span>New quest</span></button></div><p class="fine-print">${saveBlocked ? "Autosave is paused while a previous save is protected." : "Your quest saves automatically in this browser."} Shared links open the game; they do not create an online multiplayer room.</p>`,
  );
}
function preferences() {
  openDialog(
    "Make yourself comfortable",
    `<form id="settings-form"><label class="check-row"><input type="checkbox" name="sound" ${settings.sound ? "checked" : ""}> Sound effects <small>Short cues only. No background music.</small></label><label class="check-row"><input type="checkbox" name="contrast" ${settings.contrast ? "checked" : ""}> Extra contrast <small>Stronger boundaries and brighter supporting text.</small></label><label class="field-label" for="motion">Movement & animation</label><select id="motion" name="motion"><option value="system" ${settings.motion === "system" ? "selected" : ""}>Follow device preference</option><option value="reduce" ${settings.motion === "reduce" ? "selected" : ""}>Reduce motion</option><option value="full" ${settings.motion === "full" ? "selected" : ""}>Full motion</option></select><button class="primary" type="submit">Save preferences</button></form>`,
  );
}
function rules() {
  openDialog(
    "A path worth figuring out",
    `<div class="rules-content"><p class="dialog-lead">Roll three dice, create an expression, and take one action. The first knight to reach and defeat the dragon wins.</p><details open><summary>The math</summary><p>Use each rolled die exactly once. Two dice with the same value are still separate pieces. Add, subtract, multiply, divide, and group with parentheses.</p><p>Powers are free: <b>2² + 3² + 5 = 18</b> uses dice 2, 3, and 5. A root is a fractional power: √4 = 4<sup>1/2</sup>. Rolls with two or three ones are automatically rerolled.</p><p>The result must exactly equal the target. Close approximations do not count.</p></details><details><summary>Moving & the dragon</summary><p>Enter through either stone connected to the gates. Each turn, move one connection along the visible trail, forward or backward. At forks, choose your route. You cannot jump across gaps or occupy your opponent’s stone. Once on the trail, you cannot return to the gates. Outlines mark legal choices, not guaranteed solutions.</p><p>From a stone connected directly to the dragon, choose “Slay dragon” and make its number. You win immediately.</p></details><details><summary>Walls & passing</summary><p>Build on a stone connected to your opponent by making that stone’s number. You may have three walls in play. You can cross your own walls; opposing walls block you.</p><p>Break any opposing wall by making <b>twice</b> its number, even from far away. Breaking takes a turn and returns that wall to its owner’s supply.</p><p>Passing ends your turn. If both players pass on their last three personal turns, the quest is a draw. A successful action resets your own pass count.</p></details><details><summary>Editor & keyboard</summary><p>Click a piece to replace it or change its power. Use “Insert after” to add beside it. Delete removes the selected piece or the piece before the cursor. Undo reverses an entire edit.</p><p>Type a die’s number to use an available matching die; Alt + 1/2/3 chooses a particular die. Use + − * / ( ), arrow keys to move the insertion point, Backspace/Delete to remove, Ctrl/⌘ + Z to undo, and Enter for a valid action.</p></details><details><summary>Oracle & app rules</summary><p>The Oracle offers an operation clue, a partial expression, and a verified solution. Its search is limited: “No solution found” does not mean a target is impossible.</p><p>In this app, free powers attach to individual dice, not whole grouped expressions. Digit concatenation is not allowed. Practical limits: 64 expression pieces, powers with numerator up to ±128 and denominator up to 64. These are app choices, not official competition limits.</p><p>Knight’s Path adapts the arithmetic of National Number Knockout into its own adventure. <a href="https://classicalconversations.com/national-number-knockout/" target="_blank" rel="noopener">Official N2K resources ↗</a></p></details></div><button class="primary" data-do="close">Back to the adventure</button>`,
  );
}
function showVictory() {
  if (reduced()) return;
  const id = state.id;
  openDialog(
    state.winner === "draw" ? "A worthy stalemate." : "The dragon is defeated!",
    `<div class="victory-art"><img src="./assets/victory.jpg" alt="The emerald dragon rests beside a golden crown"></div><p class="dialog-lead">${state.winner === "draw" ? "Two determined knights. Another adventure awaits." : `${esc(state.players[state.winner].name)}, the kingdom celebrates your victory.`}</p><button class="primary" data-do="close">View the quest results →</button>`,
    { kind: "victory-dialog" },
  );
  setTimeout(() => {
    if (state.id === id)
      announce("Quest complete. View your results or begin a rematch.");
  }, 300);
}
async function share() {
  const url = new URL("./index.html", location.href);
  url.hash = "";
  const data = {
    title: "Knight’s Path",
    text: "Three dice. One grand adventure. Play a math duel together.",
    url: url.href,
  };
  try {
    if (navigator.share) {
      await navigator.share(data);
      return;
    }
    await navigator.clipboard.writeText(url.href);
    toast("Game link copied. Play together on one device.");
  } catch (error) {
    if (error.name !== "AbortError")
      openDialog(
        "Share the adventure",
        `<p>Copy this game link. It opens the game for a new same-device duel.</p><input class="share-url" aria-label="Game link" readonly value="${esc(url.href)}"><button class="primary" data-do="close">Done</button>`,
      );
  }
}
function getSolutions(dice, min = 1, max = 72) {
  return new Promise((resolve, reject) => {
    if (!worker) {
      try {
        worker = new Worker(new URL("./oracle.worker.js", import.meta.url), {
          type: "module",
        });
        worker.onmessage = ({ data }) => {
          const pending = requests.get(data.id);
          if (!pending) return;
          clearTimeout(pending.timer);
          requests.delete(data.id);
          data.error
            ? pending.reject(Error(data.error))
            : pending.resolve(data.solutions);
        };
        worker.onerror = () => {
          for (const p of requests.values()) {
            clearTimeout(p.timer);
            p.reject(Error("The Oracle could not finish. Try again."));
          }
          requests.clear();
          worker.terminate();
          worker = null;
        };
      } catch {
        reject(
          Error(
            "The Oracle is unavailable in this browser. You can still play.",
          ),
        );
        return;
      }
    }
    const id = ++requestNumber;
    requests.set(id, {
      resolve,
      reject,
      timer: setTimeout(() => {
        requests.delete(id);
        reject(Error("The Oracle took too long. Try a smaller range."));
      }, 12000),
    });
    worker.postMessage({ id, dice: [...dice], min, max });
  });
}
async function requestHint() {
  if (!state.hints || state.phase !== "input") return;
  const target = targets(state).find((t) => t.pos === state.draft.target);
  if (!target) {
    toast("Choose a target first so the Oracle knows what you need.");
    return;
  }
  if (hint.status === "loading" || hint.level >= 3) return;
  state.hintsUsed[state.current]++;
  save();
  if (hint.target === target.required && hint.status === "ready") {
    hint.level = Math.min(3, hint.level + 1);
    render();
    return;
  }
  const identity = state.id,
    turn = state.turn,
    pos = target.pos;
  hint = {
    level: 1,
    target: target.required,
    status: "loading",
    solution: null,
  };
  render();
  try {
    const solutions = await getSolutions(state.dice);
    if (
      state.id !== identity ||
      state.turn !== turn ||
      state.draft.target !== pos
    )
      return;
    hint = {
      level: 1,
      target: target.required,
      status: "ready",
      solution: solutions.find((s) => s.target === target.required),
    };
    if (!practice) {
      render();
      announce(clue(hint.solution, 1));
    }
  } catch (error) {
    hint.status = "idle";
    render();
    toast(error.message);
  }
}
function practiceScreen() {
  return `<main class="practice-layout" id="turn-panel" tabindex="-1"><section class="practice-intro"><span class="eyebrow">THE ORACLE’S STUDY</span><h1>Every number<br>has a story.</h1><p>Explore the possibilities in three little dice. Choose a roll, then discover expressions for a number or a range.</p><div class="practice-art"><img src="./assets/crest.jpg" alt="A golden shield with a winding path"></div><button data-do="return-game">← Return to your quest</button><p class="fine-print">Practice has its own dice. Your match stays exactly where you left it.</p></section><section class="practice-panel ornate"><h2>Explore a roll</h2><form id="practice-form"><div class="practice-dice">${practiceDice.map((d, i) => `<label>Die ${i + 1}<select name="die${i}" aria-label="Practice die ${i + 1}">${[1, 2, 3, 4, 5, 6].map((v) => `<option ${d === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>`).join("")}</div><div class="range-fields"><label>First target<input type="number" name="min" value="${practiceMin}" min="1" max="999" required></label><span>to</span><label>Last target<input type="number" name="max" value="${practiceMax}" min="1" max="999" required></label></div><p class="fine-print">Use the same number for one target. Up to 200 targets, from 1–999.</p><button class="primary" ${practiceBusy ? "disabled" : ""}>${practiceBusy ? "Consulting the Oracle…" : "Find expressions ✦"}</button></form>${practiceResults !== null ? `<div class="practice-results"><div class="results-heading"><h3>${practiceResults.length} verified ${practiceResults.length === 1 ? "expression" : "expressions"}</h3><span>Dice ${practiceDice.join(" · ")}</span></div><p class="fine-print">Every answer uses all three dice exactly once. Powers are free. Search presets include powers 0–6, square/cube roots, 3/2, and −1. More expressions may exist.</p>${practiceResults.length ? practiceResults.map((s) => `<details class="solution"><summary><strong>${s.target}</strong><span>${esc(s.expression)}</span><i aria-hidden="true">⌄</i></summary><p>${esc(s.expression)} = ${s.target}. All three dice are used once; the result is verified exactly.${s.tokens.some((t) => t.kind === "die" && t.power !== "1") ? " An exponent changes its die’s value without using another die." : ""}</p><button data-do="copy-solution" data-target="${s.target}">Copy expression</button></details>`).join("") : "<p>No solution found in this search. Try another roll or build your own expression in the game.</p>"}</div>` : '<div class="oracle-empty"><span aria-hidden="true">✦</span><p>A square, a root, a different way to group.<br>There’s more than one way forward.</p></div>'}</section></main>`;
}
function setRoute(value) {
  if (document.body.dataset.page === "practice" && !value) {
    history.replaceState(null, "", new URL("./index.html", location.href));
    document.body.dataset.page = "";
  } else
    history.replaceState(null, "", value ? "#practice" : location.pathname);
}
function openPractice() {
  if (state.phase === "handoff") {
    clearTimeout(timer);
    state = finishTurn(state);
    resetEditor();
  }
  save();
  practice = true;
  setRoute(true);
  closeDialog();
  render();
  window.scrollTo(0, 0);
}
function returnGame() {
  practice = false;
  setRoute(false);
  render();
  window.scrollTo(0, 0);
}
const LESSONS = [
  {
    title: "One roll. Three pieces.",
    text: "Choose the outlined 6 near the gates. Use each die once to make 6, then move. Try 4 × 2 − 2.",
    action: "move",
    dice: [4, 2, 2],
    target: 1,
    tokens: [
      dieToken(0, 4),
      opToken("*"),
      dieToken(1, 2),
      opToken("-"),
      dieToken(2, 2),
    ],
  },
  {
    title: "Give a little number more power.",
    text: "Follow the trail to 18 using 2² + 3² + 5. Add each die, select it, and open Powers & roots. A power uses no extra die.",
    action: "move",
    dice: [2, 3, 5],
    target: 3,
    pos: 1,
    tokens: [
      dieToken(0, 2, "2"),
      opToken("+"),
      dieToken(1, 3, "2"),
      opToken("+"),
      dieToken(2, 5),
    ],
  },
  {
    title: "Put a little strategy in their path.",
    text: "Blue has entered. Choose Build wall, select the outlined 6 beside Blue, and make its number. Each knight can have three walls.",
    action: "build",
    dice: [4, 2, 2],
    target: 1,
    opponent: 3,
    tokens: [
      dieToken(0, 4),
      opToken("*"),
      dieToken(1, 2),
      opToken("-"),
      dieToken(2, 2),
    ],
  },
  {
    title: "Twice the number. Down goes the wall.",
    text: "Blue’s wall is on 6. Choose Break wall and make 12. You can break an opposing wall from anywhere: 3 × 2 × 2.",
    action: "break",
    dice: [3, 2, 2],
    target: 1,
    wall: 1,
    tokens: [
      dieToken(0, 3),
      opToken("*"),
      dieToken(1, 2),
      opToken("*"),
      dieToken(2, 2),
    ],
  },
  {
    title: "The last step belongs to you.",
    text: "Your stone connects to the lair. Choose Slay dragon and make 18. Use 2² + 3² + 5 to finish this practice quest.",
    action: "slay",
    dice: [2, 3, 5],
    target: 30,
    pos: 35,
    tokens: [
      dieToken(0, 2, "2"),
      opToken("+"),
      dieToken(1, 3, "2"),
      opToken("+"),
      dieToken(2, 5),
    ],
  },
];
function startTutorial() {
  if (tutorial) {
    closeDialog();
    return;
  }
  clearTimeout(timer);
  if (state.phase === "handoff") state = finishTurn(state);
  tutorialBackup = structuredClone(state);
  tutorial = { step: 0, done: false };
  practice = false;
  setRoute(false);
  loadLesson();
  closeDialog();
}
function loadLesson() {
  mapExpanded = false;
  const l = LESSONS[tutorial.step];
  state = newGame({
    seed: 20260908,
    dragon: 18,
    names: ["Gold Knight", "Blue Knight"],
  });
  function put(pos, num) {
    const other = state.board.indexOf(num);
    [state.board[pos - 1], state.board[other]] = [
      state.board[other],
      state.board[pos - 1],
    ];
  }
  put(1, 6);
  put(3, 18);
  state.dice = [...l.dice];
  state.players[0].pos = l.pos || 0;
  state.players[1].pos = l.opponent || 0;
  if (l.wall) state.walls[l.wall] = 1;
  state.draft.action = l.action;
  state.draft.target = l.target;
  tutorial.done = false;
  resetEditor();
  render();
  window.scrollTo(0, 0);
  announce(`Lesson ${tutorial.step + 1}. ${l.title}. ${l.text}`);
}
function exitTutorial() {
  clearTimeout(timer);
  state = tutorialBackup || newGame();
  tutorial = null;
  tutorialBackup = null;
  resetEditor();
  render();
}
function recovery() {
  openDialog(
    "Let’s protect your saved quest",
    `<p>${esc(loaded.reason || "Your previous save could not be restored safely. It has been left untouched.")}</p><p>You can play a fresh temporary quest, download the old save, or explicitly replace it.</p><div class="dialog-actions"><button class="primary" data-do="temporary">Play without changing the old save</button><button data-do="download-save">Download the old save</button><button data-do="replace-save">Replace with a new quest</button></div>`,
    { closable: false },
  );
}
async function handleAction(el) {
  const action = el.dataset.do;
  switch (action) {
    case "zoom-map":
      zoomMap();
      break;
    case "home":
    case "menu":
      menu();
      break;
    case "rules":
      rules();
      break;
    case "close":
    case "resume":
      closeDialog();
      if (state.phase === "over" && !practice) render();
      break;
    case "setup":
      setup();
      break;
    case "new":
      if (tutorial) exitTutorial();
      confirmNew();
      break;
    case "settings":
      preferences();
      break;
    case "sound":
      settings.sound = !settings.sound;
      writeSettings(storage, settings);
      render();
      toast(settings.sound ? "Sound on" : "Sound off");
      if (settings.sound) sound("tap");
      break;
    case "action":
      changeAction(el.dataset.action);
      break;
    case "target":
      chooseTarget(Number(el.dataset.pos));
      break;
    case "dragon":
      if (targets(state, "slay").length) {
        changeAction("slay");
        chooseTarget(30);
      } else toast(actionReason(state, "slay"));
      break;
    case "die": {
      const id = Number(el.dataset.id);
      edit((d) => insertPiece(d, dieToken(id, state.dice[id]), selected));
      break;
    }
    case "op":
      edit((d) => insertPiece(d, opToken(el.dataset.op), selected));
      break;
    case "select-piece":
      if (state.phase === "input") {
        selected = Number(el.dataset.index);
        render();
      }
      break;
    case "cursor":
      selected = null;
      state.draft.cursor = Number(el.dataset.index);
      render();
      break;
    case "after-piece":
      state.draft.cursor = selected + 1;
      selected = null;
      save();
      render();
      break;
    case "undo":
      if (undo.length) {
        state.draft = undo.pop();
        selected = null;
        save();
        render();
      }
      break;
    case "delete":
      edit((d) => deletePiece(d, selected));
      break;
    case "clear":
      edit((d) => ({ ...d, tokens: [], cursor: 0 }));
      break;
    case "powers":
      powersOpen = !powersOpen;
      render();
      break;
    case "power":
      applyPower(el.dataset.power);
      break;
    case "commit":
      perform();
      break;
    case "pass":
      if (state.phase === "input")
        openDialog(
          "Pass this turn?",
          `<p>Hand the dice to ${esc(state.players[1 - state.current].name)}. Your knight stays where it is.</p><div class="dialog-actions"><button class="primary" data-do="confirm-pass">Pass the dice →</button><button data-do="close">Keep thinking</button></div>`,
        );
      break;
    case "confirm-pass":
      closeDialog();
      perform(true);
      break;
    case "hint":
      await requestHint();
      break;
    case "apply-hint":
      if (hint.solution)
        edit((d) => ({
          ...d,
          tokens: structuredClone(hint.solution.tokens),
          cursor: hint.solution.tokens.length,
        }));
      break;
    case "share":
      await share();
      break;
    case "rematch":
      rematch(el.dataset.same === "true");
      break;
    case "practice":
      openPractice();
      break;
    case "return-game":
      returnGame();
      break;
    case "copy-solution": {
      const s = practiceResults.find(
        (s) => s.target === Number(el.dataset.target),
      );
      try {
        await navigator.clipboard.writeText(`${s.expression} = ${s.target}`);
        toast("Expression copied.");
      } catch {
        toast("Copy is unavailable. Select the expression to copy it.");
      }
      break;
    }
    case "tutorial":
      startTutorial();
      break;
    case "lesson-example":
      edit((d) => ({
        ...d,
        tokens: structuredClone(LESSONS[tutorial.step].tokens),
        cursor: LESSONS[tutorial.step].tokens.length,
      }));
      break;
    case "next-lesson":
      if (tutorial.step < LESSONS.length - 1) {
        tutorial.step++;
        loadLesson();
      } else {
        exitTutorial();
        openDialog(
          "You’re ready for the road.",
          `<p>You’ve moved, used powers, built and broken walls, and defeated the dragon. Your real quest is ready when you are.</p><button class="primary" data-do="close">Return to your quest →</button>`,
        );
      }
      break;
    case "exit-tutorial":
      exitTutorial();
      break;
    case "temporary":
      closeDialog();
      render();
      break;
    case "replace-save":
      saveBlocked = false;
      newMatch();
      break;
    case "download-save": {
      const blob = new Blob(
          [loaded.raw || loaded.error || "Save unavailable"],
          { type: "application/json" },
        ),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "knights-path-save-recovery.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      break;
    }
  }
}
function applyPower(power) {
  const i =
    selected !== null && state.draft.tokens[selected]?.kind === "die"
      ? selected
      : state.draft.tokens.findLastIndex((t) => t.kind === "die");
  edit((d) => changePower(d, i, power));
}
document.addEventListener("click", (event) => {
  const el = event.target.closest("[data-do]");
  if (!el || el.disabled) return;
  event.preventDefault();
  handleAction(el);
});
document.addEventListener("change", (event) => {
  if (event.target.id === "target-select") {
    if (event.target.value) chooseTarget(Number(event.target.value));
    else {
      state.draft.target = null;
      save();
      render();
    }
  }
});
document.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target,
    data = new FormData(form);
  if (form.id === "setup-form") {
    newMatch({
      names: [
        String(data.get("player0")).trim() || "Gold Knight",
        String(data.get("player1")).trim() || "Blue Knight",
      ],
      hints: data.has("hints"),
    });
  }
  if (form.id === "settings-form") {
    settings = {
      sound: data.has("sound"),
      contrast: data.has("contrast"),
      motion: data.get("motion"),
    };
    const ok = writeSettings(storage, settings);
    closeDialog();
    render();
    if (!ok)
      toast("Preferences apply for this session; storage is unavailable.");
  }
  if (form.id === "power-form") applyPower(data.get("power"));
  if (form.id === "practice-form") {
    const dice = [0, 1, 2].map((i) => Number(data.get("die" + i))),
      min = Number(data.get("min")),
      max = Number(data.get("max"));
    if (max < min || max - min > 199) {
      toast("Choose an increasing range with up to 200 targets.");
      return;
    }
    if (dice.filter((n) => n === 1).length >= 2) {
      toast(
        "Official rolls reroll two or more ones. Choose another practice roll.",
      );
      return;
    }
    practiceDice = dice;
    practiceMin = min;
    practiceMax = max;
    practiceBusy = true;
    practiceResults = null;
    render();
    try {
      const results = await getSolutions(dice, min, max);
      practiceResults = results;
      practiceBusy = false;
      if (practice) {
        render();
        announce(`${results.length} verified expressions found.`);
      }
    } catch (error) {
      practiceBusy = false;
      render();
      toast(error.message);
    }
  }
});
document.addEventListener("keydown", (event) => {
  if (
    $("#dialog").open ||
    practice ||
    event.target.classList?.contains("map-scroll") ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName) ||
    state.phase !== "input"
  )
    return;
  const key = event.key;
  if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === "z") {
    event.preventDefault();
    handleAction({ dataset: { do: "undo" } });
    return;
  }
  if (event.ctrlKey || event.metaKey) return;
  if (key === "Enter") {
    if (event.target.tagName === "BUTTON") return;
    event.preventDefault();
    perform();
    return;
  }
  if (key === "ArrowLeft" || key === "ArrowRight") {
    event.preventDefault();
    state.draft.cursor = Math.max(
      0,
      Math.min(
        state.draft.tokens.length,
        (selected ?? state.draft.cursor) + (key === "ArrowLeft" ? -1 : 1),
      ),
    );
    selected = null;
    save();
    render();
    return;
  }
  if (key === "Backspace" || key === "Delete") {
    event.preventDefault();
    edit((d) => deletePiece(d, selected));
    return;
  }
  if (/^[1-6]$/.test(key)) {
    event.preventDefault();
    const choices = availableDice(state.draft, state.dice, selected);
    const die = event.altKey
      ? choices[Number(key) - 1]
      : choices.find((d) => d.value === Number(key) && !d.used);
    if (die && !die.used) handleAction({ dataset: { do: "die", id: die.id } });
    else toast("That die is already used or is not in this roll.");
    return;
  }
  if (["+", "-", "*", "/", "(", ")"].includes(key)) {
    event.preventDefault();
    handleAction({ dataset: { do: "op", op: key } });
  }
});
$("#dialog").addEventListener("cancel", (event) => {
  if (saveBlocked && $("#dialog").querySelector('[data-do="temporary"]'))
    event.preventDefault();
});
window.addEventListener("pagehide", save);
window.addEventListener("hashchange", () => {
  practice = location.hash === "#practice";
  render();
});
motionQuery.addEventListener("change", () => {
  applySettings();
});
render();
if (!practice) {
  if (loaded.recovery) recovery();
  else welcome();
}
if (loaded.migrated) {
  save();
  toast("Your previous quest has been restored.");
}
