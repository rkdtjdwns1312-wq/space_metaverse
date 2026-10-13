const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const dayInKst = (time) => new Date(time + KST_OFFSET_MS).toISOString().slice(0, 10);
const nextKstMidnight = (time) => {
  const nextDay = new Date(time + KST_OFFSET_MS);
  nextDay.setUTCHours(24, 0, 0, 0);
  return nextDay.getTime() - KST_OFFSET_MS;
};

export function createReadingRefresh({
  dialog,
  refresh,
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  documentRef = document,
  windowRef = window
}) {
  let timer = null;
  let retryTimer = null;
  let lastDay = null;
  let running = false;
  let checking = false;
  let checkId = 0;

  const arm = () => {
    if (!running) return;
    if (timer !== null) clearTimer(timer);
    timer = setTimer(() => {
      timer = null;
      void checkDay();
      arm();
    }, Math.max(0, nextKstMidnight(now()) - now()));
  };

  async function checkDay() {
    if (!running || !dialog.open || documentRef.visibilityState !== 'visible' || checking) return;
    const day = dayInKst(now());
    if (day === lastDay) return;
    const current = ++checkId;
    checking = true;
    try {
      const refreshed = await refresh();
      if (running && current === checkId && refreshed !== false) lastDay = day;
    } finally {
      if (current === checkId) {
        checking = false;
        if (running && dialog.open && dayInKst(now()) !== lastDay && retryTimer === null) {
          retryTimer = setTimer(() => {
            retryTimer = null;
            void checkDay();
          }, 1000);
        }
      }
    }
  }

  const onFocus = () => { void checkDay(); };
  const onVisibility = () => {
    if (documentRef.visibilityState === 'visible') void checkDay();
  };

  return {
    start() {
      this.stop();
      running = true;
      lastDay = dayInKst(now());
      documentRef.addEventListener('visibilitychange', onVisibility);
      windowRef.addEventListener('focus', onFocus);
      arm();
    },
    stop() {
      running = false;
      checkId++;
      checking = false;
      if (timer !== null) clearTimer(timer);
      if (retryTimer !== null) clearTimer(retryTimer);
      timer = null;
      retryTimer = null;
      documentRef.removeEventListener('visibilitychange', onVisibility);
      windowRef.removeEventListener('focus', onFocus);
    },
    check: checkDay
  };
}
