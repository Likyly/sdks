import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { ANONYMOUS_ID_LIFETIME_DAYS, LikylySession } from "../src/index.js";

function installFakeLocalStorage(): Storage {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  } as unknown as Storage;
  (globalThis as unknown as { localStorage?: Storage }).localStorage = storage;
  return storage;
}

function removeFakeLocalStorage() {
  delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
}

describe("LikylySession - first-party, cookieless anonymous id", () => {
  afterEach(removeFakeLocalStorage);

  it("returns undefined with no localStorage (SSR / Node)", () => {
    const session = new LikylySession();
    assert.equal(session.getAnonymousId(), undefined);
  });

  it("generates and persists an id on first call, reuses the cached one after", () => {
    installFakeLocalStorage();
    const session = new LikylySession();
    const id = session.getAnonymousId();
    assert.ok(id?.startsWith("anon_"), `expected an "anon_" id, got ${id}`);
    assert.equal(session.getAnonymousId(), id);
  });

  it("a second instance reads the same id back from storage", () => {
    const storage = installFakeLocalStorage();
    const id = new LikylySession().getAnonymousId();
    assert.equal(new LikylySession().getAnonymousId(), id);
    assert.equal(storage.getItem("likyly_anonymous_id"), id);
  });

  it("respects a custom storageKey, so two LIKYLY-powered apps on one domain don't collide", () => {
    const storage = installFakeLocalStorage();
    new LikylySession({ storageKey: "my_app_anon_id" }).getAnonymousId();
    assert.ok(storage.getItem("my_app_anon_id"));
    assert.equal(storage.getItem("likyly_anonymous_id"), null);
  });

  it("degrades to undefined, never throws, when storage.setItem throws (private-mode quota)", () => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    } as unknown as Storage;
    assert.doesNotThrow(() => new LikylySession().getAnonymousId());
    assert.equal(new LikylySession().getAnonymousId(), undefined);
  });
});

describe("LikylySession.identify", () => {
  afterEach(removeFakeLocalStorage);

  it("calls events.identify with the anonymous id and the given userId", async () => {
    installFakeLocalStorage();
    const session = new LikylySession();
    const calls: unknown[] = [];
    const fakeLikyly = { events: { identify: async (input: unknown) => (calls.push(input), { linkedInteractions: 2 }) } };

    const result = await session.identify(fakeLikyly as never, "user_1");

    assert.deepEqual(calls[0], { userId: "user_1", sessionId: session.getAnonymousId() });
    assert.deepEqual(result, { linkedInteractions: 2 });
  });

  it("is a no-op (never calls events.identify) without a persistable anonymous id", async () => {
    const calls: unknown[] = [];
    const fakeLikyly = { events: { identify: async (input: unknown) => (calls.push(input), { linkedInteractions: 0 }) } };

    const result = await new LikylySession().identify(fakeLikyly as never, "user_1");

    assert.equal(result, undefined);
    assert.equal(calls.length, 0);
  });
});

describe("LikylySession - an id lives 13 months, never extended", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const start = Date.UTC(2026, 0, 1);
  afterEach(() => {
    mock.timers.reset();
    removeFakeLocalStorage();
  });

  it("is 395 days", () => {
    assert.equal(ANONYMOUS_ID_LIFETIME_DAYS, 395);
  });

  it("keeps the id for 13 months whatever the visits, then creates a new one", () => {
    const storage = installFakeLocalStorage();
    mock.timers.enable({ apis: ["Date"], now: start });
    const id = new LikylySession().getAnonymousId();
    assert.equal(storage.getItem("likyly_anonymous_id:created"), String(start));
    assert.equal(new LikylySession().expiresAt()?.getTime(), start + 395 * DAY);

    mock.timers.setTime(start + 394 * DAY); // a visit the day before: same id, same end
    assert.equal(new LikylySession().getAnonymousId(), id);
    assert.equal(storage.getItem("likyly_anonymous_id:created"), String(start));

    mock.timers.setTime(start + 395 * DAY);
    const renewed = new LikylySession().getAnonymousId();
    assert.ok(renewed && renewed !== id);
    assert.equal(storage.getItem("likyly_anonymous_id:created"), String(start + 395 * DAY));
  });

  it("an open page also moves to a new id once the old one expires", () => {
    installFakeLocalStorage();
    mock.timers.enable({ apis: ["Date"], now: start });
    const session = new LikylySession();
    const id = session.getAnonymousId();
    mock.timers.setTime(start + 400 * DAY);
    assert.notEqual(session.getAnonymousId(), id);
  });

  it("an id stored before ids had an age starts its 13 months now", () => {
    const storage = installFakeLocalStorage();
    storage.setItem("likyly_anonymous_id", "anon_legacy");
    mock.timers.enable({ apis: ["Date"], now: start });
    assert.equal(new LikylySession().getAnonymousId(), "anon_legacy");
    assert.equal(storage.getItem("likyly_anonymous_id:created"), String(start));
  });

  it("expiresAt is undefined without storage", () => {
    assert.equal(new LikylySession().expiresAt(), undefined);
  });
});
