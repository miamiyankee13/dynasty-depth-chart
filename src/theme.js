/* Group color theme — Terminal palette (paired with Rookie Board).
   Each entry exposes:
     color   — primary accent for the group
     bg      — subtle 10% tinted background for slot pills (computed via color-mix)
     bgDark  — same as bg in Terminal (we no longer flip themes manually here;
               the CSS variables handle dark/light, but bgDark is kept for
               compatibility with callers that still read it).
*/

export const GROUPS = ["QB", "RB", "WR", "TE", "DEF", "TAXI", "PICKS"];

const tint = (varName) => `color-mix(in oklab, ${varName} 10%, transparent)`;

export const groupTheme = {
  QB:     { label: "QB",     color: "var(--ddc-pos-QB)",     bg: tint("var(--ddc-pos-QB)"),     bgDark: tint("var(--ddc-pos-QB)") },
  RB:     { label: "RB",     color: "var(--ddc-pos-RB)",     bg: tint("var(--ddc-pos-RB)"),     bgDark: tint("var(--ddc-pos-RB)") },
  WR:     { label: "WR",     color: "var(--ddc-pos-WR)",     bg: tint("var(--ddc-pos-WR)"),     bgDark: tint("var(--ddc-pos-WR)") },
  TE:     { label: "TE",     color: "var(--ddc-pos-TE)",     bg: tint("var(--ddc-pos-TE)"),     bgDark: tint("var(--ddc-pos-TE)") },
  DEF:    { label: "DEF",    color: "var(--ddc-pos-DEF)",    bg: tint("var(--ddc-pos-DEF)"),    bgDark: tint("var(--ddc-pos-DEF)") },
  TAXI:   { label: "TAXI",   color: "var(--ddc-pos-TAXI)",   bg: tint("var(--ddc-pos-TAXI)"),   bgDark: tint("var(--ddc-pos-TAXI)") },
  PICKS:  { label: "PICKS",  color: "var(--ddc-pos-PICKS)",  bg: tint("var(--ddc-pos-PICKS)"),  bgDark: tint("var(--ddc-pos-PICKS)") },
  ROSTER: { label: "ROSTER", color: "var(--ddc-pos-ROSTER)", bg: tint("var(--ddc-pos-ROSTER)"), bgDark: tint("var(--ddc-pos-ROSTER)") },
};
