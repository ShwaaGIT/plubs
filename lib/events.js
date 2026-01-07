export function createEventBus() {
  const listeners = new Map();

  function on(event, handler) {
    const arr = listeners.get(event) || [];
    arr.push(handler);
    listeners.set(event, arr);
    return () => off(event, handler);
  }

  function off(event, handler) {
    const arr = listeners.get(event) || [];
    const idx = arr.indexOf(handler);
    if (idx >= 0) arr.splice(idx, 1);
    listeners.set(event, arr);
  }

  function emit(event, payload) {
    const arr = listeners.get(event) || [];
    arr.forEach((h) => {
      try {
        h(payload);
      } catch (e) {
        // swallow to avoid breaking others
        console.error("event handler error", e);
      }
    });
  }

  return { on, off, emit };
}

