function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}

// Exactly one plan/commit per active turn. Menus, practice, hidden tabs and
// replacement quests cancel the job; late worker answers cannot mutate play.
export function createComputerTurnRunner({
  getKey,
  plan,
  show,
  commit,
  report,
  delay = wait,
}) {
  let job = null;
  const cancel = () => {
    const previous = job;
    job = null;
    previous?.controller.abort();
  };
  function sync() {
    const key = getKey();
    if (!key) {
      cancel();
      return;
    }
    if (job?.key === key) return;
    cancel();
    const controller = new AbortController(),
      current = { key, controller };
    job = current;
    const active = () =>
      job === current && !controller.signal.aborted && getKey() === key;
    report("thinking");
    void (async () => {
      try {
        const [choice] = await Promise.all([
          plan(controller.signal),
          delay(700, controller.signal),
        ]);
        if (!active()) return;
        show(choice);
        await delay(1600, controller.signal);
        if (!active()) return;
        commit(choice);
      } catch (error) {
        if (active())
          report(
            "error",
            error?.message || "The computer could not finish its turn.",
          );
      }
    })();
  }
  return {
    sync,
    cancel,
    retry() {
      cancel();
      sync();
    },
  };
}
