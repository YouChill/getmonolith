import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KanbanCard } from "@/components/board/KanbanCard";
import type { TaskStatus } from "@/lib/db/types";

export interface KanbanTaskCard {
  id: string;
  title: string;
  status: TaskStatus;
  priority?: "low" | "medium" | "high" | "urgent";
  dueDate?: string;
  assignee?: string;
  isOptimistic?: boolean;
}

interface UpdateTaskPayload {
  title?: string;
  status?: TaskStatus;
}

interface KanbanColumnProps {
  title: string;
  status: TaskStatus;
  workspaceSlug: string;
  cards: KanbanTaskCard[];
  isCreating: boolean;
  onCreateTask: (status: TaskStatus, title: string) => Promise<void>;
  onUpdateTask: (taskId: string, payload: UpdateTaskPayload) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
}

export function KanbanColumn({
  title,
  status,
  workspaceSlug,
  cards,
  isCreating,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
}: KanbanColumnProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const handleCreateTask = async () => {
    const trimmedTitle = newTitle.trim();

    if (!trimmedTitle) {
      return;
    }

    await onCreateTask(status, trimmedTitle);
    setNewTitle("");
    setIsAdding(false);
  };

  return (
    <section className="flex min-h-[420px] flex-col rounded-xl border border-border-subtle bg-bg-base p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-content-secondary">{title}</h2>
        <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-xs text-content-muted">{cards.length}</span>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {cards.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border-subtle bg-bg-surface/60 px-4 text-center">
            <p className="text-sm text-content-muted">Brak zadań w kolumnie.</p>
          </div>
        ) : (
          cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              workspaceSlug={workspaceSlug}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
            />
          ))
        )}
      </div>

      <div className="mt-3 border-t border-border-subtle pt-3">
        {isAdding ? (
          <div className="space-y-2">
            <Input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Task title"
              aria-label="Task title"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={handleCreateTask} disabled={isCreating || !newTitle.trim()}>
                <Check className="h-4 w-4" aria-hidden="true" />
                Create
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsAdding(false);
                  setNewTitle("");
                }}
                disabled={isCreating}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="ghost" size="sm" className="w-full justify-start gap-1.5" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            + Add task
          </Button>
        )}
      </div>
    </section>
  );
}
