// src/data/sources/fantasycalc/fantasycalc.js

const FC_CACHE_PREFIX = "ddc.fantasycalc.values.v1";
const FC_REDRAFT_RANK_CACHE_PREFIX = "ddc.fantasycalc.redraft.ranks.v1";
const DAY_MS = 24 * 60 * 60 * 1000;

function makeKey(params) {
  const isDynasty = params?.isDynasty ? "dyn" : "red";
  const numQbs = Number(params?.numQbs ?? 1);
  const numTeams = Number(params?.numTeams ?? 12);
  const ppr = Number(params?.ppr ?? 1);
  return `${isDynasty}|qbs=${numQbs}|teams=${numTeams}|ppr=${ppr}`;
}

export function getFantasyCalcUpdatedAt(params) {
  try {
    const key = makeKey(params);
    const raw = localStorage.getItem(`${FC_CACHE_PREFIX}:${key}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.ts) return null;

    return Number(parsed.ts);
  } catch {
    return null;
  }
}

function getCache(key) {
  try {
    const raw = localStorage.getItem(`${FC_CACHE_PREFIX}:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !parsed?.data) return null;
    if (Date.now() - parsed.ts > DAY_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function setCache(key, data) {
  try {
    localStorage.setItem(
      `${FC_CACHE_PREFIX}:${key}`,
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch {}
}

function getRankCache(key) {
  try {
    const raw = localStorage.getItem(`${FC_REDRAFT_RANK_CACHE_PREFIX}:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !parsed?.data) return null;
    if (Date.now() - parsed.ts > DAY_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function setRankCache(key, data) {
  try {
    localStorage.setItem(
      `${FC_REDRAFT_RANK_CACHE_PREFIX}:${key}`,
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch {}
}

/**
 * Returns: Map<sleeperIdString, rawValueNumber>
 */
export async function getFantasyCalcValues(params) {
  const key = makeKey(params);

  const cached = getCache(key);
  if (cached) {
    // cached is a plain object sleeperId -> value
    return { key, values: new Map(Object.entries(cached)) };
  }

  const url = new URL("https://api.fantasycalc.com/values/current");
  url.searchParams.set("isDynasty", String(!!params?.isDynasty));
  url.searchParams.set("numQbs", String(params?.numQbs ?? 1));
  url.searchParams.set("numTeams", String(params?.numTeams ?? 12));
  url.searchParams.set("ppr", String(params?.ppr ?? 1));

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`FantasyCalc HTTP ${res.status}`);
  const json = await res.json();

  // Build sleeperId -> value lookup
  const obj = {};
  for (const row of Array.isArray(json) ? json : []) {
    const sleeperId = row?.player?.sleeperId;
    const value = row?.value;
    if (sleeperId == null) continue;
    if (!Number.isFinite(Number(value))) continue;
    obj[String(sleeperId)] = Number(value);
  }

  setCache(key, obj);
  return { key, values: new Map(Object.entries(obj)) };
}

/**
 * Returns: Map<sleeperIdString, { position, positionRank, label, longLabel }>
 */
export async function getFantasyCalcRedraftRanks(params) {
  const redraftParams = { ...(params ?? {}), isDynasty: false };
  const key = makeKey(redraftParams);

  const cached = getRankCache(key);
  if (cached) {
    return { key, ranks: new Map(Object.entries(cached)) };
  }

  const url = new URL("https://api.fantasycalc.com/values/current");
  url.searchParams.set("isDynasty", "false");
  url.searchParams.set("numQbs", String(params?.numQbs ?? 1));
  url.searchParams.set("numTeams", String(params?.numTeams ?? 12));
  url.searchParams.set("ppr", String(params?.ppr ?? 1));

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`FantasyCalc Redraft HTTP ${res.status}`);
  const json = await res.json();

  const obj = {};

  for (const row of Array.isArray(json) ? json : []) {
    const sleeperId = row?.player?.sleeperId;
    const position = row?.player?.position;
    const positionRank = Number(row?.positionRank);

    if (sleeperId == null) continue;
    if (!position) continue;
    if (!Number.isFinite(positionRank)) continue;

    const label = `${position}${positionRank}`;

    obj[String(sleeperId)] = {
      position,
      positionRank,
      label,
      longLabel: `REDRAFT ${label}`,
    };
  }

  setRankCache(key, obj);
  return { key, ranks: new Map(Object.entries(obj)) };
}

export function scaleFantasyCalcValue(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.round(n / 100); // subtle, readable, not a dead giveaway
}