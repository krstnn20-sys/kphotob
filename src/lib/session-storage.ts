
export type SavedBoothSession = {
  stage: "setup" | "capture" | "edit" | "result";
  layout: string;
  theme: string;
  filter: string;
  photos: string[];
  caption: string;
  showDate: boolean;
  countdown: number;
  mirrorCamera: boolean;
  stickers: {
    id: number;
    mark: string;
    x: number;
    y: number;
  }[];
  retakeIndex: number | null;
  savedAt: number;
};

const DB_NAME = "kixclicks-session-db";
const STORE_NAME = "sessions";
const SESSION_KEY = "active-session";

function openSessionDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveBoothSession(
  session: SavedBoothSession
): Promise<void> {
  const db = await openSessionDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");

    transaction.objectStore(STORE_NAME).put(session, SESSION_KEY);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };

    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function loadBoothSession(): Promise<SavedBoothSession | null> {
  const db = await openSessionDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(SESSION_KEY);

    request.onsuccess = () => {
      db.close();
      resolve(request.result ?? null);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function clearBoothSession(): Promise<void> {
  const db = await openSessionDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");

    transaction.objectStore(STORE_NAME).delete(SESSION_KEY);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };

    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}
