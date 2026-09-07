// IndexedDB Manager for Guard Console Offline Operation
// Per AGENTS.md Rule #7: Offline-allowed check-in/out against cached 24h allowlist

const DB_NAME = "SocietyOS_GuardOffline";
const DB_VERSION = 3;

export interface CachedInvite {
  id: string;
  code: string;
  qrToken?: string;
  visitorName: string;
  visitorPhone?: string;
  unitNumber?: string;
  purpose?: string;
  validFrom: string;
  validTo: string;
  status: string;
  cachedAt: number;
}

export interface CachedInsideEntry {
  id: string;
  inviteId?: string;
  name: string;
  phone?: string;
  type: string;
  unit: string;
  checkIn: string;
  vehicleNumber?: string;
  cachedAt: number;
}

export interface CachedDailyHelp {
  id: string;
  name: string;
  phone: string;
  serviceType: string;
  agency?: string;
  units?: string[];
  passcode?: string;
  cachedAt: number;
}

export type OfflineActionType =
  | "VISITOR_CHECKIN"
  | "VISITOR_CHECKOUT"
  | "DELIVERY_LOG"
  | "HELP_CHECKIN"
  | "HELP_CHECKOUT"
  | "MANUAL_PASS";

export interface OfflineEntry {
  idempotencyKey: string;
  code?: string;
  inviteId?: string;
  entryId?: string;
  gateId?: string;
  entryType: "VISITOR" | "DELIVERY" | "HELP" | "MANUAL_PASS" | OfflineActionType;
  actionType?: OfflineActionType;
  payload?: any;
  timestamp: string;
  synced: boolean;
  failed?: boolean;
  failReason?: string;
  notes?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return reject(new Error("IndexedDB not available"));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("cached_invites")) {
        const store = db.createObjectStore("cached_invites", { keyPath: "code" });
        store.createIndex("qrToken", "qrToken", { unique: false });
        store.createIndex("validTo", "validTo", { unique: false });
      }
      if (!db.objectStoreNames.contains("offline_entries_queue")) {
        const queueStore = db.createObjectStore("offline_entries_queue", { keyPath: "idempotencyKey" });
        queueStore.createIndex("synced", "synced", { unique: false });
      }
      if (!db.objectStoreNames.contains("cached_inside")) {
        const insideStore = db.createObjectStore("cached_inside", { keyPath: "id" });
        insideStore.createIndex("inviteId", "inviteId", { unique: false });
      }
      if (!db.objectStoreNames.contains("cached_daily_help")) {
        const helpStore = db.createObjectStore("cached_daily_help", { keyPath: "id" });
        helpStore.createIndex("phone", "phone", { unique: false });
        helpStore.createIndex("serviceType", "serviceType", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// -------------------------------------------------------------
// 24H INVITE ALLOWLIST
// -------------------------------------------------------------

export async function cacheApprovedInvites(invites: CachedInvite[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("cached_invites", "readwrite");
    const store = tx.objectStore("cached_invites");
    for (const invite of invites) {
      store.put({ ...invite, cachedAt: Date.now() });
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[OFFLINE DB] Failed to cache invites:", err);
  }
}

export async function findCachedInvite(query: string): Promise<CachedInvite | null> {
  try {
    const db = await openDB();
    const clean = query.trim().toUpperCase();
    const tx = db.transaction("cached_invites", "readonly");
    const store = tx.objectStore("cached_invites");

    return new Promise((resolve) => {
      const codeReq = store.get(clean);
      codeReq.onsuccess = () => {
        if (codeReq.result) {
          const inv = codeReq.result;
          if (new Date(inv.validTo).getTime() < Date.now()) {
            return resolve(null);
          }
          return resolve(inv);
        }

        const qrIndex = store.index("qrToken");
        const qrReq = qrIndex.get(clean);
        qrReq.onsuccess = () => {
          if (qrReq.result) {
            const inv = qrReq.result;
            if (new Date(inv.validTo).getTime() < Date.now()) {
              return resolve(null);
            }
            return resolve(inv);
          }
          resolve(null);
        };
        qrReq.onerror = () => resolve(null);
      };
      codeReq.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// CACHED CAMPUS INSIDE ENTRIES (For offline check-outs)
// -------------------------------------------------------------

export async function cacheActiveInside(entries: CachedInsideEntry[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("cached_inside", "readwrite");
    const store = tx.objectStore("cached_inside");
    // Clear out previous active snapshot to reflect latest inside state
    store.clear();
    for (const entry of entries) {
      store.put({ ...entry, cachedAt: Date.now() });
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[OFFLINE DB] Failed to cache inside entries:", err);
  }
}

export async function getCachedInside(): Promise<CachedInsideEntry[]> {
  try {
    const db = await openDB();
    const tx = db.transaction("cached_inside", "readonly");
    const store = tx.objectStore("cached_inside");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []) as CachedInsideEntry[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function removeCachedInside(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("cached_inside", "readwrite");
    const store = tx.objectStore("cached_inside");
    store.delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[OFFLINE DB] Failed to remove cached inside entry:", err);
  }
}

// -------------------------------------------------------------
// CACHED DAILY HELP STAFF
// -------------------------------------------------------------

export async function cacheDailyHelp(helpers: CachedDailyHelp[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("cached_daily_help", "readwrite");
    const store = tx.objectStore("cached_daily_help");
    store.clear();
    for (const h of helpers) {
      store.put({ ...h, cachedAt: Date.now() });
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[OFFLINE DB] Failed to cache daily help:", err);
  }
}

export async function getCachedDailyHelp(): Promise<CachedDailyHelp[]> {
  try {
    const db = await openDB();
    const tx = db.transaction("cached_daily_help", "readonly");
    const store = tx.objectStore("cached_daily_help");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []) as CachedDailyHelp[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function findCachedDailyHelp(query: string): Promise<CachedDailyHelp | null> {
  try {
    const db = await openDB();
    const clean = query.trim().toLowerCase();
    const tx = db.transaction("cached_daily_help", "readonly");
    const store = tx.objectStore("cached_daily_help");

    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as CachedDailyHelp[];
        const found = list.find(
          (h) =>
            h.id === clean ||
            h.phone === clean ||
            h.name.toLowerCase().includes(clean) ||
            (h.passcode && h.passcode === clean)
        );
        resolve(found || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// OFFLINE MUTATION QUEUE
// -------------------------------------------------------------

export async function queueOfflineEntry(entry: Omit<OfflineEntry, "synced">): Promise<OfflineEntry> {
  const db = await openDB();
  const tx = db.transaction("offline_entries_queue", "readwrite");
  const store = tx.objectStore("offline_entries_queue");
  const record: OfflineEntry = { ...entry, synced: false, failed: false };

  return new Promise((resolve, reject) => {
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingOfflineEntries(): Promise<OfflineEntry[]> {
  try {
    const db = await openDB();
    const tx = db.transaction("offline_entries_queue", "readonly");
    const store = tx.objectStore("offline_entries_queue");

    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const results = (req.result || []) as OfflineEntry[];
        resolve(results.filter((r) => !r.synced && !r.failed));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function getAllOfflineQueueEntries(): Promise<OfflineEntry[]> {
  try {
    const db = await openDB();
    const tx = db.transaction("offline_entries_queue", "readonly");
    const store = tx.objectStore("offline_entries_queue");

    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const results = (req.result || []) as OfflineEntry[];
        // Sort newest first
        results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function markEntrySynced(idempotencyKey: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("offline_entries_queue", "readwrite");
    const store = tx.objectStore("offline_entries_queue");
    const req = store.get(idempotencyKey);
    req.onsuccess = () => {
      if (req.result) {
        req.result.synced = true;
        req.result.failed = false;
        store.put(req.result);
      }
    };
  } catch (err) {
    console.warn("[OFFLINE DB] Failed to mark synced:", err);
  }
}

export async function markEntryFailed(idempotencyKey: string, reason: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("offline_entries_queue", "readwrite");
    const store = tx.objectStore("offline_entries_queue");
    const req = store.get(idempotencyKey);
    req.onsuccess = () => {
      if (req.result) {
        req.result.failed = true;
        req.result.failReason = reason;
        store.put(req.result);
      }
    };
  } catch (err) {
    console.warn("[OFFLINE DB] Failed to mark failed:", err);
  }
}

export async function retryFailedEntry(idempotencyKey: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("offline_entries_queue", "readwrite");
    const store = tx.objectStore("offline_entries_queue");
    const req = store.get(idempotencyKey);
    req.onsuccess = () => {
      if (req.result) {
        req.result.failed = false;
        req.result.failReason = undefined;
        req.result.synced = false;
        store.put(req.result);
      }
    };
  } catch (err) {
    console.warn("[OFFLINE DB] Failed to retry entry:", err);
  }
}

export async function dismissFailedEntry(idempotencyKey: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("offline_entries_queue", "readwrite");
    const store = tx.objectStore("offline_entries_queue");
    store.delete(idempotencyKey);
  } catch (err) {
    console.warn("[OFFLINE DB] Failed to dismiss entry:", err);
  }
}

export async function clearSyncedEntries(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("offline_entries_queue", "readwrite");
    const store = tx.objectStore("offline_entries_queue");
    const req = store.getAll();
    req.onsuccess = () => {
      const items = (req.result || []) as OfflineEntry[];
      for (const item of items) {
        if (item.synced) {
          store.delete(item.idempotencyKey);
        }
      }
    };
  } catch (err) {
    console.warn("[OFFLINE DB] Failed to clear synced entries:", err);
  }
}
