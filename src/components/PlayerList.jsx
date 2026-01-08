import { groupTheme } from "../theme";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function Row({ player, group, index }) {
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

    // density (less wide)
    gap: 8,
    padding: "8px 10px",
    marginBottom: 6,

    background: "white",
    border: "1px solid #eee",
    borderLeft: `5px solid ${th.color}`,
    borderRadius: 12,

    // drag polish (keep inline to avoid fighting CSS hover)
    boxShadow: isDragging ? "0 14px 30px rgba(0,0,0,0.12)" : "none",
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
        <div
          style={{
            fontWeight: 800,
            fontSize: 14,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {player.name}
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

export function PlayerList({ group, players, onReorder }) {
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
        {players.map((p, idx) => (
          <Row key={p.id} player={p} group={group} index={idx} />
        ))}
      </SortableContext>
    </DndContext>
  );
}