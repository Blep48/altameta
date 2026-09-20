/** Round-scoped timers: cancelling a round invalidates every pending callback. */
export function createTimerGroup() {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  return {
    later(fn: () => void, ms: number) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        fn();
      }, ms);
      timers.add(timer);
      return timer;
    },
    clear() {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    },
  };
}
