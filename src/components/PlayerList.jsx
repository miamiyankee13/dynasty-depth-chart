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

function Row({ player, group, index, onToggleInjured, value }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: player.id,
  });

  const th = groupTheme[group] ?? { color: "#e5e7eb", bg: "#f3f4f6" };
  const slotLabel = group === "TAXI" ? `TX${index + 1}` : `${group}${index + 1}`;

  // RowShell: final density + polish (hover handled by CSS via .ddc-row)
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    marginBottom: 6,
    borderLeft: `5px solid ${th.color}`,
    transformOrigin: "center",
    willChange: "transform",
    color: "var(--ddc-text)",
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
    fontWeight: "var(--ddc-weight-bold)",
    color: "var(--ddc-text)",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="ddc-row"
      data-dragging={isDragging ? "true" : "false"}
    >
      {/* Drag handle */}
      <span
        {...attributes}
        {...listeners}
        title="Drag to reorder"
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
          width: 60,
          textAlign: "center",
          fontSize: "var(--ddc-text-xs)",
          fontWeight: "var(--ddc-weight-bold)",
          padding: "5px 6px",
          borderRadius: 999,
          background: th.bg ?? "#f3f4f6",
          color: th.color,
          border: `1px solid ${th.color}`,
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
            onClick={() => onToggleInjured?.(player.id)}
            title={player.injured ? "Mark healthy" : "Mark injured"}
            style={{
              background: "transparent",
              color: player.injured ? "var(--ddc-danger)" : "var(--ddc-muted)",
              border: player.injured ? "1px solid var(--ddc-danger)" : "none",
              borderRadius: 8,
              padding: "2px 6px",
              cursor: "pointer",
              fontWeight: 900,
              fontSize: 12,
              lineHeight: 1,
              opacity: player.injured ? 1 : 0.6,
              outline: "none",
              boxShadow: "none",
              flex: "0 0 auto",
            }}
          >
            ✚
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

    </div>
  );
}

export function PlayerList({ group, players, valuesByPlayerId, onReorder, onToggleInjured }) {
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
          <Row
            key={p.id}
            player={p}
            group={group}
            index={idx}
            value={valuesByPlayerId?.get(p.id) ?? null}
            onToggleInjured={onToggleInjured}
          />
        ))
      )}
      </SortableContext>
    </DndContext>
  );
}
