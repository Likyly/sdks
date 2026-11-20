import type { Likyly } from "./client.js";
import type { IdentifyResult } from "./types.js";

const DEFAULT_STORAGE_KEY = "likyly_anonymous_id";
const DAY_MS = 24 * 60 * 60 * 1000;

/** How long an anonymous id lives: 13 months (395 days) from its creation, never extended by
 * later visits - the CNIL's limit for a tracker, and LIKYLY's retention period for the events
 * recorded under it (they are deleted after 13 months too). A new id is created after that. */
export const ANONYMOUS_ID_LIFETIME_DAYS = 395;

export interface LikylySessionOptions {
  /** Override the localStorage key - e.g. to namespace multiple LIKYLY-powered apps on one domain. Defaults to "likyly_anonymous_id". */
  storageKey?: string;
}

/**
 * A first-party, cookieless anonymous visitor id - generated once per browser and persisted in
 * `localStorage` (never a third-party cookie, never sent to anyone but LIKYLY), for 13 months
 * at most ({@link ANONYMOUS_ID_LIFETIME_DAYS}): its creation date is kept next to it (key
 * `<storageKey>:created`) and a new id replaces it once that is reached. Use it as
 * `context.anonymousId` / `sessionId` for recommendations and event tracking until the visitor
 * is identified, then call {@link identify} to attach their history to the now-known user.
 *
 * SSR-safe: every method degrades to a no-op (`undefined`) outside a real browser (no
 * `window`/`localStorage`, private-mode storage that throws, ...) rather than throwing - a
 * server-rendered pass simply has no anonymous id yet, which is correct, not an error.
 */
export class LikylySession {
  private readonly storageKey: string;
  private cachedId: string | undefined;
  private cachedCreatedAt = 0;

  constructor(options: LikylySessionOptions = {}) {
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
  }

  /** The visitor's anonymous id, creating and persisting one on first call, and a new one once
   * the current id is 13 months old. `undefined` when there is nowhere to persist it (SSR,
   * Node, storage disabled). */
  getAnonymousId(): string | undefined {
    const now = Date.now();
    if (this.cachedId && !isExpired(this.cachedCreatedAt, now)) return this.cachedId;
    const storage = safeLocalStorage();
    if (!storage) return undefined;
    const createdKey = `${this.storageKey}:created`;
    try {
      let id = storage.getItem(this.storageKey);
      let createdAt = Number(storage.getItem(createdKey)) || 0;
      if (id && !createdAt) {
        // An id stored before ids had an age: its clock starts now.
        createdAt = now;
        storage.setItem(createdKey, String(createdAt));
      }
      if (!id || isExpired(createdAt, now)) {
        id = generateAnonymousId();
        createdAt = now;
        storage.setItem(this.storageKey, id);
        storage.setItem(createdKey, String(createdAt));
      }
      this.cachedId = id;
      this.cachedCreatedAt = createdAt;
      return id;
    } catch {
      return undefined; // full/blocked storage - degrade to "no session", never throw
    }
  }

  /** When the current anonymous id will be replaced (13 months after its creation) - e.g. to
   * give a cookie that copies it the same end. `undefined` when there is no id. */
  expiresAt(): Date | undefined {
    if (!this.getAnonymousId()) return undefined;
    return new Date(this.cachedCreatedAt + ANONYMOUS_ID_LIFETIME_DAYS * DAY_MS);
  }

  /**
   * Call once you know the visitor's `userId` (e.g. right after login): attaches this
   * session's *past* interactions to them server-side (`likyly.events.identify`), so they
   * count as that user's history from then on. Safe to call more than once, and safe even if
   * there is no anonymous id yet (a no-op). Both `userId` and the anonymous id remain fine to
   * keep sending together afterwards - this doesn't need to be the last time you use either.
   */
  async identify(likyly: Pick<Likyly, "events">, userId: string): Promise<IdentifyResult | undefined> {
    const sessionId = this.getAnonymousId();
    if (!sessionId) return undefined;
    return likyly.events.identify({ userId, sessionId });
  }
}

function isExpired(createdAt: number, now: number): boolean {
  return now - createdAt >= ANONYMOUS_ID_LIFETIME_DAYS * DAY_MS;
}

function safeLocalStorage(): Storage | undefined {
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    if (!storage) return undefined;
    const probeKey = "__likyly_probe__";
    storage.setItem(probeKey, "1"); // some private-mode browsers only throw on write, not on presence
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return undefined;
  }
}

function generateAnonymousId(): string {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (typeof cryptoObj?.randomUUID === "function") return `anon_${cryptoObj.randomUUID()}`;
  return `anon_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}
