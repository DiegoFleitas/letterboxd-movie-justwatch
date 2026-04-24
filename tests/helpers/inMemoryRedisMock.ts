export function createInMemoryRedisMock() {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  return {
    ping: () => Promise.resolve("PONG"),
    get: (key: string) => Promise.resolve(store.get(key) ?? null),
    set: (key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve("OK");
    },
    del: (...keys: string[]) => {
      let n = 0;
      for (const k of keys) {
        if (store.delete(k)) n++;
        for (const s of sets.values()) s.delete(k);
      }
      return Promise.resolve(n);
    },
    sadd: (key: string, ...members: string[]) => {
      let s = sets.get(key);
      if (!s) {
        s = new Set();
        sets.set(key, s);
      }
      let added = 0;
      for (const m of members) {
        if (!s.has(m)) {
          s.add(m);
          added++;
        }
      }
      return Promise.resolve(added);
    },
    smembers: (key: string) => Promise.resolve([...(sets.get(key) ?? [])]),
    exists: (...keys: string[]) => {
      let n = 0;
      for (const k of keys) {
        if (store.has(k)) n++;
      }
      return Promise.resolve(n);
    },
    pipeline() {
      const ops: Array<{ op: "exists"; key: string }> = [];
      const chain = {
        exists(key: string) {
          ops.push({ op: "exists", key });
          return chain;
        },
        type() {
          return chain;
        },
        pttl() {
          return chain;
        },
        get() {
          return chain;
        },
        exec: async () => ops.map((o): [null, number] => [null, store.has(o.key) ? 1 : 0]),
      };
      return chain;
    },
    quit: () => Promise.resolve(undefined as void),
    on: () => {},
  };
}
