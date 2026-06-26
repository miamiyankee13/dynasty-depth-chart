import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ValBar } from "./ValBar";

/* Drag-handle icon — 6-dot grip, fixed pixel size for reliable rendering. */
function GripIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <circle cx="3" cy="3" r="1" />
      <circle cx="9" cy="3" r="1" />
      <circle cx="3" cy="6" r="1" />
      <circle cx="9" cy="6" r="1" />
      <circle cx="3" cy="9" r="1" />
      <circle cx="9" cy="9" r="1" />
    </svg>
  );
}

function BenchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden
      focusable="false"
      className="ddc-bench-icon"
    >
      <path
        d="M4 5.5H14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M9 5.5V13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6.5 10.5L9 13L11.5 10.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ageClass(age) {
  const n = parseInt(age, 10);
  if (!Number.isFinite(n)) return "";
  if (n <= 23) return "young";
  if (n >= 29) return "vet";
  return "";
}

function formatValPct(part, total) {
  const p = Number(part);
  const t = Number(total);
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) return null;
  return `${Math.round((p / t) * 100)}%`;
}

function BenchDivider({ label = "Bench" }) {
  return (
    <div className="ddc-bench-divider" aria-label="Bench Divider">
      <div className="ddc-bench-rule" />
      <div className="ddc-bench-label">{label.toUpperCase()}</div>
      <div className="ddc-bench-rule" />
    </div>
  );
}

function Row({
  player,
  group,
  index,
  onToggleInjured,
  value,
  redraftRank,
  maxValue,
  benchStartIndex,
  onSetBenchStart,
  onClearBenchStart,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: player.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isBench = typeof benchStartIndex === "number" && index >= benchStartIndex;
  const isBenchStart = typeof benchStartIndex === "number" && benchStartIndex === index;
  const slotLabel = group === "TAXI" ? `TX${index + 1}` : `${group}${index + 1}`;
  const formattedValue =
    value != null && Number.isFinite(Number(value))
      ? Math.round(Number(value)).toLocaleString()
      : "—";
  const redraftLabel = redraftRank?.label || null;
  const redraftLongLabel = redraftRank?.longLabel || null;
  const redraftMobileLabel = redraftLabel ? `RDRFT ${redraftLabel}` : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="ddc-row"
      data-pos={group}
      data-dragging={isDragging ? "true" : "false"}
      data-bench={isBench ? "true" : "false"}
    >
      {/* DRAG HANDLE — listeners only on the button-like span */}
      <div className="ddc-col-grip">
        <span
          {...attributes}
          {...listeners}
          role="button"
          tabIndex={0}
          aria-label="Drag to reorder"
          title="Drag to reorder"
          className="ddc-grip ddc-drag-handle"
        >
          <GripIcon />
        </span>
      </div>

      <div className="ddc-col-slot">
        <span className="ddc-slot" data-pos={group}>
          {slotLabel}
        </span>
      </div>

      <div className="ddc-col-name">
        <div className="ddc-name-wrap">
          <div className={`ddc-name${player.injured ? " injured" : ""}`} title={player.name}>
            {player.name}
          </div>
          <div className="ddc-meta-line">
            {player.age || "—"} · {player.nflTeam || "—"}
            {redraftMobileLabel ? ` · ${redraftMobileLabel}` : ""} · VAL {formattedValue}
          </div>
        </div>
      </div>

      <div className="ddc-col-age">
        <span className="ddc-cell-lbl">Age</span>
        <span className={`ddc-cell-v ${ageClass(player.age)}`}>{player.age || "—"}</span>
      </div>

      <div className="ddc-col-team">
        <span className="ddc-cell-lbl">Team</span>
        <span className="ddc-cell-v">{player.nflTeam || "—"}</span>
      </div>

      <div className="ddc-col-redraft">
        <span className="ddc-cell-lbl">Redraft</span>
        <span className="ddc-cell-v">{redraftLabel || "—"}</span>
      </div>

      <div className="ddc-col-val">
        <span className="ddc-val-num">
          {value != null && Number.isFinite(Number(value))
            ? String(Math.round(Number(value)))
            : "—"}
        </span>
        <ValBar value={value} maxValue={maxValue} />
      </div>

      <div className="ddc-col-inj">
        <button
          className={`ddc-iconbtn ddc-focusable${player.injured ? " injured" : ""}`}
          onClick={() => onToggleInjured?.(player.id)}
          title={player.injured ? "Mark Healthy" : "Mark Injured"}
          aria-label={player.injured ? "Mark Healthy" : "Mark Injured"}
          type="button"
        >
          ✚
        </button>
      </div>

      {(onSetBenchStart || onClearBenchStart) ? (
        <div className="ddc-col-bench">
          <button
            type="button"
            className={`ddc-iconbtn ddc-focusable${isBenchStart ? " bench-on" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isBenchStart) onClearBenchStart?.();
              else onSetBenchStart?.(index);
            }}
            title={isBenchStart ? "Clear Bench Split" : "Bench Starts Here"}
            aria-label={isBenchStart ? "Clear Bench Split" : "Bench Starts Here"}
          >
            <BenchIcon />
          </button>
        </div>
      ) : (
        <div className="ddc-col-bench" />
      )}
    </div>
  );
}

export function PlayerList({
  group,
  players,
  valuesByPlayerId,
  redraftRanksByPlayerId,
  teamValue = null,
  onReorder,
  onToggleInjured,
  benchStartIndex,
  onSetBenchStart,
  onClearBenchStart,
  // eslint-disable-next-line no-unused-vars
  isDark = false,
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = players.findIndex((p) => p.id === active.id);
    const newIndex = players.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(players, oldIndex, newIndex);
    onReorder(next);
  }

  const clampedBenchStart =
    typeof benchStartIndex === "number"
      ? Math.max(0, Math.min(players.length, benchStartIndex))
      : null;

  const maxValue = (() => {
    let m = 0;
    for (const p of players) {
      const v = valuesByPlayerId?.get(p.id);
      const n = Number(v);
      if (Number.isFinite(n) && n > m) m = n;
    }
    return m;
  })();

  const totalValue = (() => {
    let sum = 0;
    let hasAny = false;

    for (const p of players) {
      const v = valuesByPlayerId?.get(p.id);
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      sum += n;
      hasAny = true;
    }

    return hasAny ? sum : null;
  })();

  const valuePct = formatValPct(totalValue, teamValue);

  const showHeader = players.length > 0;

  return (
    <div className="ddc-panel" data-pos={group}>
      <div className="ddc-panel-head">
        <span className="ddc-stamp">{group}</span>
        <span className="ddc-panel-count">
          {players.length} {players.length === 1 ? "PLAYER" : "PLAYERS"} ·
        </span>
        {totalValue != null && (
          <span className="ddc-panel-count">
            VAL {Math.round(totalValue).toLocaleString()}
            {valuePct ? ` · ${valuePct}` : ""}
          </span>
        )}
      </div>

      {showHeader && (
        <div className="ddc-row-head" aria-hidden>
          <div />
          <div>Slot</div>
          <div>Player</div>
          <div className="num">Age</div>
          <div className="num">Team</div>
          <div className="num">Redraft</div>
          <div className="num">Val</div>
          <div>Inj</div>
          <div>Ben</div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={players.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {players.length === 0 ? (
            <div
              style={{
                padding: "14px 16px",
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--ddc-dim-2)",
                fontStyle: "italic",
              }}
            >
              // NO PLAYERS IN THIS GROUP
            </div>
          ) : (
            players.map((p, idx) => (
              <div key={p.id}>
                {typeof clampedBenchStart === "number" &&
                clampedBenchStart === idx &&
                clampedBenchStart > 0 ? (
                  <BenchDivider label="Bench" />
                ) : null}

                <Row
                  player={p}
                  group={group}
                  index={idx}
                  value={valuesByPlayerId?.get(p.id) ?? null}
                  redraftRank={redraftRanksByPlayerId?.get(p.id) ?? null}
                  maxValue={maxValue}
                  onToggleInjured={onToggleInjured}
                  benchStartIndex={clampedBenchStart}
                  onSetBenchStart={onSetBenchStart}
                  onClearBenchStart={onClearBenchStart}
                />
              </div>
            ))
          )}
        </SortableContext>
      </DndContext>
    </div>
  );
}
