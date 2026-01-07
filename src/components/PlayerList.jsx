import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function Row({ player }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: player.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 12,
    border: "1px solid #eee",
    borderRadius: 14,
    marginBottom: 10,
    background: "white",
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

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{player.name}</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {player.nflTeam || "—"} {player.age ? `• Age ${player.age}` : ""}
        </div>
      </div>
    </div>
  );
}

export function PlayerList({ players, onReorder }) {
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
        {players.map((p) => (
          <Row key={p.id} player={p} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
