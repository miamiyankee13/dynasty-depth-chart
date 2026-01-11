import { groupTheme } from "../theme";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function Row({ player, group, index, onToggleInjured }) {
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
  };

  const colMuted = {
    fontSize: 11,
    opacity: 0.65,
    fontWeight: 700,
    letterSpacing: 0.2,
  };
  const colValue = {
    fontSize: 14,
    fontWeight: 800,
    color: "#111827",
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
        style={{
          cursor: isDragging ? "grabbing" : "grab",
          userSelect: "none",
          fontSize: 18,
          padding: "0 4px",
          width: 20,
          textAlign: "center",
          opacity: isDragging ? 1 : 0.55,
          transition: "opacity 120ms ease",
        }}
      >
        ☰
      </span>

      {/* Slot pill */}
      <div
        style={{
          width: 60,
          textAlign: "center",
          fontSize: 11,
          fontWeight: 900,
          padding: "5px 6px",
          borderRadius: 999,
          background: th.bg ?? "#f3f4f6",
          color: th.color,
          border: `1px solid ${th.color}`,
          userSelect: "none",
          lineHeight: "14px",
        }}
      >
        {slotLabel}
      </div>

      {/* Name (flex) */}
<div style={{ flex: 1, minWidth: 0 }}>
  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
    <div
      style={{
        fontWeight: 800,
        fontSize: 14,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        fontStyle: player.injured ? "italic" : "normal",
        color: player.injured ? "#dc2626" : "#111827",
      }}
      title={player.name}
    >
      {player.name}
    </div>

    <button
      onClick={() => onToggleInjured?.(player.id)}
      title={player.injured ? "Mark healthy" : "Mark injured"}
      style={{
        background: "transparent",
        color: player.injured ? "#dc2626" : "#9ca3af",
        border: player.injured ? "1px solid #dc2626" : "none",
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
      <div style={{ width: 60, textAlign: "right" }}>
        <div style={colMuted}>Age</div>
        <div style={colValue}>{player.age || "—"}</div>
      </div>

      {/* NFL Team */}
      <div style={{ width: 76, textAlign: "right" }}>
        <div style={colMuted}>Team</div>
        <div style={colValue}>{player.nflTeam || "—"}</div>
      </div>
      
    </div>
  );
}

export function PlayerList({ group, players, onReorder, onToggleInjured }) {
  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = players.findIndex((p) => p.id === active.id);
    const newIndex = players.findIndex((p) => p.id === over.id);
    const next = arrayMove(players, oldIndex, newIndex);
    onReorder(next);
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
            onToggleInjured={onToggleInjured}
          />
        ))
      )}
      </SortableContext>
    </DndContext>
  );
}