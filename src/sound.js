let context;
const tones = {
  roll: [
    [190, 0.04],
    [240, 0.04],
    [320, 0.07],
  ],
  move: [
    [340, 0.06],
    [510, 0.12],
  ],
  build: [
    [140, 0.1],
    [210, 0.13],
  ],
  break: [
    [180, 0.07],
    [90, 0.16],
  ],
  slay: [
    [392, 0.1],
    [494, 0.1],
    [587, 0.12],
    [784, 0.35],
  ],
  pass: [[220, 0.1]],
  tap: [[480, 0.035]],
};
export function playSound(action, enabled) {
  if (!enabled) return;
  try {
    context ??= new (window.AudioContext || window.webkitAudioContext)();
    context.resume();
    let start = context.currentTime;
    for (const [f, duration] of tones[action] || tones.move) {
      const o = context.createOscillator(),
        g = context.createGain();
      o.type = action === "break" ? "triangle" : "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.055, start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      o.connect(g).connect(context.destination);
      o.start(start);
      o.stop(start + duration + 0.02);
      start += duration + 0.018;
    }
  } catch {
    /* A silent session remains fully playable. */
  }
}
