/** @typedef {{ type: string, [k: string]: any }} BusEvent */

/** In-process event bus; subscribers get `{ type, ...payload }`. A throwing subscriber never breaks the emitter. */
export function createBus() {
  /** @type {Set<(e: BusEvent) => void>} */
  const subs = new Set();
  return {
    /** @param {string} type @param {object} payload */
    emit(type, payload) {
      for (const fn of [...subs]) {
        try { fn({ type, ...payload }); } catch { /* subscriber bug must not stop the queue */ }
      }
    },
    /** @param {(e: BusEvent) => void} fn @returns {() => void} */
    subscribe(fn) {
      subs.add(fn);
      return () => { subs.delete(fn); };
    },
  };
}
