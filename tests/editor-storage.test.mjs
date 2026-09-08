import test from "node:test";
import assert from "node:assert/strict";
import {
  insertPiece,
  deletePiece,
  changePower,
  availableDice,
} from "../src/editor.js";
import { newGame } from "../src/game.js";
import { dieToken, opToken } from "../src/math.js";
import { readGame, writeGame, SAVE_KEY } from "../src/storage.js";
test("editor replaces a selected token and keeps equal dice independent", () => {
  let d = newGame().draft;
  d = insertPiece(d, dieToken(0, 2));
  d = insertPiece(d, opToken("+"));
  d = insertPiece(d, dieToken(1, 2));
  assert.equal(availableDice(d, [2, 2, 4]).filter((d) => !d.used).length, 1);
  d = insertPiece(d, opToken("*"), 1);
  assert.equal(d.tokens.length, 3);
  assert.equal(d.tokens[1].value, "*");
  d = changePower(d, 2, "2/4");
  assert.equal(d.tokens[2].power, "1/2");
  d = deletePiece(d, 0);
  assert.equal(d.tokens.length, 2);
  assert.equal(availableDice(d, [2, 2, 4])[0].used, false);
});
test("failed storage writes do not affect the game and corrupt saves remain intact", () => {
  const map = new Map(),
    storage = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) };
  const s = newGame();
  assert.ok(writeGame(storage, s));
  assert.deepEqual(readGame(storage).state, s);
  map.set(SAVE_KEY, "{bad");
  assert.ok(readGame(storage).recovery);
  assert.equal(map.get(SAVE_KEY), "{bad");
  assert.equal(
    writeGame(
      {
        setItem() {
          throw Error("full");
        },
      },
      s,
    ),
    false,
  );
});
