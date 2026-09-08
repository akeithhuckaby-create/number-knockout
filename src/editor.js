import { normalizePower } from "./math.js";
export function insertPiece(draft, piece, selected = null) {
  const d = structuredClone(draft),
    index = selected ?? d.cursor;
  if (selected !== null) d.tokens.splice(index, 1, piece);
  else d.tokens.splice(index, 0, piece);
  d.cursor = index + 1;
  return d;
}
export function deletePiece(draft, selected = null) {
  const d = structuredClone(draft),
    index = selected ?? d.cursor - 1;
  if (index >= 0) {
    d.tokens.splice(index, 1);
    d.cursor = index;
  }
  return d;
}
export function changePower(draft, index, power) {
  if (draft.tokens[index]?.kind !== "die")
    throw Error("Select a die in your expression first.");
  const d = structuredClone(draft);
  d.tokens[index].power = normalizePower(power);
  return d;
}
export function availableDice(draft, dice, selected = null) {
  return dice.map((value, id) => ({
    id,
    value,
    used: draft.tokens.some(
      (t, i) => i !== selected && t.kind === "die" && t.id === id,
    ),
  }));
}
