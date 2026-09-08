import { solve, assessDeparture } from "./solver.js";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({
      id: data.id,
      solutions: data.previous
        ? assessDeparture(data.dice, data.min, data.previous)
        : solve(data.dice, {
            min: data.min ?? 1,
            max: data.max ?? 72,
            exclude: data.exclude ?? [],
          }),
    });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};
