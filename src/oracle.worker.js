import { solve } from "./solver.js";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({
      id: data.id,
      solutions: solve(data.dice, { min: data.min ?? 1, max: data.max ?? 72 }),
    });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};
