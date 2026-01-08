import { groupTheme } from "../theme";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function Row({ player, group, index }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: player.id });
  
  const th = groupTheme[group] ?? { color: "#e5e7eb" };
  const slotLabel = group === "TAXI" ? `TX${index + 1}` : `${group}${index + 1}`;
  const style = {
  transform: CSS.Transform.toString(transform),
  transition,
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: 12,
  marginBottom: 10,
  background: "white",
  border: "1px solid #eee",
  borderLeft: `6px solid ${th.color}`,
  borderRadius: 14,
};

  return (
    <div ref={setNodeRef} style={style}>
      <span
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        style={{ cursor: "grab", userSelect: "none", fontSize: 18, padding: "0 6px" }}
      >
        ☰
      </span>
      <div
        style={{
          minWidth: 58,
          textAlign: "center",
          fontSize: 12,
          fontWeight: 800,
          padding: "6px 8px",
          borderRadius: 999,
          background: th.bg ?? "#f3f4f6",
          color: th.color,
          border: `1px solid ${th.color}`,
          userSelect: "none",
        }}
      >
        {slotLabel}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{player.name}</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {player.nflTeam || "—"} {player.age ? `• Age ${player.age}` : ""}
        </div>
      </div>
    </div>
  );
}

export function PlayerList({group, players, onReorder }) {
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
