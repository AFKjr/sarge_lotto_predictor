// Storage shared by the Drawings, Stats and Tickets pages.
// Drawings and tickets live in IndexedDB. A copy of each is kept in memory so pages
// can read them synchronously once initStore() has resolved. If IndexedDB is
// unavailable, storage falls back to localStorage so the app keeps working.

const DB_NAME = "sarge-pick3";
const DB_VERSION = 2;
const DRAWINGS_STORE = "drawings";
const TICKETS_STORE = "tickets";
const LEGACY_DRAWINGS_KEY = "drawings";
const LEGACY_BACKUP_KEY = "drawings-legacy-backup";

const cache = { drawings: [], tickets: [] };
let database = null;
let useLocalStorage = false;

function initStore() {
    if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist();
    }

    return openDatabase().then(function(db) {
        database = db;
        return Promise.all([readAll(DRAWINGS_STORE), readAll(TICKETS_STORE)]);
    }).then(function(results) {
        cache.tickets = results[1];
        if (results[0].length === 0 && localStorage.getItem(LEGACY_DRAWINGS_KEY)) {
            return migrateDrawingsFromLocalStorage();
        }
        cache.drawings = normalizeDrawings(results[0]);
    }).catch(function(err) {
        console.error("IndexedDB unavailable, using localStorage instead.", err);
        useLocalStorage = true;
        cache.drawings = normalizeDrawings(readLocalStorage(DRAWINGS_STORE));
        cache.tickets = readLocalStorage(TICKETS_STORE);
    });
}

function loadDrawings() {
    return cache.drawings.slice();
}

function saveDrawings(drawings) {
    return saveAll(DRAWINGS_STORE, drawings);
}

function loadTickets() {
    return cache.tickets.slice();
}

function saveTickets(tickets) {
    return saveAll(TICKETS_STORE, tickets);
}

function saveAll(storeName, items) {
    cache[storeName] = items.slice();

    if (useLocalStorage) {
        try {
            localStorage.setItem(storeName, JSON.stringify(cache[storeName]));
            return Promise.resolve();
        } catch (err) {
            return Promise.reject(err);
        }
    }

    return writeAll(storeName, cache[storeName]);
}

function openDatabase() {
    return new Promise(function(resolve, reject) {
        if (!window.indexedDB) {
            reject(new Error("IndexedDB not supported"));
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = function() {
            const db = request.result;
            if (!db.objectStoreNames.contains(DRAWINGS_STORE)) {
                db.createObjectStore(DRAWINGS_STORE, { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains(TICKETS_STORE)) {
                db.createObjectStore(TICKETS_STORE, { keyPath: "id" });
            }
        };
        request.onsuccess = function() {
            const db = request.result;
            // Let a newer version of the app open in another tab upgrade the database.
            db.onversionchange = function() { db.close(); };
            resolve(db);
        };
        request.onerror = function() { reject(request.error); };
        request.onblocked = function() { reject(new Error("Database upgrade blocked by another open tab")); };
    });
}

function readAll(storeName) {
    return new Promise(function(resolve, reject) {
        const request = database.transaction(storeName, "readonly")
            .objectStore(storeName)
            .getAll();
        request.onsuccess = function() { resolve(request.result); };
        request.onerror = function() { reject(request.error); };
    });
}

// Replaces the whole store in one transaction, so a failed save leaves the previous data intact.
function writeAll(storeName, items) {
    return new Promise(function(resolve, reject) {
        const tx = database.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        store.clear();
        for (let i = 0; i < items.length; i++) {
            store.put(items[i]);
        }
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { reject(tx.error); };
        tx.onabort = function() { reject(tx.error); };
    });
}

// One-time move of drawings saved by older versions of the app. The old copy is
// kept under a backup key rather than deleted.
function migrateDrawingsFromLocalStorage() {
    const drawings = normalizeDrawings(readLocalStorage(DRAWINGS_STORE));
    return writeAll(DRAWINGS_STORE, drawings).then(function() {
        localStorage.setItem(LEGACY_BACKUP_KEY, localStorage.getItem(LEGACY_DRAWINGS_KEY));
        localStorage.removeItem(LEGACY_DRAWINGS_KEY);
        cache.drawings = drawings;
    });
}

function readLocalStorage(key) {
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    return JSON.parse(stored);
}

function normalizeDrawings(drawings) {
    for (let i = 0; i < drawings.length; i++) {
        if (!drawings[i].id) {
            drawings[i].id = Date.now() + i;
        }
        if (!drawings[i].draw) {
            drawings[i].draw = "evening";
        }
    }
    return drawings;
}
