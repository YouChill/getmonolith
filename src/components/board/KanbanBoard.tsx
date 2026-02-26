import { KanbanColumn, type KanbanTaskCard } from "@/components/board/KanbanColumn";
import type { TaskStatus } from "@/lib/db/types";

interface KanbanBoardProps {
  workspaceSlug: string;
  columns: Record<TaskStatus, KanbanTaskCard[]>;
}

const COLUMN_TITLES: Record<TaskStatus, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
};

const COLUMN_ORDER: TaskStatus[] = ["todo", "in_progress", "done"];

export function KanbanBoard({ workspaceSlug, columns }: KanbanBoardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {COLUMN_ORDER.map((status) => (
        <KanbanColumn key={status} title={COLUMN_TITLES[status]} workspaceSlug={workspaceSlug} cards={columns[status]} />
      ))}
    </div>
  );
}
