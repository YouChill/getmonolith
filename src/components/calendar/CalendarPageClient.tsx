"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { calendarEventsQueryKey } from "@/lib/react-query/query-keys";

export interface CalendarTaskEvent {
  id: string;
  title: string;
  dueDate: string;
  priority?: "low" | "medium" | "high" | "urgent";
  status?: "todo" | "in_progress" | "done";
  isOptimistic?: boolean;
}

export interface CalendarWorkspaceProject {
  id: string;
  name: string;
}

interface CalendarPageClientProps {
  workspaceSlug: string;
  workspaceId: string;
  workspaceName: string;
  activeMonth: string;
  events: CalendarTaskEvent[];
  projects: CalendarWorkspaceProject[];
}

interface CalendarDayCell {
  isoDate: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

interface BlockApiData {
  id: string;
  position?: number;
  properties: {
    title?: string;
    status?: "todo" | "in_progress" | "done";
    due_date?: string;
    priority?: "low" | "medium" | "high" | "urgent";
  };
}

interface CreateCalendarTaskVars {
  workspaceId: string;
  projectId: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  dueDate: string;
  priority: "low" | "medium" | "high" | "urgent";
  optimisticId: string;
}

const WEEKDAY_LABELS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Ndz"];

const PRIORITY_BADGES: Record<NonNullable<CalendarTaskEvent["priority"]>, string> = {
  low: "bg-emerald-500/20 text-emerald-300",
  medium: "bg-sky-500/20 text-sky-300",
  high: "bg-amber-500/20 text-amber-300",
  urgent: "bg-rose-500/20 text-rose-300",
};

const STATUS_BADGES: Record<NonNullable<CalendarTaskEvent["status"]>, string> = {
  todo: "bg-slate-500/20 text-slate-300",
  in_progress: "bg-indigo-500/20 text-indigo-300",
  done: "bg-emerald-500/20 text-emerald-300",
};

function parseMonthKey(monthKey: string): Date {
  const [yearString, monthString] = monthKey.split("-");
  const year = Number(yearString);
  const monthIndex = Number(monthString) - 1;

  return new Date(Date.UTC(year, monthIndex, 1));
}

function formatMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(monthKey: string, delta: number): string {
  const monthDate = parseMonthKey(monthKey);
  return formatMonthKey(new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + delta, 1)));
}

function buildMonthGrid(monthKey: string): CalendarDayCell[] {
  const monthDate = parseMonthKey(monthKey);
  const firstDay = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 1));
  const jsDay = firstDay.getUTCDay();
  const mondayOffset = (jsDay + 6) % 7;
  const gridStart = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 1 - mondayOffset));

  const lastDay = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0));
  const trailingCount = (7 - (((lastDay.getUTCDay() + 6) % 7) + 1)) % 7;
  const totalDays = mondayOffset + lastDay.getUTCDate() + trailingCount;
  const cellCount = totalDays > 35 ? 42 : 35;

  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(Date.UTC(gridStart.getUTCFullYear(), gridStart.getUTCMonth(), gridStart.getUTCDate() + index));
    const isoDate = date.toISOString().slice(0, 10);

    return {
      isoDate,
      dayOfMonth: date.getUTCDate(),
      isCurrentMonth: date.getUTCMonth() === monthDate.getUTCMonth(),
    };
  });
}

function CalendarEvent({ workspaceSlug, event }: { workspaceSlug: string; event: CalendarTaskEvent }) {
  const accentClass = event.priority ? PRIORITY_BADGES[event.priority] : event.status ? STATUS_BADGES[event.status] : "bg-bg-elevated text-content-secondary";

  return (
    <Link
      href={`/${workspaceSlug}/block/${event.id}`}
      className={cn(
        "block truncate rounded-md px-2 py-1 text-xs transition hover:brightness-110",
        accentClass,
        event.isOptimistic && "opacity-60"
      )}
      title={event.title}
      onClick={(eventClick) => {
        if (event.isOptimistic) {
          eventClick.preventDefault();
        } else {
          eventClick.stopPropagation();
        }
      }}
    >
      {event.title}
    </Link>
  );
}

function CreateTaskModal({
  projects,
  dueDate,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  projects: CalendarWorkspaceProject[];
  dueDate: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; projectId: string; status: "todo" | "in_progress" | "done"; priority: "low" | "medium" | "high" | "urgent" }) => void;
}) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"todo" | "in_progress" | "done">("todo");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      setError("Tytuł zadania jest wymagany.");
      return;
    }

    if (!projectId) {
      setError("Wybierz projekt dla zadania.");
      return;
    }

    setError(null);
    onSubmit({ title: title.trim(), projectId, status, priority });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg border border-border-subtle bg-bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-content-primary">Nowe zadanie ({dueDate})</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-content-muted transition hover:bg-bg-elevated hover:text-content-primary"
            aria-label="Zamknij modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="calendar-task-title">Tytuł</Label>
            <Input
              id="calendar-task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Np. Przygotuj demo"
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="calendar-task-project">Projekt</Label>
            <select
              id="calendar-task-project"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="h-9 w-full rounded-md border border-border-subtle bg-bg-subtle px-3 text-sm text-content-primary"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="calendar-task-status">Status</Label>
              <select
                id="calendar-task-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as "todo" | "in_progress" | "done")}
                className="h-9 w-full rounded-md border border-border-subtle bg-bg-subtle px-3 text-sm text-content-primary"
              >
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendar-task-priority">Priorytet</Label>
              <select
                id="calendar-task-priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value as "low" | "medium" | "high" | "urgent")}
                className="h-9 w-full rounded-md border border-border-subtle bg-bg-subtle px-3 text-sm text-content-primary"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isSubmitting || !projects.length}>
              {isSubmitting ? "Tworzenie..." : "Utwórz zadanie"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CalendarPageClient({ workspaceSlug, workspaceId, workspaceName, activeMonth, events, projects }: CalendarPageClientProps) {
  const queryClient = useQueryClient();
  const eventsQueryKey = calendarEventsQueryKey(workspaceSlug, activeMonth);
  const [calendarEvents, setCalendarEvents] = useState(() => {
    const cached = queryClient.getQueryData<CalendarTaskEvent[]>(eventsQueryKey);

    if (cached) {
      return cached;
    }

    queryClient.setQueryData(eventsQueryKey, events);
    return events;
  });

  const updateEvents = (updater: CalendarTaskEvent[] | ((previous: CalendarTaskEvent[]) => CalendarTaskEvent[])) => {
    setCalendarEvents((previous) => {
      const next = typeof updater === "function" ? updater(previous) : updater;
      queryClient.setQueryData(eventsQueryKey, next);
      return next;
    });
  };

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // ── Create task mutation ──────────────────────────────────────────────
  const createTaskMutation = useMutation({
    mutationFn: async (vars: CreateCalendarTaskVars) => {
      const response = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: vars.workspaceId,
          projectId: vars.projectId,
          type: "task",
          title: vars.title,
          status: vars.status,
          dueDate: vars.dueDate,
          priority: vars.priority,
        }),
      });

      const result = (await response.json()) as ApiResponse<BlockApiData>;

      if (!response.ok || !result.data) {
        throw new Error(result.error ?? "Nie udało się utworzyć zadania.");
      }

      return result.data;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: eventsQueryKey });
      const previous = queryClient.getQueryData<CalendarTaskEvent[]>(eventsQueryKey);

      const optimisticEvent: CalendarTaskEvent = {
        id: vars.optimisticId,
        title: vars.title,
        dueDate: vars.dueDate,
        priority: vars.priority,
        status: vars.status,
        isOptimistic: true,
      };

      updateEvents((prev) => [...prev, optimisticEvent]);

      return { previous, optimisticId: vars.optimisticId };
    },
    onSuccess: (data, vars, ctx) => {
      const createdEvent: CalendarTaskEvent = {
        id: data.id,
        title: data.properties.title?.trim() || vars.title,
        dueDate: data.properties.due_date ?? vars.dueDate,
        priority: data.properties.priority,
        status: data.properties.status,
      };

      updateEvents((prev) =>
        prev.map((event) => (event.id === ctx.optimisticId ? createdEvent : event))
      );
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        updateEvents(ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: eventsQueryKey });
    },
  });

  const handleCreateTask = (data: { title: string; projectId: string; status: "todo" | "in_progress" | "done"; priority: "low" | "medium" | "high" | "urgent" }) => {
    if (!selectedDate) {
      return;
    }

    const optimisticId = `optimistic-${Date.now()}`;

    createTaskMutation.mutate({
      workspaceId,
      projectId: data.projectId,
      title: data.title,
      status: data.status,
      dueDate: selectedDate,
      priority: data.priority,
      optimisticId,
    });

    setSelectedDate(null);
  };

  const monthDate = parseMonthKey(activeMonth);
  const monthLabel = new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric", timeZone: "UTC" }).format(monthDate);
  const days = useMemo(() => buildMonthGrid(activeMonth), [activeMonth]);
  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarTaskEvent[]>();

    for (const event of calendarEvents) {
      const list = grouped.get(event.dueDate) ?? [];
      list.push(event);
      grouped.set(event.dueDate, list);
    }

    return grouped;
  }, [calendarEvents]);

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-content-primary">Kalendarz — {workspaceName}</h1>
          <p className="text-sm text-content-muted">Miesięczny widok zadań z due date.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/${workspaceSlug}/calendar?month=${shiftMonth(activeMonth, -1)}`} aria-label="Poprzedni miesiąc">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <span className="min-w-44 text-center text-sm font-medium capitalize text-content-primary">{monthLabel}</span>
          <Button variant="outline" asChild>
            <Link href={`/${workspaceSlug}/calendar?month=${shiftMonth(activeMonth, 1)}`} aria-label="Następny miesiąc">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-surface">
        <div className="grid grid-cols-7 border-b border-border-subtle bg-bg-subtle">
          {WEEKDAY_LABELS.map((weekday) => (
            <div key={weekday} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-content-muted">
              {weekday}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => (
            <div
              key={day.isoDate}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedDate(day.isoDate)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedDate(day.isoDate);
                }
              }}
              className={cn(
                "min-h-32 border-b border-r border-border-subtle p-2 text-left align-top transition hover:bg-bg-elevated",
                !day.isCurrentMonth && "bg-bg-subtle/40 text-content-muted"
              )}
            >
              <div className="mb-2 text-sm font-medium">{day.dayOfMonth}</div>
              <div className="space-y-1">
                {(eventsByDay.get(day.isoDate) ?? []).slice(0, 3).map((event) => (
                  <CalendarEvent key={event.id} workspaceSlug={workspaceSlug} event={event} />
                ))}
                {(eventsByDay.get(day.isoDate)?.length ?? 0) > 3 && (
                  <p className="px-1 text-xs text-content-muted">+{(eventsByDay.get(day.isoDate)?.length ?? 0) - 3} więcej</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedDate && (
        <CreateTaskModal
          dueDate={selectedDate}
          projects={projects}
          isSubmitting={createTaskMutation.isPending}
          onClose={() => setSelectedDate(null)}
          onSubmit={handleCreateTask}
        />
      )}
    </>
  );
}
