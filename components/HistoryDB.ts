export interface StoredSVGA {
  uid: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  fileData: Blob;
  uploadedAt: number;
}

const DB_NAME = 'SVGAViewerHistoryDB_v2';
const DB_VERSION = 1;
const STORE_NAME = 'history';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // We use a composite key of uid and name to allow different users to have different files with same names,
        // or just 'uid' and 'name' as keyPath.
        const store = db.createObjectStore(STORE_NAME, { keyPath: ['uid', 'name'] });
        store.createIndex('uid', 'uid', { unique: false });
        store.createIndex('uploadedAt', 'uploadedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveHistoryItem = async (uid: string, file: File | Blob, name: string, size: number, type: string, lastModified: number): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const record: StoredSVGA = {
        uid,
        name,
        size,
        type: type || 'application/octet-stream',
        lastModified: lastModified || Date.now(),
        fileData: file,
        uploadedAt: Date.now()
      };
      
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to save to IndexedDB', err);
  }
};

export const getHistoryItems = async (uid: string): Promise<StoredSVGA[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('uid');
      const request = index.getAll(IDBKeyRange.only(uid));
      
      request.onsuccess = () => {
        const results = request.result as StoredSVGA[];
        // Sort by uploadedAt descending
        results.sort((a, b) => b.uploadedAt - a.uploadedAt);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to read from IndexedDB', err);
    return [];
  }
};

export const deleteHistoryItem = async (uid: string, name: string): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete([uid, name]);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to delete from IndexedDB', err);
  }
};

export const clearUserHistory = async (uid: string): Promise<void> => {
  try {
    const db = await initDB();
    const items = await getHistoryItems(uid);
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    for (const item of items) {
      store.delete([uid, item.name]);
    }
  } catch (err) {
    console.error('Failed to clear User history', err);
  }
};
