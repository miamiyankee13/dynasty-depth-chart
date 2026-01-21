function getPickRound(pick) {
  const raw = String(pick ?? "").toLowerCase();

  // numeric format: 1.01, 2.11, etc
  const numMatch = raw.match(/^(\d{1,2})\.\d{1,2}$/);
  if (numMatch) return Number(numMatch[1]);

  // text formats: 1st, 2nd, 3rd, etc
  if (raw.includes("1st")) return 1;
  if (raw.includes("2nd")) return 2;
  if (raw.includes("3rd")) return 3;
  if (raw.includes("4th")) return 4;
  if (raw.includes("5th")) return 5;

  return null;
}

const pickTheme = {
  1: { bg: "#fef9c3", color: "#854d0e" }, // light yellow
  2: { bg: "#dcfce7", color: "#166534" }, // light green
  3: { bg: "#e0f2fe", color: "#075985" }, // light blue
  4: { bg: "#ffedd5", color: "#9a3412" }, // light orange
  5: { bg: "#fce7f3", color: "#9d174d" }, // light pink
};

const pickThemeDark = {
  1: { bg: "#3a2f12", color: "#facc15" }, // warm gold
  2: { bg: "#143022", color: "#4ade80" }, // green
  3: { bg: "#12313a", color: "#22d3ee" }, // cyan/blue
  4: { bg: "#3a2312", color: "#fb923c" }, // orange
  5: { bg: "#2a1f26", color: "#f472b6" }, // pink
};

function parsePickKey(pick) {
  const raw = String(pick ?? "").trim();
  const m = raw.match(/^(\d{1,2})\.(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number(m[2]);
}

function sortPicks(list) {
  const arr = (list ?? []).map((p) => String(p).trim()).filter(Boolean);

  const standard = [];
  const other = [];

  for (const p of arr) {
    const key = parsePickKey(p);
    if (key == null) other.push(p);
    else standard.push({ p, key });
  }

  standard.sort((a, b) => a.key - b.key);
  other.sort((a, b) => a.localeCompare(b));

  return [...standard.map((x) => x.p), ...other];
}

function PickChip({ text, isDark }) {
  const round = getPickRound(text);
  const theme = (isDark ? pickThemeDark : pickTheme)[round];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "8px 10px",
        borderRadius: 999,
        border: `1px solid ${theme ? `color-mix(in oklab, ${theme.color} 55%, transparent)` : "var(--ddc-pill-border)"}`,
        background: theme ? theme.bg : "var(--ddc-pill-bg)",
        color: theme ? theme.color : "var(--ddc-text)",
        fontSize: "var(--ddc-text-sm)",
        fontWeight: "var(--ddc-weight-bold)",
        letterSpacing: "0.01em",
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

export function PicksView({ picksByYear, isDark = false }) {
  const years = ["2026", "2027", "2028"];

  return (
    <div style={{ marginTop: 16 }}>
      {years.map((y) => {
        const picks = sortPicks(picksByYear?.[y] ?? []);
        const hasAny = picks.length > 0;

        return (
          <div
            key={y}
            style={{
              background: "var(--ddc-card-bg)",
              border: "1px solid var(--ddc-border)",
              borderRadius: 16,
              padding: 14,
              marginBottom: 12,
              color: "var(--ddc-text)",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "var(--ddc-text)" }}>
                {y} Picks
              </div>
              <div
                style={{
                  fontSize: "var(--ddc-text-xs)",
                  color: "var(--ddc-muted)",
                  fontWeight: "var(--ddc-weight-medium)",
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                }}
              >
                {hasAny ? `${picks.length} total` : "None"}
              </div>
            </div>

            {!hasAny ? (
              <div style={{ fontSize: 13, color: "var(--ddc-muted)" }}>
                No picks listed for {y}.
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {picks.map((p, idx) => (
                  <PickChip key={`${y}-${p}-${idx}`} text={p} isDark={isDark} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
