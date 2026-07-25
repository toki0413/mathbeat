// MathBeat IndexedDB persistence layer
// Replaces localStorage with IndexedDB for larger storage capacity
// Falls back to localStorage if IndexedDB is unavailable

const DB_NAME = 'mathbeat_db';
const DB_VERSION = 1;
const STORE_NAME = 'kv_store';

let dbInstance: IDBDatabase | null = null;
let useFallback = false;

// Check if IndexedDB is available
try {
  if (!window.indexedDB) useFallback = true;
} catch (e) {
  useFallback = true;
}

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (useFallback) {
      resolve(null);
      return;
    }
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => {
      useFallback = true;
      resolve(null);
    };
    req.onsuccess = () => {
      dbInstance = req.result;
      resolve(dbInstance);
    };
    req.onupgradeneeded = (e) => {
      const target = e.target as IDBOpenDBRequest;
      const db = target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function idbGet(key: string): Promise<any> {
  if (useFallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch (e) {
      return null;
    }
  }
  const db = await openDB();
  if (!db) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch (e) {
      return null;
    }
  }
  return new Promise((resolve) => {
    const tx = (db as IDBDatabase).transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

export async function idbSet(key: string, value: any): Promise<boolean> {
  if (useFallback) {
    try {
      const serialized = JSON.stringify(value);
      if (serialized === undefined) return false;
      localStorage.setItem(key, serialized);
      return true;
    } catch (e) {
      return false;
    }
  }
  const db = await openDB();
  if (!db) {
    try {
      const serialized = JSON.stringify(value);
      if (serialized === undefined) return false;
      localStorage.setItem(key, serialized);
      return true;
    } catch (e) {
      return false;
    }
  }
  return new Promise((resolve) => {
    const tx = (db as IDBDatabase).transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

export async function idbDelete(key: string): Promise<boolean> {
  if (useFallback) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }
  const db = await openDB();
  if (!db) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }
  return new Promise((resolve) => {
    const tx = (db as IDBDatabase).transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

/* ===== Synchronous localStorage helpers ===== */
export function localGet<T = any>(key: string, fallback?: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback!;
  } catch (e) {
    return fallback!;
  }
}

export function localSet(key: string, value: any): boolean {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) return false;
    localStorage.setItem(key, serialized);
    return true;
  } catch (e) {
    return false;
  }
}

export function localRemove(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    return false;
  }
}

// Migrate data from localStorage to IndexedDB (one-time)
export async function migrateFromLocalStorage() {
  if (useFallback) return false;
  const db = await openDB();
  if (!db) return false;

  // Check if already migrated
  const migrated = await idbGet('_migrated');
  if (migrated) return false;

  // Copy all mathbeat_* keys from localStorage
  let count = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('mathbeat')) {
      try {
        const val = JSON.parse(localStorage.getItem(key) as string);
        await idbSet(key, val);
        count++;
      } catch (e) {}
    }
  }

  await idbSet('_migrated', { date: new Date().toISOString(), count });
  return count > 0;
}
