import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Flag, Pencil, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import type { KanbanTaskCard } from "@/components/board/KanbanColumn";
import type { TaskStatus } from "@/lib/db/types";
import type { WorkspaceMemberOption } from "@/lib/hooks/use-workspace";
import { blockQueryKey } from "@/lib/react-query/query-keys";

interface KanbanCardProps {
  workspaceSlug: string;
  card: KanbanTaskCard;
  onUpdateTask: (taskId: string, payload: { title?: string; status?: TaskStatus; due_date?: string | null; assigned_to?: string | null }) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  assigneeOptions: WorkspaceMemberOption[];
  hideActions?: boolean;
  disableLink?: boolean;
  dragHandle?: ReactNode;
}

const PRIORITY_LABELS: Record<NonNullable<KanbanTaskCard["priority"]>, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

function formatDueDate(dueDate?: string): string {
  if (!dueDate) return "Brak terminu";
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return dueDate;
  return new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function isOverdue(dueDate?: string, status?: TaskStatus): boolean {
  if (!dueDate || status === "done") return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

export function KanbanCard({
  workspaceSlug,
  card,
  onUpdateTask,
  onDeleteTask,
  assigneeOptions,
  hideActions = false,
  disableLink = false,
  dragHandle,
}: KanbanCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [status, setStatus] = useState<TaskStatus>(card.status);
  const [dueDate, setDueDate] = useState(card.dueDate ?? "");
  const [assignee, setAssignee] = useState(card.assignee ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const assigneeMember = useMemo(() => assigneeOptions.find((option) => option.id === card.assignee), [assigneeOptions, card.assignee]);

  const assigneeLabel = assigneeMember?.label ?? card.assignee ?? "Nieprzypisane";
  const assigneeInitials = assigneeMember?.initials ?? "?";

  const prefetchBlock = () => {
    queryClient
      .prefetchQuery({
        queryKey: blockQueryKey(card.id),
        queryFn: async () => {
          const response = await fetch(`/api/blocks/${card.id}`);
          const result = (await response.json()) as { data: unknown; error: string | null };
          if (!response.ok || !result.data) throw new Error(result.error ?? "Nie udało się pobrać bloku.");
          return result.data;
        },
        staleTime: 30_000,
      })
      .catch(() => undefined);
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    setIsSubmitting(true);
    await onUpdateTask(card.id, { title: trimmedTitle, status, due_date: dueDate || null, assigned_to: assignee || null });
    setIsSubmitting(false);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    await onDeleteTask(card.id);
    setIsSubmitting(false);
  };

  const handleDueDateChange = async (nextDueDate: string) => {
    setDueDate(nextDueDate);
    setIsSubmitting(true);
    await onUpdateTask(card.id, { due_date: nextDueDate || null });
    setIsSubmitting(false);
  };

  const cardIsOverdue = isOverdue(card.dueDate, card.status);

  const content = (
    <>
      <div className="flex items-start gap-2">
        <p className="line-clamp-2 flex-1 text-sm font-medium text-content-primary">{card.title}</p>
        {dragHandle ?? null}
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-content-muted">
        <div className="flex items-center gap-1.5">
          <Flag className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{card.priority ? PRIORITY_LABELS[card.priority] : "Brak priorytetu"}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          <span className={cardIsOverdue ? "font-medium text-red-400" : undefined}>{formatDueDate(card.dueDate)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {assigneeMember?.avatarUrl ? (
            <img src={assigneeMember.avatarUrl} alt={assigneeLabel} className="h-5 w-5 rounded-full object-cover" />
          ) : (
            <div className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-bg-elevated text-[10px] font-semibold text-content-secondary">
              {assigneeInitials}
            </div>
          )}
          <User className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{assigneeLabel}</span>
        </div>
      </div>
    </>
  );

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface p-3 transition-all duration-150 hover:-translate-y-px hover:border-border-default hover:bg-bg-elevated hover:shadow-md" data-optimistic={card.isOptimistic ? "true" : "false"}>
      {disableLink ? content : <Link href={`/${workspaceSlug}/block/${card.id}`} className="block" onMouseEnter={prefetchBlock} onFocus={prefetchBlock}>{content}</Link>}

      {!card.isOptimistic && !hideActions ? (
        <>
          {isEditing ? (
            <div className="mt-2 space-y-2 rounded-md border border-border-subtle bg-bg-base p-2">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
              <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)} className="w-full rounded-md border border-border-default bg-bg-base px-2 py-1.5 text-xs text-content-primary outline-none ring-offset-bg-base focus-visible:ring-2 focus-visible:ring-ring">
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
              <DatePicker value={dueDate} onChange={handleDueDateChange} placeholder="Ustaw termin" />
              <select value={assignee} onChange={(event) => setAssignee(event.target.value)} className="w-full rounded-md border border-border-default bg-bg-base px-2 py-1.5 text-xs text-content-primary outline-none ring-offset-bg-base focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Nieprzypisane</option>
                {assigneeOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setIsEditing(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="button" size="sm" onClick={handleSave} disabled={isSubmitting || !title.trim()}>Save</Button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex justify-end gap-1">
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsEditing(true)}>
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">Edit task</span>
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={handleDelete} disabled={isSubmitting}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">Delete task</span>
              </Button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
