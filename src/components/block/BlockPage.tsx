"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BlockNoteEditor } from "@/components/editor/BlockNoteEditor";
import type { BlockNoteContent } from "@/lib/types/blocknote";
import type { TaskStatus } from "@/lib/db/types";
import type { KanbanTaskCard } from "@/components/board/KanbanColumn";
import { blockQueryKey, boardColumnsQueryKey } from "@/lib/react-query/query-keys";
import { useWorkspace } from "@/lib/hooks/use-workspace";

type TaskPriority = "low" | "medium" | "high" | "urgent";

type SaveState = "saved" | "saving";

interface BlockPageTaskData {
  status?: TaskStatus;
  dueDate?: string;
  priority?: TaskPriority;
  assignee?: string;
}

interface BlockPageProps {
  workspaceSlug: string;
  workspaceId: string;
  blockId: string;
  blockType: "task" | "page";
  projectId?: string;
  projectName?: string;
  initialTitle: string;
  initialIcon?: string;
  initialContent: BlockNoteContent;
  taskData?: BlockPageTaskData;
}

interface BlockPatchResult {
  id: string;
  type: "task" | "page";
  position?: number;
  properties?: {
    title?: string;
    icon?: string;
    status?: TaskStatus;
    due_date?: string;
    priority?: TaskPriority;
    assigned_to?: string;
  };
  content?: BlockNoteContent;
}

interface BlockPatchResponse {
  data: BlockPatchResult | null;
  error: string | null;
}

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: "todo", label: "Do zrobienia" },
  { value: "in_progress", label: "W toku" },
  { value: "done", label: "Zrobione" },
];

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: "low", label: "Niski" },
  { value: "medium", label: "Średni" },
  { value: "high", label: "Wysoki" },
  { value: "urgent", label: "Pilny" },
];

const PAGE_ICON_OPTIONS = ["📝", "📄", "📘", "📙", "📕", "📗", "📌", "📎", "💡", "✅", "🚀", "✨", "🔥", "📚", "🧠", "🎯"];

function normalizeTaskStatus(status?: string): TaskStatus {
  if (status === "todo" || status === "in_progress" || status === "done") {
    return status;
  }

  return "todo";
}

function upsertTaskCardInColumns(
  columns: Record<TaskStatus, KanbanTaskCard[]>,
  nextCard: KanbanTaskCard,
): Record<TaskStatus, KanbanTaskCard[]> {
  const previousStatus = (Object.keys(columns) as TaskStatus[]).find((status) =>
    columns[status].some((card) => card.id === nextCard.id)
  );

  if (previousStatus === nextCard.status) {
    return {
      ...columns,
      [nextCard.status]: columns[nextCard.status].map((card) =>
        card.id === nextCard.id ? { ...card, ...nextCard } : card
      ),
    };
  }

  const nextColumns: Record<TaskStatus, KanbanTaskCard[]> = {
    todo: columns.todo.filter((card) => card.id !== nextCard.id),
    in_progress: columns.in_progress.filter((card) => card.id !== nextCard.id),
    done: columns.done.filter((card) => card.id !== nextCard.id),
  };

  nextColumns[nextCard.status] = [nextCard, ...nextColumns[nextCard.status]].map((card, index) => ({
    ...card,
    position: index + 1,
  }));

  return nextColumns;
}

export function BlockPage({
  workspaceSlug,
  workspaceId,
  blockId,
  blockType,
  projectId,
  projectName,
  initialTitle,
  initialIcon,
  initialContent,
  taskData,
}: BlockPageProps) {
  const [title, setTitle] = useState(initialTitle);
  const [icon, setIcon] = useState(initialIcon ?? "📝");
  const [content, setContent] = useState<BlockNoteContent>(initialContent);
  const [status, setStatus] = useState<TaskStatus>(taskData?.status ?? "todo");
  const [dueDate, setDueDate] = useState(taskData?.dueDate ?? "");
  const [priority, setPriority] = useState<TaskPriority | "">(taskData?.priority ?? "");
  const [assignee, setAssignee] = useState(taskData?.assignee ?? "");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: workspaceData } = useWorkspace(workspaceId);

  const initialPayloadRef = useRef("");

  const payload = useMemo(
    () => ({
      title: title.trim() || "Bez tytułu",
      content,
      ...(blockType === "page" ? { icon } : {}),
      ...(blockType === "task"
        ? {
            status,
            due_date: dueDate || null,
            priority: priority || null,
            assigned_to: assignee || null,
          }
        : {}),
    }),
    [assignee, blockType, content, dueDate, icon, priority, status, title],
  );

  const payloadString = JSON.stringify(payload);

  useEffect(() => {
    initialPayloadRef.current = JSON.stringify({
      title: initialTitle.trim() || "Bez tytułu",
      content: initialContent,
      ...(blockType === "page" ? { icon: initialIcon ?? "📝" } : {}),
      ...(blockType === "task"
        ? {
            status: taskData?.status ?? "todo",
            due_date: taskData?.dueDate || null,
            priority: taskData?.priority || null,
            assigned_to: taskData?.assignee || null,
          }
        : {}),
    });
  }, [blockType, initialContent, initialIcon, initialTitle, taskData?.assignee, taskData?.dueDate, taskData?.priority, taskData?.status]);

  // ── Block save mutation ───────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (body: string) => {
      const response = await fetch(`/api/blocks/${blockId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const result = (await response.json()) as BlockPatchResponse;

      if (!response.ok || !result.data) {
        throw new Error(result.error ?? "Nie udało się zapisać zmian.");
      }

      return result.data;
    },
    onSuccess: (updatedBlock, body) => {
      queryClient.setQueryData(blockQueryKey(blockId), updatedBlock);

      if (updatedBlock.type === "task" && projectId) {
        queryClient.setQueryData<Record<TaskStatus, KanbanTaskCard[]> | undefined>(
          boardColumnsQueryKey(workspaceSlug, projectId),
          (previous) => {
            if (!previous) {
              return previous;
            }

            const nextStatus = normalizeTaskStatus(updatedBlock.properties?.status);

            return upsertTaskCardInColumns(previous, {
              id: updatedBlock.id,
              title: updatedBlock.properties?.title?.trim() || "Bez tytułu",
              status: nextStatus,
              position: typeof updatedBlock.position === "number" ? updatedBlock.position : 1,
              priority: updatedBlock.properties?.priority,
              dueDate: updatedBlock.properties?.due_date,
              assignee: updatedBlock.properties?.assigned_to,
            });
          }
        );
      }

      initialPayloadRef.current = body;
      setSaveError(null);
      setSaveState("saved");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Nie udało się zapisać zmian.";
      setSaveError(message);
      setSaveState("saved");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: blockQueryKey(blockId) });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: boardColumnsQueryKey(workspaceSlug, projectId) });
      }
    },
  });

  const triggerSave = useCallback(
    (body: string) => {
      saveMutation.mutate(body);
    },
    // saveMutation is stable per render but we only need mutate fn reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blockId],
  );

  useEffect(() => {
    if (payloadString === initialPayloadRef.current) {
      return;
    }

    setSaveState("saving");

    const timer = setTimeout(() => {
      triggerSave(payloadString);
    }, 1500);

    return () => clearTimeout(timer);
  }, [payloadString, triggerSave]);

  return (
    <div className="mx-auto flex w-full max-w-7xl gap-6 px-8 py-6">
      <section className="min-w-0 flex-1">
        <nav className="mb-4 flex items-center gap-2 text-sm text-content-muted">
          {projectId ? (
            <Link href={`/${workspaceSlug}/board/${projectId}`} className="hover:text-content-primary">
              ← Powrót do tablicy
            </Link>
          ) : (
            <Link href={`/${workspaceSlug}/board`} className="hover:text-content-primary">
              ← Powrót do tablicy
            </Link>
          )}
          {projectName ? (
            <>
              <span>/</span>
              <span>{projectName}</span>
            </>
          ) : null}
          <span>/</span>
          <span className="truncate text-content-primary">{title.trim() || "Bez tytułu"}</span>
        </nav>

        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {blockType === "page" ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" className="h-10 w-10 rounded-lg border border-border-default p-0 text-2xl">
                    <span aria-hidden>{icon}</span>
                    <span className="sr-only">Wybierz ikonę strony</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56">
                  <div className="grid grid-cols-8 gap-1">
                    {PAGE_ICON_OPTIONS.map((option) => (
                      <Button
                        key={option}
                        type="button"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-lg"
                        onClick={() => setIcon(option)}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}

            <h1 className="min-w-0 flex-1">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-auto border-none bg-transparent px-0 text-3xl font-semibold text-content-primary shadow-none focus-visible:ring-0"
                placeholder="Bez tytułu"
              />
            </h1>
          </div>

          <span className="text-sm text-content-muted">{saveState === "saving" ? "Saving..." : "Saved"}</span>
        </div>

        {saveError ? <p className="mb-3 text-sm text-red-400">{saveError}</p> : null}

        <BlockNoteEditor initialContent={initialContent} onChange={setContent} />
      </section>

      {blockType === "task" ? (
        <aside className="w-full max-w-xs rounded-xl border border-border-default bg-bg-surface p-4">
          <h2 className="mb-4 text-sm font-semibold text-content-secondary">Szczegóły zadania</h2>

          <label className="mb-3 block text-xs text-content-muted">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as TaskStatus)}
              className="mt-1 h-9 w-full rounded-md border border-border-default bg-bg-base px-3 text-sm text-content-primary"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="mb-3 block text-xs text-content-muted">
            Termin
            <DatePicker value={dueDate} onChange={setDueDate} className="mt-1" />
          </label>

          <label className="mb-3 block text-xs text-content-muted">
            Priorytet
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as TaskPriority | "")}
              className="mt-1 h-9 w-full rounded-md border border-border-default bg-bg-base px-3 text-sm text-content-primary"
            >
              <option value="">Brak</option>
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-content-muted">
            Przypisane do
            <select
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-border-default bg-bg-base px-3 text-sm text-content-primary"
            >
              <option value="">Nieprzypisane</option>
              {(workspaceData?.members ?? []).map((member) => (
                <option key={member.id} value={member.id}>
                  {member.label}
                </option>
              ))}
            </select>
          </label>
        </aside>
      ) : null}
    </div>
  );
}
