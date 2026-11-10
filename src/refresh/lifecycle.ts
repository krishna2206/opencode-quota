/**
 * Refresh lifecycle: decides when to re-collect and how to survive failures.
 *
 * Timeline:
 * - initial load + a few recovery attempts after mount
 * - periodic refresh, rearmed after every completed load
 * - refresh shortly after relevant opencode events
 *
 * Failure policy: the load promise never throws (providers return errors in
 * their result). If the collect yields no usable entries, the renderer keeps
 * the last known state (no flicker between a value and "unavailable").
 *
 * A load that never settles must not freeze the line: loads run one at a time,
 * so a single hung load would block every later refresh (timer and events).
 * Each load therefore has a hard deadline; past it the load is abandoned, its
 * late result is ignored, and `onFailure` is told so the line can show that
 * its value is going stale.
 *
 * Scheduling policy: a burst of events must not create a burst of timers. A
 * long agentic run emits one usage event per step, and each one would arm one
 * timer per configured delay. Timers are keyed by delay, so an arbitrarily long
 * burst arms at most one timer per delay.
 */

export interface RefreshLifecycle {
  reload: () => void;
  dispose: () => void;
  /** Live diagnostics, used by the tests and by ad-hoc measurement. */
  readonly stats: RefreshStats;
}

/** Counters describing how much work the lifecycle actually did. */
export interface RefreshStats {
  /** Times an event asked for a refresh. */
  readonly scheduled: number;
  /** Timers actually armed (the ones deduplication did not collapse). */
  readonly timersCreated: number;
  /** Times `load()` really ran. */
  readonly loads: number;
  /** Timers currently pending. */
  readonly pendingTimers: number;
}

export interface RefreshLifecycleOptions<T> {
  load: () => Promise<T>;
  apply: (value: T) => void;
  intervalMs: number;
  eventRefreshDelaysMs: readonly number[];
  recoveryDelaysMs?: readonly number[];
  subscribe: (scheduleRefresh: () => void) => Array<() => void>;
  /** Longest a load may take before it is abandoned. */
  loadTimeoutMs?: number;
  /** A load was abandoned (deadline) or rejected: nothing was applied. */
  onFailure?: () => void;
}

export const DEFAULT_LOAD_TIMEOUT_MS = 15_000;

const LOAD_TIMED_OUT = Symbol("load timed out");

/** Settles with the load's value, or with LOAD_TIMED_OUT once the deadline passes. */
function withDeadline<T>(load: () => Promise<T>, timeoutMs: number): Promise<T | typeof LOAD_TIMED_OUT> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(LOAD_TIMED_OUT), timeoutMs);
    let started: Promise<T>;
    try {
      started = load();
    } catch (error) {
      clearTimeout(timer);
      reject(error);
      return;
    }
    started.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function createRefreshLifecycle<T>(options: RefreshLifecycleOptions<T>): RefreshLifecycle {
  let disposed = false;
  let inFlight = false;
  let queued = false;
  let loadVersion = 0;

  let scheduled = 0;
  let timersCreated = 0;
  let loads = 0;

  // Keyed by delay: one pending timer per distinct delay, never more. A burst of
  // N events therefore costs at most `eventRefreshDelaysMs.length` timers.
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  let periodicTimer: ReturnType<typeof setTimeout> | undefined;

  const armPeriodic = (): void => {
    if (disposed) return;
    if (periodicTimer) clearTimeout(periodicTimer);
    periodicTimer = setTimeout(() => {
      periodicTimer = undefined;
      reload();
    }, options.intervalMs);
  };

  const reload = (): void => {
    if (disposed) return;

    if (inFlight) {
      queued = true;
      return;
    }

    inFlight = true;
    loads += 1;
    const currentVersion = ++loadVersion;

    void withDeadline(options.load, options.loadTimeoutMs ?? DEFAULT_LOAD_TIMEOUT_MS)
      .then((next) => {
        if (disposed || currentVersion !== loadVersion) return;
        if (next === LOAD_TIMED_OUT) {
          options.onFailure?.();
          return;
        }
        options.apply(next);
      })
      .catch(() => {
        // The collect already absorbs provider errors; reaching here means a
        // programming error or an unexpected rejection. Keep the last state.
        if (disposed || currentVersion !== loadVersion) return;
        options.onFailure?.();
      })
      .finally(() => {
        if (disposed) return;
        inFlight = false;
        // Push the periodic refresh out: a load just happened, so there is
        // nothing to gain from firing again a moment later.
        armPeriodic();
        if (queued) {
          queued = false;
          reload();
        }
      });
  };

  const queueRefresh = (delay: number): void => {
    if (disposed) return;
    if (timers.has(delay)) return;

    timersCreated += 1;
    const timer = setTimeout(() => {
      timers.delete(delay);
      reload();
    }, delay);
    timers.set(delay, timer);
  };

  const scheduleRefresh = (): void => {
    scheduled += 1;
    for (const delay of options.eventRefreshDelaysMs) queueRefresh(delay);
  };

  const unsubscribers = options.subscribe(scheduleRefresh);

  const dispose = (): void => {
    if (disposed) return;

    disposed = true;
    if (periodicTimer) clearTimeout(periodicTimer);
    periodicTimer = undefined;
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    for (const unsubscribe of unsubscribers) unsubscribe();
  };

  const stats: RefreshStats = {
    get scheduled() {
      return scheduled;
    },
    get timersCreated() {
      return timersCreated;
    },
    get loads() {
      return loads;
    },
    get pendingTimers() {
      return timers.size;
    },
  };

  armPeriodic();
  reload();
  for (const delay of options.recoveryDelaysMs ?? []) queueRefresh(delay);

  return { reload, dispose, stats };
}
