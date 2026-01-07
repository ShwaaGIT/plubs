import { createEventBus } from "../../lib/events.js";

export function createStore(initialState = {}) {
  const bus = createEventBus();
  let state = { ...initialState };

  function get() {
    return state;
  }

  function set(key, value) {
    const prev = state[key];
    state = { ...state, [key]: value };
    bus.emit("change", { key, prev, next: value, state });
  }

  function update(mutator) {
    const draft = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    mutator(draft);
    const changedKeys = Object.keys(draft).filter((k) => draft[k] !== state[k]);
    state = draft;
    changedKeys.forEach((key) => {
      bus.emit("change", { key, prev: undefined, next: state[key], state });
    });
  }

  function subscribe(fn) {
    const off = bus.on("change", (change) => fn(state, change));
    return off;
  }

  return { get, set, update, subscribe };
}

