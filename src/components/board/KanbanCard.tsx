import Link from "next/link";
import { CalendarDays, Flag, User } from "lucide-react";

interface KanbanCardProps {
  blockId: string;
  workspaceSlug: string;
  title: string;
  priority?: "low" | "medium" | "high" | "urgent";
  dueDate?: string;
  assignee?: string;
}

const PRIORITY_LABELS: Record<NonNullable<KanbanCardProps["priority"]>, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

function formatDueDate(dueDate?: string): string {
  if (!dueDate) {
    return "Brak terminu";
  }

  const date = new Date(dueDate);

  if (Number.isNaN(date.getTime())) {
    return dueDate;
  }

  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatAssignee(assignee?: string): string {
  if (!assignee) {
    return "Nieprzypisane";
  }

  if (assignee.length <= 10) {
    return assignee;
  }

  return `${assignee.slice(0, 8)}…`;
}

export function KanbanCard({ blockId, workspaceSlug, title, priority, dueDate, assignee }: KanbanCardProps) {
  return (
    <Link
      href={`/${workspaceSlug}/block/${blockId}`}
      className="block rounded-lg border border-border-subtle bg-bg-surface p-3 transition-all duration-150 hover:-translate-y-px hover:border-border-default hover:bg-bg-elevated hover:shadow-md"
    >
      <p className="line-clamp-2 text-sm font-medium text-content-primary">{title}</p>

      <div className="mt-3 space-y-1.5 text-xs text-content-muted">
        <div className="flex items-center gap-1.5">
          <Flag className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{priority ? PRIORITY_LABELS[priority] : "Brak priorytetu"}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{formatDueDate(dueDate)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{formatAssignee(assignee)}</span>
        </div>
      </div>
    </Link>
  );
}
