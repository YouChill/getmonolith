"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { BlockNoteEditor } from "@/components/editor/BlockNoteEditor";
import type { BlockNoteContent } from "@/lib/types/blocknote";
import type { TaskStatus } from "@/lib/db/types";

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

export function BlockPage({
  workspaceSlug,
  blockId,
  blockType,
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

          if (!response.ok) {
            throw new Error("Nie udało się zapisać zmian.");
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
  }, [blockId, payloadString, startTransition]);

  return (
    <div className="mx-auto flex w-full max-w-7xl gap-6 px-8 py-6">
      <section className="min-w-0 flex-1">
        <nav className="mb-4 flex items-center gap-2 text-sm text-content-muted">
          <Link href={`/${workspaceSlug}/board`} className="hover:text-content-primary">
            Projekty
          </Link>
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
