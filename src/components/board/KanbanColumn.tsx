import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanCard } from "@/components/board/KanbanCard";

interface KanbanTaskCard {
  id: string;
  title: string;
  priority?: "low" | "medium" | "high" | "urgent";
  dueDate?: string;
  assignee?: string;
}

interface KanbanColumnProps {
  title: string;
  workspaceSlug: string;
  cards: KanbanTaskCard[];
}

export function KanbanColumn({ title, workspaceSlug, cards }: KanbanColumnProps) {
  return (
    <section className="flex min-h-[420px] flex-col rounded-xl border border-border-subtle bg-bg-base p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-content-secondary">{title}</h2>
        <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-xs text-content-muted">{cards.length}</span>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {cards.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border-subtle bg-bg-surface/60 px-4 text-center">
            <p className="text-sm text-content-muted">Brak zadań w kolumnie.</p>
            <Button type="button" variant="secondary" size="sm" className="mt-3 gap-1.5" disabled>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Dodaj zadanie
            </Button>
          </div>
        ) : (
          cards.map((card) => (
            <KanbanCard
              key={card.id}
              blockId={card.id}
              workspaceSlug={workspaceSlug}
              title={card.title}
              priority={card.priority}
              dueDate={card.dueDate}
              assignee={card.assignee}
            />
          ))
        )}
      </div>
    </section>
  );
}

export type { KanbanTaskCard };
