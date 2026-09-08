import { validateSave, migrateLegacy, migrateGridSave } from "./game.js";
export const SAVE_KEY = "knights-path:v3",
  SETTINGS_KEY = "knights-path:settings";
export function readGame(storage) {
  let raw;
  try {
    raw = storage.getItem(SAVE_KEY);
    if (raw) {
      const state = validateSave(JSON.parse(raw));
      return state ? { state } : { recovery: true, raw };
    }
    const grid = storage.getItem("knights-path:v2");
    if (grid) {
      raw = grid;
      const state = migrateGridSave(JSON.parse(grid));
      return state
        ? { state, migrated: true }
        : {
            recovery: true,
            raw: grid,
            reason:
              "The new trail uses connected stones. Your previous grid quest has been kept untouched because its positions follow different rules.",
          };
    }
    const old = storage.getItem("knightGameState");
    raw = old;
    if (old) {
      const state = migrateLegacy(JSON.parse(old));
      return state
        ? { state, migrated: true }
        : {
            recovery: true,
            raw: old,
            reason:
              "The new trail uses different movement rules. Your previous grid quest has been kept untouched.",
          };
    }
    return {};
  } catch (error) {
    return {
      recovery: true,
      raw,
      error: "Your saved quest could not be read. It has been left untouched.",
    };
  }
}
export function writeGame(storage, state) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
export function readSettings(storage) {
  try {
    const s = JSON.parse(storage.getItem(SETTINGS_KEY) || "{}");
    return {
      sound: s.sound !== false,
      motion: ["system", "reduce", "full"].includes(s.motion)
        ? s.motion
        : "system",
      contrast: s.contrast === true,
    };
  } catch {
    return { sound: true, motion: "system", contrast: false };
  }
}
export function writeSettings(storage, settings) {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
