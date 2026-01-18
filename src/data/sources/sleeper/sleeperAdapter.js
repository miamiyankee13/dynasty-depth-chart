// src/data/sources/sleeper/sleeperAdapter.js
import {
  getUserByUsername,
  getUserLeagues,
  getLeagueUsers,
  getLeagueRosters,
  getLeague,
  getLeagueTradedPicks,
  getLeagueDrafts,   
  getDraft       
} from "./sleeperClient";

import { getSleeperPlayersDict } from "./playersCache";

const USERNAME_KEY = "ddc.sleeper.username";

export function setSleeperUsername(username) {
  localStorage.setItem(USERNAME_KEY, String(username || "").trim());
}

export function getSleeperUsername() {
  return (localStorage.getItem(USERNAME_KEY) || "").trim();
}

export function clearSleeperUsername() {
  localStorage.removeItem("ddc.sleeper.username");
}

function countStartersFromRosterPositions(league) {
  const rp = league?.roster_positions;
  if (!Array.isArray(rp)) return null;

  // Bench/reserve-ish slots that should NOT count as starters.
  // "BN" is the big one; others appear depending on league settings.
  const NON_STARTER = new Set(["BN", "IR", "RES", "TAXI"]);

  return rp.filter((slot) => !NON_STARTER.has(String(slot || "").toUpperCase())).length;
}

function isSuperflex(league) {
  const rp = league?.roster_positions;
  if (!Array.isArray(rp)) return false;
  return rp.includes("SUPER_FLEX");
}

function isTwoQB(league) {
  const rp = league?.roster_positions;
  if (!Array.isArray(rp)) return false;
  const qbCount = rp.filter((x) => x === "QB").length;
  return qbCount >= 2;
}

function isBestBall(league) {
  return !!league?.settings?.best_ball;
}

function pprLabel(league) {
  const rec = league?.scoring_settings?.rec;
  if (rec === 1) return "PPR";
  if (rec === 0.5) return "0.5 PPR";
  if (rec === 0) return "No PPR";
  return null;
}

function passTdLabel(league) {
  const passTd = num(league?.scoring_settings?.pass_td);
  if (passTd === 6) return "6 PT Pass TD";
  return null; // treat everything else as default / don’t show
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function tePremiumAmount(league) {
  const scoring = league?.scoring_settings || {};

  // Base reception points (PPR / Half / etc.)
  const baseRec = num(scoring.rec);
  if (baseRec == null) return null;

  // Case 1: TE has its own reception value (e.g. rec_te = 1.5 while rec = 1)
  const recTe = num(scoring.rec_te);
  if (recTe != null && recTe > baseRec) {
    return recTe - baseRec;
  }

  // Case 2: Explicit TE bonus per reception (e.g. bonus_rec_te = 0.5)
  const bonusTe = num(scoring.bonus_rec_te);
  if (bonusTe != null && bonusTe > 0) {
    return bonusTe;
  }

  return null;
}

function firstDownAmount(league) {
  const scoring = league?.scoring_settings || {};

  // Sleeper commonly uses: rush_fd, rec_fd (and pass_fd)
  // Some people refer to them as first_down_rush/first_down_rec, so we support both.
  const rush = num(scoring.rush_fd ?? scoring.first_down_rush);
  const rec = num(scoring.rec_fd ?? scoring.first_down_rec);

  const rushValid = rush != null && rush > 0;
  const recValid = rec != null && rec > 0;

  if (!rushValid && !recValid) return null;

  // If both exist and match (most common)
  if (rushValid && recValid && rush === rec) return rush;

  // If only one exists, or they differ, return an object for clarity
  return {
    rush: rushValid ? rush : null,
    rec: recValid ? rec : null,
  };
}

function buildSettingsPillsFromLeague(league) {
  const pills = [];

  // Teams
  if (typeof league?.total_rosters === "number") {
    pills.push(`${league.total_rosters}T`);
  }

  // QB format
  if (isSuperflex(league)) pills.push("SF");
  else if (isTwoQB(league)) pills.push("2QB");
  else pills.push("1QB");

  // Best Ball
  if (isBestBall(league)) pills.push("BB");

  // PPR
  const ppr = pprLabel(league);
  if (ppr) pills.push(ppr);

  // TE Premium
  const tep = tePremiumAmount(league);
  if (tep != null && tep > 0) {
    pills.push(`${tep} TEP`);
  }

  // Points per First Down (rush / rec)
  const ppfd = firstDownAmount(league);
  if (typeof ppfd === "number") {
    pills.push(`${ppfd} PPFD`);
  } else if (ppfd && (ppfd.rush || ppfd.rec)) {
    // Rare edge case: different values for rush vs rec
    const parts = [];
    if (ppfd.rush) parts.push(`R ${ppfd.rush}`);
    if (ppfd.rec) parts.push(`REC ${ppfd.rec}`);
    pills.push(`PPFD (${parts.join(", ")})`);
  }

  // Passing TDs (only show if non-default)
  const passTd = passTdLabel(league);
  if (passTd) pills.push(passTd);

  // Starters
  const starters = countStartersFromRosterPositions(league);
  if (typeof starters === "number") {
    pills.push(`Start ${starters}`);
  }

  return pills;
}

function toGroupFromPosition(pos) {
  const p = String(pos || "").toUpperCase();
  if (p === "QB" || p === "RB" || p === "WR" || p === "TE" || p === "DEF") return p;
  // ignore kickers for now or put them in TAXI:
  return null;
}

function buildPlayerRow(player, group, order) {
  const name =
    player?.full_name ||
    [player?.first_name, player?.last_name].filter(Boolean).join(" ") ||
    player?.last_name ||
    "Unknown";

  return {
    id: `sleeper-player:${player.player_id}`,
    name,
    age: player?.age ? String(player.age) : "",
    nflTeam: player?.team || "",
    group,
    position: group,
    order,
    note: "",
    injured: false,
  };
}

function rosterHasUser(roster, userId) {
  const uid = String(userId);

  // Primary owner
  if (String(roster?.owner_id) === uid) return true;

  // Co-owners (can be missing, null, or an array)
  const co = roster?.co_owners;
  if (Array.isArray(co)) {
    return co.map(String).includes(uid);
  }

  return false;
}

function buildTeamName(roster, usersById) {
  const u = usersById?.[roster.owner_id];

  //Preferred: Sleeper team name is commonly stored on the USER object metadata
  const userTeamName = u?.metadata?.team_name;
  if (userTeamName && String(userTeamName).trim()) {
    return String(userTeamName).trim();
  }

  // Fallback: sometimes rosters include it (not guaranteed)
  const rosterTeamName = roster?.metadata?.team_name;
  if (rosterTeamName && String(rosterTeamName).trim()) {
    return String(rosterTeamName).trim();
  }

  // Final fallback: display name / username
  return u?.display_name || u?.username || "Team";
}

function roundToText(round) {
  const r = Number(round);
  if (r === 1) return "1st";
  if (r === 2) return "2nd";
  if (r === 3) return "3rd";
  return `${r}th`;
}

// draft_rounds in Sleeper can refer to startup draft (like 18+ rounds).
// We only want rookie rounds. If it’s huge, fall back to 5.
function getRookieRoundsFromLeague(league) {
  const a = Number(league?.settings?.rookie_draft_rounds);
  if (Number.isFinite(a) && a > 0 && a <= 10) return a;

  const b = Number(league?.settings?.draft_rounds);
  if (Number.isFinite(b) && b > 0 && b <= 10) return b;

  return 5; // common default for dynasty rookie drafts
}

function formatSlotPick(round, slot) {
  const rr = String(round);
  const ss = String(slot).padStart(2, "0");
  return `${rr}.${ss}`;
}

function formatFuturePick(round, originalRosterId, myRosterId, rosterIdToName) {
  const base = roundToText(round);

  // If it's originally your pick, no "via"
  if (String(originalRosterId) === String(myRosterId)) return base;

  const via =
    rosterIdToName?.get(String(originalRosterId)) || `Roster ${originalRosterId}`;

  return `${base} via ${via}`;
}

/**
 * @param {Object} args
 * @param {string[]} args.years - ["2026","2027","2028"]
 * @param {number} args.rounds - rookie rounds
 * @param {Array} args.tradedPicks - Sleeper /traded_picks response
 * @param {number|string} args.myRosterId - your roster_id number
 * @param {Map<string,string>} args.rosterIdToName - roster_id -> display_name (for "via")
 * @param {Map<string,number>|null} args.slotByRosterId2026 - roster_id -> draft slot (1..N) for 2026, or null if unavailable
 */
function buildPicksByYearUsingOwnership({
  years,
  rounds,
  tradedPicks,
  myRosterId,
  rosterIdToName,
  slotByRosterId2026,
}) {
  const myId = String(myRosterId);

  // pickKey -> currentOwnerRosterId
  // pickKey is stable: season-round-originalRoster
  const ownerByPickKey = new Map();

  // 1) Baseline: my own original picks exist even if never traded.
  for (const y of years) {
    for (let r = 1; r <= rounds; r++) {
      const key = `${y}-${r}-${myId}`;
      ownerByPickKey.set(key, myId);
    }
  }

  // 2) Overlay traded picks: set current owner for that pick identity
  for (const p of tradedPicks || []) {
    const year = String(p.season);
    if (!years.includes(year)) continue;

    const round = Number(p.round);
    if (!Number.isFinite(round) || round < 1 || round > rounds) continue;

    const original = String(p.roster_id); // ORIGINAL roster
    const owner = String(p.owner_id);     // CURRENT owner

    if (!original || !owner) continue;

    const key = `${year}-${round}-${original}`;
    ownerByPickKey.set(key, owner);
  }

  // 3) Collect picks I currently own, with formatting rules
  const out = Object.fromEntries(years.map((y) => [y, []]));

  for (const [key, owner] of ownerByPickKey.entries()) {
    if (owner !== myId) continue;

    const parts = key.split("-");
    const year = parts[0];
    const round = Number(parts[1]);
    const originalRosterId = parts[2];

    if (!out[year]) continue;

    // 2026: show 1.01 style if we have slot mapping
    if (year === "2026" && slotByRosterId2026) {
      const slot = slotByRosterId2026.get(String(originalRosterId));
      if (slot != null) {
        out[year].push(formatSlotPick(round, slot));
        continue;
      }
      // fallback if slot unknown
      out[year].push(formatFuturePick(round, originalRosterId, myId, rosterIdToName));
      continue;
    }

    // Future years: "Nth" or "Nth via Owner"
    out[year].push(formatFuturePick(round, originalRosterId, myId, rosterIdToName));
  }

  return out;
}

// Keep it simple for Phase 1: use current year
const DEFAULT_SEASON = new Date().getFullYear();

export async function loadTeamsFromSleeper() {
  const username = getSleeperUsername();
  if (!username) return [];

  const user = await getUserByUsername(username);
  const leagues = await getUserLeagues(user.user_id, DEFAULT_SEASON);

  // load player dict once (cached)
  const playersDict = await getSleeperPlayersDict();

  const teams = [];

  for (const lg of leagues) {
    
    const [league, users, rosters, tradedPicks] = await Promise.all([
      getLeague(lg.league_id),
      getLeagueUsers(lg.league_id),
      getLeagueRosters(lg.league_id),
      getLeagueTradedPicks(lg.league_id),
    ]);

    const usersById = Object.fromEntries(users.map((u) => [u.user_id, u]));
    const rosterIdToName = new Map(
      (rosters || []).map((r) => {
        const u = usersById[r.owner_id];
        const name = u?.display_name || u?.username || `Roster ${r.roster_id}`;
        return [String(r.roster_id), name];
      })
    );

    const myRoster = (rosters || []).find((r) => rosterHasUser(r, user.user_id));
    if (!myRoster) continue;

    let slotByRosterId2026 = null;

    try {
      const drafts = await getLeagueDrafts(lg.league_id);
      const totalRosters = Number(league?.total_rosters) || (rosters?.length ?? 0);
      const rookieRounds = getRookieRoundsFromLeague(league);

      // Only consider drafts for the 2026 season (NO fallback to other drafts)
      const seasonDrafts = (drafts || []).filter((d) => String(d.season) === "2026");

      // Prefer explicitly-rookie if present, otherwise pick one that "looks like" rookie
      // (rookie drafts are usually <= 10 rounds; startups are often much larger)
      const d2026 =
        seasonDrafts.find((d) => String(d.draft_type || "").toLowerCase() === "rookie") ||
        seasonDrafts.find((d) => {
          const rounds = Number(d?.settings?.rounds);
          return Number.isFinite(rounds) && rounds > 0 && rounds <= Math.max(10, rookieRounds);
        }) ||
        null;

      if (d2026?.draft_id) {
        const draft = await getDraft(d2026.draft_id);

        const userIdToSlot = draft?.draft_order || {};
        const hasExplicitOrder = Object.keys(userIdToSlot).length > 0;

        if (!hasExplicitOrder) {
          // Draft exists but order not set → do NOT show slot-based picks
          slotByRosterId2026 = null;
        } else {
          const map = new Map(); // roster_id -> slot

          for (const r of rosters || []) {
            const slot = userIdToSlot[r.owner_id];
            if (slot != null) {
              map.set(String(r.roster_id), Number(slot));
            }
          }

          // Only accept if it covers most of the league
          const total = Number(league?.total_rosters) || rosters.length;
          if (map.size >= Math.floor(total * 0.8)) {
            slotByRosterId2026 = map;
          } else {
            slotByRosterId2026 = null;
          }
        }
      }
    } catch {
      slotByRosterId2026 = null;
    }

    const years = ["2026", "2027", "2028"];
    const rounds = getRookieRoundsFromLeague(league);

    const picksByYear = buildPicksByYearUsingOwnership({
      years,
      rounds,
      tradedPicks,
      myRosterId: myRoster.roster_id,
      rosterIdToName,
      slotByRosterId2026, // can be null if no draft/order found
    });

    const taxiSet = new Set(myRoster.taxi || []);
    const startersSet = new Set(myRoster.starters || []);

    const rows = [];

    // 1) starters first (preserves Sleeper order)
    let starterOrderByGroup = { QB: 0, RB: 0, WR: 0, TE: 0, DEF: 0 };
    for (const pid of myRoster.starters || []) {
      if (!pid) continue;
      const p = playersDict[pid];
      const group = toGroupFromPosition(p?.position);
      if (!group) continue;
      starterOrderByGroup[group] += 1;
      rows.push(buildPlayerRow(p, group, starterOrderByGroup[group]));
    }

    // 2) taxi
    let txOrder = 0;
    for (const pid of myRoster.taxi || []) {
      const p = playersDict[pid];
      if (!p) continue;
      txOrder += 1;
      rows.push(buildPlayerRow(p, "TAXI", txOrder));
    }

    // 3) remaining bench (players list includes starters + taxi sometimes; so filter)
    const seen = new Set(rows.map((r) => r.id));
    const benchOrderByGroup = { QB: starterOrderByGroup.QB, RB: starterOrderByGroup.RB, WR: starterOrderByGroup.WR, TE: starterOrderByGroup.TE, DEF: starterOrderByGroup.DEF };

    for (const pid of myRoster.players || []) {
      if (!pid) continue;
      if (startersSet.has(pid)) continue;
      if (taxiSet.has(pid)) continue;

      const p = playersDict[pid];
      const group = toGroupFromPosition(p?.position);
      if (!group) continue;

      const id = `sleeper-player:${p.player_id}`;
      if (seen.has(id)) continue;

      benchOrderByGroup[group] += 1;
      rows.push(buildPlayerRow(p, group, benchOrderByGroup[group]));
      seen.add(id);
    }

    teams.push({
      id: `sleeper:${lg.league_id}`,
      leagueName: lg.name || "Sleeper League",
      name: buildTeamName(myRoster, usersById),
      players: rows,
      picksByYear,
      settingsPills: buildSettingsPillsFromLeague(league),
      isBestBall: isBestBall(league),
      source: "sleeper",
      external: {
        platform: "sleeper",
        leagueId: lg.league_id,
        userId: user.user_id,
        fantasycalc: {
          isDynasty: true,
          numQbs: isSuperflex(league) || isTwoQB(league) ? 2 : 1,
          numTeams: Number.isFinite(Number(league?.total_rosters)) ? Number(league.total_rosters) : 12,
          ppr: num(league?.scoring_settings?.rec) ?? 1,
        },
      },
    });
  }
  return teams;
}