"use client";

import { useState } from "react";
import { KanbanColumn, type KanbanTaskCard } from "@/components/board/KanbanColumn";
import { TASK_STATUSES, type TaskStatus } from "@/lib/db/types";

interface KanbanBoardProps {
  workspaceSlug: string;
  workspaceId: string;
  projectId: string;
  columns: Record<TaskStatus, KanbanTaskCard[]>;
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

interface BlockApiData {
  id: string;
  properties: {
    title?: string;
    status?: TaskStatus;
    due_date?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    assigned_to?: string;
  };
}

const COLUMN_TITLES: Record<TaskStatus, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
};

function isTaskStatus(value: string): value is TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus);
}

function upsertCard(columns: Record<TaskStatus, KanbanTaskCard[]>, nextCard: KanbanTaskCard): Record<TaskStatus, KanbanTaskCard[]> {
  const nextColumns: Record<TaskStatus, KanbanTaskCard[]> = {
    todo: columns.todo.filter((card) => card.id !== nextCard.id),
    in_progress: columns.in_progress.filter((card) => card.id !== nextCard.id),
    done: columns.done.filter((card) => card.id !== nextCard.id),
  };

  nextColumns[nextCard.status] = [nextCard, ...nextColumns[nextCard.status]];

  return nextColumns;
}

export function KanbanBoard({ workspaceSlug, workspaceId, projectId, columns }: KanbanBoardProps) {
  const [boardColumns, setBoardColumns] = useState(columns);
  const [creatingByStatus, setCreatingByStatus] = useState<Record<TaskStatus, boolean>>({
    todo: false,
    in_progress: false,
    done: false,
  });

  const handleCreateTask = async (status: TaskStatus, title: string) => {
    const optimisticId = `optimistic-${Date.now()}`;

    setCreatingByStatus((previous) => ({ ...previous, [status]: true }));
    setBoardColumns((previous) => upsertCard(previous, { id: optimisticId, title, status, isOptimistic: true }));

    const response = await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, projectId, type: "task", title, status }),
    });

    const result = (await response.json()) as ApiResponse<BlockApiData>;

    if (!response.ok || !result.data) {
      setBoardColumns((previous) => ({
        todo: previous.todo.filter((card) => card.id !== optimisticId),
        in_progress: previous.in_progress.filter((card) => card.id !== optimisticId),
        done: previous.done.filter((card) => card.id !== optimisticId),
      }));
      setCreatingByStatus((previous) => ({ ...previous, [status]: false }));
      return;
    }

    const createdTask = result.data;
    const createdStatus = createdTask.properties.status;
    const normalizedStatus: TaskStatus = createdStatus && isTaskStatus(createdStatus) ? createdStatus : status;

    setBoardColumns((previous) => upsertCard(previous, {
      id: createdTask.id,
      title: createdTask.properties.title?.trim() || title,
      status: normalizedStatus,
      priority: createdTask.properties.priority,
      dueDate: createdTask.properties.due_date,
      assignee: createdTask.properties.assigned_to,
    }));

    setCreatingByStatus((previous) => ({ ...previous, [status]: false }));
  };

  const handleUpdateTask = async (taskId: string, payload: { title?: string; status?: TaskStatus }) => {
    const response = await fetch(`/api/blocks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as ApiResponse<BlockApiData>;

    if (!response.ok || !result.data) {
      return;
    }

    const updatedTask = result.data;
    const updatedStatus = updatedTask.properties.status;
    const nextStatus: TaskStatus = updatedStatus && isTaskStatus(updatedStatus) ? updatedStatus : "todo";

    setBoardColumns((previous) => upsertCard(previous, {
      id: updatedTask.id,
      title: updatedTask.properties.title?.trim() || "Bez tytułu",
      status: nextStatus,
      priority: updatedTask.properties.priority,
      dueDate: updatedTask.properties.due_date,
      assignee: updatedTask.properties.assigned_to,
    }));
  };

  const handleDeleteTask = async (taskId: string) => {
    const snapshot = boardColumns;

    setBoardColumns((previous) => ({
      todo: previous.todo.filter((card) => card.id !== taskId),
      in_progress: previous.in_progress.filter((card) => card.id !== taskId),
      done: previous.done.filter((card) => card.id !== taskId),
    }));

    const response = await fetch(`/api/blocks/${taskId}`, {
      method: "DELETE",
    });

    const result = (await response.json()) as ApiResponse<{ id: string }>;

    if (!response.ok || !result.data) {
      setBoardColumns(snapshot);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {TASK_STATUSES.map((status) => (
        <KanbanColumn
          key={status}
          title={COLUMN_TITLES[status]}
          status={status}
          workspaceSlug={workspaceSlug}
          cards={boardColumns[status]}
          isCreating={creatingByStatus[status]}
          onCreateTask={handleCreateTask}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
        />
      ))}
    </div>
  );
}
