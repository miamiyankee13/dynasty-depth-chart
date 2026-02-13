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
import { groupTheme } from "../theme";

function BenchDivider({ label = "Bench" }) {
  return (
    <div
      aria-label="Bench Divider"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        margin: "10px 2px 12px",
        opacity: 0.75,
        userSelect: "none",
      }}
      className="ddc-bench-divider"
    >
      <div style={{ height: 1, flex: 1, background: "var(--ddc-border)" }} />
      <div
        style={{
          fontSize: "var(--ddc-text-xs)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ddc-muted)",
          fontWeight: "var(--ddc-weight-medium)",
        }}
      >
        {label}
      </div>
      <div style={{ height: 1, flex: 1, background: "var(--ddc-border)" }} />
    </div>
  );
}

function Row({ 
  player,
  group,
  index,
  onToggleInjured,
  value,
  benchStartIndex,
  onSetBenchStart,
  onClearBenchStart,
  isDark = false, 
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: player.id,
  });

  const base = groupTheme[group] ?? { color: "#e5e7eb", bg: "#f3f4f6" };
  const th = isDark && base.bgDark ? { ...base, bg: base.bgDark } : base;
  const qbAccent =
  group === "QB" && isDark
    ? `color-mix(in oklab, ${th.color} 78%, var(--ddc-text))`
    : th.color;

  const slotLabel = group === "TAXI" ? `TX${index + 1}` : `${group}${index + 1}`;

  // RowShell: final density + polish (hover handled by CSS via .ddc-row)
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 10px",
    paddingRight: 6,
    marginBottom: 6,
    borderLeft: `5px solid ${qbAccent}`,
    transformOrigin: "center",
    willChange: "transform",
    color: "var(--ddc-text)",
    position: "relative",
  };

  const colMuted = {
    fontSize: "var(--ddc-text-xs)",
    color: "var(--ddc-muted)",
    fontWeight: "var(--ddc-weight-medium)",
    letterSpacing: "0.02em",
    textTransform: "uppercase",
  };

  const colValue = {
    fontSize: "var(--ddc-text-md)",
    fontWeight: "var(--ddc-weight-medium)",
    color: "var(--ddc-text)",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="ddc-row"
      data-dragging={isDragging ? "true" : "false"}
      data-bench={
        typeof benchStartIndex === "number" && index >= benchStartIndex
          ? "true"
          : "false"
      }
    >
      {/* Drag handle */}
      <span
        {...attributes}
        {...listeners}
        title="Drag to Reorder"
        className="ddc-drag-handle"
        style={{
          cursor: isDragging ? "grabbing" : "grab",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          touchAction: "none",
          WebkitTapHighlightColor: "transparent",
          fontSize: 20,
          lineHeight: 1,
          padding: "0",
          width: 40,
          height: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: isDragging ? 1 : 0.55,
          transition: "opacity 120ms ease",
          color: "var(--ddc-text)",
        }}
      >
        ☰
      </span>

      {/* Slot pill */}
      <div
        className="ddc-col-slot"
        style={{
          textAlign: "center",
          fontSize: "var(--ddc-text-xs)",
          fontWeight: "var(--ddc-weight-bold)",
          padding: "5px 6px",
          borderRadius: 999,
          background: th.bg ?? "#f3f4f6",
          color: qbAccent,
          border: `1px solid color-mix(in oklab, ${qbAccent} 55%, transparent)`,
          userSelect: "none",
          letterSpacing: "0.02em",
          lineHeight: 1,
        }}
      >
        {slotLabel}
      </div>

      {/* Name (flex) */}
      <div className="ddc-col-name" style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div
            style={{
              fontSize: "var(--ddc-text-md)",
              fontWeight: "var(--ddc-weight-bold)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontStyle: player.injured ? "italic" : "normal",
              color: player.injured ? "var(--ddc-danger)" : "var(--ddc-text)",
            }}
            title={player.name}
          >
            {player.name}
          </div>

          <div className="ddc-meta">
            {player.nflTeam || "—"} • {player.age || "—"}
          </div>

          <button
            className="ddc-injury-btn"
            data-injured={player.injured ? "true" : "false"}
            onClick={() => onToggleInjured?.(player.id)}
            title={player.injured ? "Mark healthy" : "Mark injured"}
            style={{
              background: "transparent",
              color: player.injured ? "var(--ddc-danger)" : "var(--ddc-muted)",
              border: "none",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: "var(--ddc-text-md)",
              lineHeight: 1,
              opacity: player.injured ? 1 : 0.6,
              outline: "none",
              boxShadow: "none",
              // KEY: make the button a consistent flex box (fixes vertical alignment)
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              // Desktop visual size (mobile will override to 44x44 in CSS)
              width: 28,
              height: 28,
              padding: 0,
              flex: "0 0 auto",
            }}
          >
            <span className="ddc-injury-icon" aria-hidden="true">
              ✚
            </span>
          </button>
        </div>
      </div>

      {/* Age */}
      <div className="ddc-col-age" style={{ width: 60, textAlign: "right" }}>
        <div style={colMuted}>Age</div>
        <div style={colValue}>{player.age || "—"}</div>
      </div>

      {/* NFL Team */}
      <div className="ddc-col-team" style={{ width: 76, textAlign: "right" }}>
        <div style={colMuted}>Team</div>
        <div style={colValue}>{player.nflTeam || "—"}</div>
      </div>

      {/* Value (FantasyCalc scaled) */}
      <div className="ddc-col-val" style={{ width: 58, textAlign: "right" }}>
        <div style={colMuted}>Val</div>
        <div style={colValue}>{value ?? "—"}</div>
      </div>

      {/* Bench split action column (only render when enabled) */}
      {(onSetBenchStart || onClearBenchStart) && (
        <div
          className="ddc-col-benchaction"
          style={{
            width: 74,                 // wide enough for "Bench"/"Clear"
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            flex: "0 0 auto",
          }}
        >
          {typeof benchStartIndex === "number" && benchStartIndex === index ? (
            <button
              type="button"
              className="ddc-bench-btn"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClearBenchStart?.();
              }}
              title="Clear Starters/Bench Split"
              aria-label="Clear Starters/Bench Split"
              style={{
                background: "transparent",
                border: "1px solid var(--ddc-border)",
                color: "var(--ddc-muted)",
                borderRadius: 10,
                padding: "4px 8px",
                fontSize: "var(--ddc-text-md)",
                cursor: "pointer",
                opacity: 0, // shown on hover via CSS
                transition: "opacity 120ms ease",
                outline: "none",
                whiteSpace: "nowrap",
              }}
            >
              Clear
            </button>
          ) : (
            <button
              type="button"
              className="ddc-bench-btn"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSetBenchStart?.(index);
              }}
              title="Bench Starts Here"
              aria-label="Bench Starts Here"
              style={{
                background: "transparent",
                border: "1px solid var(--ddc-border)",
                color: "var(--ddc-muted)",
                borderRadius: 10,
                padding: "4px 8px",
                fontSize: "var(--ddc-text-md)",
                cursor: "pointer",
                opacity: 0, // shown on hover via CSS
                transition: "opacity 120ms ease",
                outline: "none",
                whiteSpace: "nowrap",
              }}
            >
              Bench
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function PlayerList({ 
  group, 
  players,
  valuesByPlayerId, 
  onReorder, 
  onToggleInjured,
  benchStartIndex,
  onSetBenchStart,
  onClearBenchStart,
  isDark = false,
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    })
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = players.findIndex((p) => p.id === active.id);
    const newIndex = players.findIndex((p) => p.id === over.id);
    const next = arrayMove(players, oldIndex, newIndex);
    onReorder(next);
  }
  
  const clampedBenchStart =
  typeof benchStartIndex === "number"
    ? Math.max(0, Math.min(players.length, benchStartIndex))
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={players.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        {players.length === 0 ? (
        <div
          style={{
            padding: "14px 10px",
            fontSize: 13,
            opacity: 0.7,
            fontStyle: "italic"
          }}
        >
          No players in this group.
        </div>
      ) : (
        players.map((p, idx) => (
          <div key={p.id}>
            {typeof clampedBenchStart === "number" && clampedBenchStart === idx ? (
              <BenchDivider label="Bench" />
            ) : null}

            <Row
              player={p}
              group={group}
              index={idx}
              value={valuesByPlayerId?.get(p.id) ?? null}
              onToggleInjured={onToggleInjured}
              benchStartIndex={clampedBenchStart}
              onSetBenchStart={onSetBenchStart}
              onClearBenchStart={onClearBenchStart}
              isDark={isDark}
            />
          </div>
        ))
      )}
      </SortableContext>
    </DndContext>
  );
}
