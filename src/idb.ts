const FALLBACK_LOCAL_STORAGE_KEY = "___idbfallback";
const fallbackGet = (k: string): unknown => {
  const item = localStorage.getItem(FALLBACK_LOCAL_STORAGE_KEY);
  return item ? JSON.parse(item)[k] : void 0;
};
let isUsingFallbacks = false;
const fallbackSet = (
  key: string,
  value: object | string | number | Array<unknown> | unknown
): void => {
  const item = localStorage.getItem(FALLBACK_LOCAL_STORAGE_KEY);
  const js = item ? JSON.parse(item) : {};

  js[key] = value;

  localStorage.setItem(FALLBACK_LOCAL_STORAGE_KEY, JSON.stringify(js));
};
export class WebStore {
  readonly _dbp: Promise<IDBDatabase>;
  private storeName: string;
  constructor(dbName = "jskit-store", storeName = "tokenStore") {
    this.storeName = storeName;
    this._dbp = new Promise((resolve, reject) => {
      const openreq = indexedDB.open(dbName, 1);
      openreq.onerror = () => reject(openreq.error);
      openreq.onsuccess = () => resolve(openreq.result);

      openreq.onupgradeneeded = () =>
        void openreq.result.createObjectStore(storeName);
    });
  }

  __IDBAct__(
    type: IDBTransactionMode,
    callback: (store: IDBObjectStore) => void
  ): Promise<void> {
    return this._dbp.then(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(this.storeName, type);
          transaction.oncomplete = () => resolve();
          transaction.onabort = transaction.onerror = () =>
            reject(transaction.error);
          callback(transaction.objectStore(this.storeName));
        })
    );
  }
}

let store: WebStore;

function getDefaultStore() {
  if (!store) store = new WebStore();
  return store;
}

export function get<Type>(
  key: IDBValidKey,
  store = getDefaultStore()
): Promise<Type> {
  if (isUsingFallbacks) {
    return Promise.resolve(fallbackGet(key as string) as Type);
  }
  let req: IDBRequest;
  return store
    .__IDBAct__("readonly", (store) => {
      req = store.get(key);
    })
    .then(() => req.result)
    .catch((e) => {
      _logFallback(e);
      return fallbackGet(key as string);
    });
}

export function set(
  key: IDBValidKey,
  value: unknown,
  store = getDefaultStore()
): Promise<void> {
  if (isUsingFallbacks) {
    return Promise.resolve(fallbackSet(key as string, value));
  }
  return store
    .__IDBAct__("readwrite", (store) => {
      store.put(value, key);
    })
    .catch((e) => {
      _logFallback(e);
      return fallbackSet(key as string, value);
    });
}

export function del(
  key: IDBValidKey,
  store = getDefaultStore()
): Promise<void> {
  if (isUsingFallbacks) {
    return Promise.resolve(fallbackSet(key as string, undefined));
  }
  return store
    .__IDBAct__("readwrite", (store) => {
      store.delete(key);
    })
    .catch((e) => {
      _logFallback(e);
      return fallbackSet(key as string, undefined);
    });
}

export function clear(store = getDefaultStore()): Promise<void> {
  if (isUsingFallbacks) {
    return Promise.resolve(localStorage.removeItem(FALLBACK_LOCAL_STORAGE_KEY));
  }
  return store
    .__IDBAct__("readwrite", (store) => {
      store.clear();
    })
    .catch((e) => {
      _logFallback(e);
      return localStorage.removeItem(FALLBACK_LOCAL_STORAGE_KEY);
    });
}

const _logFallback = (arg?: Error): void => {
  if (arg && arg.name === "QuotaExceededError") {
    // explicitly handle
    throw arg;
  }
  isUsingFallbacks = true;
  console.log(String(arg) || "using localstorage fallback");
};
