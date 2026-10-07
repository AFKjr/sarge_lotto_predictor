// Drawing storage shared by drawings.js and stats.js.
// Drawings live in IndexedDB. A copy is kept in memory so pages can read them
// synchronously once initDrawingStore() has resolved. If IndexedDB is unavailable,
// storage falls back to localStorage so the app keeps working.

const DB_NAME = "sarge-pick3";
const DB_VERSION = 1;
const DRAWINGS_STORE = "drawings";
const LEGACY_KEY = "drawings";
const LEGACY_BACKUP_KEY = "drawings-legacy-backup";

let drawingsCache = [];
let database = null;
let useLocalStorage = false;

function initDrawingStore() {
    if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist();
    }

    return openDatabase().then(function(db) {
        database = db;
        return readAllDrawings();
    }).then(function(drawings) {
        if (drawings.length === 0 && localStorage.getItem(LEGACY_KEY)) {
            return migrateFromLocalStorage();
        }
        drawingsCache = normalizeDrawings(drawings);
    }).catch(function(err) {
        console.error("IndexedDB unavailable, using localStorage instead.", err);
        useLocalStorage = true;
        drawingsCache = normalizeDrawings(readLegacyDrawings());
    });
}

function loadDrawings() {
    return drawingsCache.slice();
}

function saveDrawings(drawings) {
    drawingsCache = drawings.slice();

    if (useLocalStorage) {
        try {
            localStorage.setItem(LEGACY_KEY, JSON.stringify(drawingsCache));
            return Promise.resolve();
        } catch (err) {
            return Promise.reject(err);
        }
    }

    return writeAllDrawings(drawingsCache);
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
        };
        request.onsuccess = function() { resolve(request.result); };
        request.onerror = function() { reject(request.error); };
    });
}

function readAllDrawings() {
    return new Promise(function(resolve, reject) {
        const request = database.transaction(DRAWINGS_STORE, "readonly")
            .objectStore(DRAWINGS_STORE)
            .getAll();
        request.onsuccess = function() { resolve(request.result); };
        request.onerror = function() { reject(request.error); };
    });
}

// Replaces the whole store in one transaction, so a failed save leaves the previous data intact.
function writeAllDrawings(drawings) {
    return new Promise(function(resolve, reject) {
        const tx = database.transaction(DRAWINGS_STORE, "readwrite");
        const store = tx.objectStore(DRAWINGS_STORE);
        store.clear();
        for (let i = 0; i < drawings.length; i++) {
            store.put(drawings[i]);
        }
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { reject(tx.error); };
        tx.onabort = function() { reject(tx.error); };
    });
}

// One-time move of data saved by older versions of the app. The old copy is kept
// under a backup key rather than deleted.
function migrateFromLocalStorage() {
    const drawings = normalizeDrawings(readLegacyDrawings());
    return writeAllDrawings(drawings).then(function() {
        localStorage.setItem(LEGACY_BACKUP_KEY, localStorage.getItem(LEGACY_KEY));
        localStorage.removeItem(LEGACY_KEY);
        drawingsCache = drawings;
    });
}

function readLegacyDrawings() {
    const stored = localStorage.getItem(LEGACY_KEY);
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
