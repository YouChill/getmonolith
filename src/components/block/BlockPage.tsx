"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { BlockNoteEditor } from "@/components/editor/BlockNoteEditor";
import type { BlockNoteContent } from "@/lib/types/blocknote";
import type { TaskStatus } from "@/lib/db/types";
import type { KanbanTaskCard } from "@/components/board/KanbanColumn";
import { blockQueryKey, boardColumnsQueryKey } from "@/lib/react-query/query-keys";

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
  blockId: string;
  blockType: "task" | "page";
  projectId?: string;
  projectName?: string;
  initialTitle: string;
  initialContent: BlockNoteContent;
  taskData?: BlockPageTaskData;
  assignees: Array<{ id: string; email: string }>;
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
  blockId,
  blockType,
  projectId,
  projectName,
  initialTitle,
  initialContent,
  taskData,
  assignees,
}: BlockPageProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState<BlockNoteContent>(initialContent);
  const [status, setStatus] = useState<TaskStatus>(taskData?.status ?? "todo");
  const [dueDate, setDueDate] = useState(taskData?.dueDate ?? "");
  const [priority, setPriority] = useState<TaskPriority | "">(taskData?.priority ?? "");
  const [assignee, setAssignee] = useState(taskData?.assignee ?? "");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const queryClient = useQueryClient();

  const initialPayloadRef = useRef("");

  const payload = useMemo(
    () => ({
      title: title.trim() || "Bez tytułu",
      content,
      ...(blockType === "task"
        ? {
            status,
            due_date: dueDate || null,
            priority: priority || null,
            assigned_to: assignee || null,
          }
        : {}),
    }),
    [assignee, blockType, content, dueDate, priority, status, title],
  );

  const payloadString = JSON.stringify(payload);

  useEffect(() => {
    initialPayloadRef.current = JSON.stringify({
      title: initialTitle.trim() || "Bez tytułu",
      content: initialContent,
      ...(blockType === "task"
        ? {
            status: taskData?.status ?? "todo",
            due_date: taskData?.dueDate || null,
            priority: taskData?.priority || null,
            assigned_to: taskData?.assignee || null,
          }
        : {}),
    });
  }, [blockType, initialContent, initialTitle, taskData?.assignee, taskData?.dueDate, taskData?.priority, taskData?.status]);

  useEffect(() => {
    if (payloadString === initialPayloadRef.current) {
      return;
    }

    setSaveState("saving");

    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const response = await fetch(`/api/blocks/${blockId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: payloadString,
          });

          const result = (await response.json()) as {
            data: {
              id: string;
              type: "task" | "page";
              position?: number;
              properties?: {
                title?: string;
                status?: TaskStatus;
                due_date?: string;
                priority?: TaskPriority;
                assigned_to?: string;
              };
              content?: BlockNoteContent;
            } | null;
            error: string | null;
          };

          if (!response.ok || !result.data) {
            throw new Error(result.error ?? "Nie udało się zapisać zmian.");
          }

          const updatedBlock = result.data;

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

          initialPayloadRef.current = payloadString;
          setSaveError(null);
          setSaveState("saved");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Nie udało się zapisać zmian.";
          setSaveError(message);
          setSaveState("saved");
        }
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [blockId, payloadString, projectId, queryClient, startTransition, workspaceSlug]);

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
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="h-auto border-none bg-transparent px-0 text-3xl font-semibold text-content-primary shadow-none focus-visible:ring-0"
            placeholder="Bez tytułu"
          />

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
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1" />
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
            Assignee
            <select
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-border-default bg-bg-base px-3 text-sm text-content-primary"
            >
              <option value="">Nieprzypisane</option>
              {assignees.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.email}
                </option>
              ))}
            </select>
          </label>
        </aside>
      ) : null}
    </div>
  );
}
