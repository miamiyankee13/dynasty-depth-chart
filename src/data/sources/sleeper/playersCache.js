// src/data/sources/sleeper/playersCache.js
const DB_NAME = "ddc";
const STORE = "sleeper_players";
const KEY_PLAYERS = "players";
const KEY_META = "meta";

const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function fetchPlayers() {
  const res = await fetch("https://api.sleeper.app/v1/players/nfl");
  if (!res.ok) throw new Error(`Failed to fetch Sleeper players: ${res.status}`);
  return res.json();
}

export async function getSleeperPlayersDict() {
  const meta = await idbGet(KEY_META);
  const now = Date.now();

  if (meta?.updatedAt && now - meta.updatedAt < MAX_AGE_MS) {
    const cached = await idbGet(KEY_PLAYERS);
    if (cached) return cached;
  }

  const players = await fetchPlayers();
  await idbSet(KEY_PLAYERS, players);
  await idbSet(KEY_META, { updatedAt: now });

  return players;
}