const listeners = new Map();

export const bus = {
  on(event, callback) {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }

    listeners.get(event).add(callback);

    return () => {
      listeners.get(event)?.delete(callback);
    };
  },

  once(event, callback) {
    const off = bus.on(event, (...args) => {
      off();
      callback(...args);
    });
    return off;
  },

  emit(event, detail = {}) {
    const set = listeners.get(event);

    if (set) {
      for (const callback of set) {
        try {
          callback(detail);
        } catch (error) {
          console.error(`VALCON bus error: ${event}`, error);
        }
      }
    }

    window.dispatchEvent(new CustomEvent(`valcon:${event}`, { detail }));
  },

  clear(event) {
    listeners.delete(event);
  },
};
