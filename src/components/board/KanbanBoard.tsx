"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useMemo, useState } from "react";
import { KanbanCard } from "@/components/board/KanbanCard";
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
  position?: number;
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

function upsertCard(
  columns: Record<TaskStatus, KanbanTaskCard[]>,
  nextCard: KanbanTaskCard,
  options?: { removeIds?: string[] }
): Record<TaskStatus, KanbanTaskCard[]> {
  const idsToRemove = new Set([nextCard.id, ...(options?.removeIds ?? [])]);

  const nextColumns: Record<TaskStatus, KanbanTaskCard[]> = {
    todo: columns.todo.filter((card) => !idsToRemove.has(card.id)),
    in_progress: columns.in_progress.filter((card) => !idsToRemove.has(card.id)),
    done: columns.done.filter((card) => !idsToRemove.has(card.id)),
  };

  nextColumns[nextCard.status] = [nextCard, ...nextColumns[nextCard.status]].map((card, index) => ({
    ...card,
    position: index + 1,
  }));

  return nextColumns;
}

function findTaskStatusById(columns: Record<TaskStatus, KanbanTaskCard[]>, id: string): TaskStatus | null {
  for (const status of TASK_STATUSES) {
    if (columns[status].some((card) => card.id === id)) {
      return status;
    }
  }

  return null;
}

function normalizeColumnPositions(cards: KanbanTaskCard[]) {
  return cards.map((card, index) => ({ ...card, position: index + 1 }));
}

function moveTask(
  columns: Record<TaskStatus, KanbanTaskCard[]>,
  taskId: string,
  overId: string,
): { nextColumns: Record<TaskStatus, KanbanTaskCard[]>; movedTask: KanbanTaskCard | null } {
  const fromStatus = findTaskStatusById(columns, taskId);

  if (!fromStatus) {
    return { nextColumns: columns, movedTask: null };
  }

  const toStatus = overId.startsWith("column:") ? (overId.replace("column:", "") as TaskStatus) : findTaskStatusById(columns, overId);

  if (!toStatus || !isTaskStatus(toStatus)) {
    return { nextColumns: columns, movedTask: null };
  }

  const sourceCards = [...columns[fromStatus]];
  const sourceIndex = sourceCards.findIndex((card) => card.id === taskId);

  if (sourceIndex < 0) {
    return { nextColumns: columns, movedTask: null };
  }

  const movingCard = sourceCards[sourceIndex];

  if (fromStatus === toStatus && !overId.startsWith("column:")) {
    const overIndex = sourceCards.findIndex((card) => card.id === overId);

    if (overIndex < 0 || overIndex === sourceIndex) {
      return { nextColumns: columns, movedTask: null };
    }

    const reordered = normalizeColumnPositions(arrayMove(sourceCards, sourceIndex, overIndex));

    return {
      nextColumns: {
        ...columns,
        [fromStatus]: reordered,
      },
      movedTask: reordered[overIndex],
    };
  }

  const nextSource = sourceCards.filter((card) => card.id !== taskId);
  const destinationCards = fromStatus === toStatus ? nextSource : [...columns[toStatus]];

  const insertIndex = overId.startsWith("column:")
    ? destinationCards.length
    : Math.max(destinationCards.findIndex((card) => card.id === overId), 0);

  const nextMovingCard: KanbanTaskCard = {
    ...movingCard,
    status: toStatus,
  };

  const nextDestination = [...destinationCards];
  nextDestination.splice(insertIndex, 0, nextMovingCard);

  const normalizedSource = normalizeColumnPositions(nextSource);
  const normalizedDestination = normalizeColumnPositions(nextDestination);
  const movedTask = normalizedDestination.find((card) => card.id === taskId) ?? null;

  return {
    nextColumns: {
      ...columns,
      [fromStatus]: normalizedSource,
      [toStatus]: normalizedDestination,
    },
    movedTask,
  };
}

export function KanbanBoard({ workspaceSlug, workspaceId, projectId, columns }: KanbanBoardProps) {
  const [boardColumns, setBoardColumns] = useState(columns);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [creatingByStatus, setCreatingByStatus] = useState<Record<TaskStatus, boolean>>({
    todo: false,
    in_progress: false,
    done: false,
  });

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 5 } }),
  );

  const activeTask = useMemo(() => {
    if (!activeTaskId) {
      return null;
    }

    for (const status of TASK_STATUSES) {
      const foundCard = boardColumns[status].find((card) => card.id === activeTaskId);

      if (foundCard) {
        return foundCard;
      }
    }

    return null;
  }, [activeTaskId, boardColumns]);

  const handleCreateTask = async (status: TaskStatus, title: string) => {
    const optimisticId = `optimistic-${Date.now()}`;

    setCreatingByStatus((previous) => ({ ...previous, [status]: true }));
    setBoardColumns((previous) => upsertCard(previous, { id: optimisticId, title, status, position: 0, isOptimistic: true }));

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

    setBoardColumns((previous) =>
      upsertCard(
        previous,
        {
          id: createdTask.id,
          title: createdTask.properties.title?.trim() || title,
          status: normalizedStatus,
          position: typeof createdTask.position === "number" ? createdTask.position : 1,
          priority: createdTask.properties.priority,
          dueDate: createdTask.properties.due_date,
          assignee: createdTask.properties.assigned_to,
        },
        { removeIds: [optimisticId] }
      )
    );

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
      position: typeof updatedTask.position === "number" ? updatedTask.position : 1,
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTaskId(null);

    if (!event.over) {
      return;
    }

    const activeId = String(event.active.id);
    const overId = String(event.over.id);

    if (activeId === overId) {
      return;
    }

    const snapshot = boardColumns;
    const { nextColumns, movedTask } = moveTask(boardColumns, activeId, overId);

    if (!movedTask) {
      return;
    }

    setBoardColumns(nextColumns);

    const response = await fetch(`/api/blocks/${activeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: movedTask.status, position: movedTask.position }),
    });

    const result = (await response.json()) as ApiResponse<BlockApiData>;

    if (!response.ok || !result.data) {
      setBoardColumns(snapshot);
    }
  };

  const handleDragCancel = () => {
    setActiveTaskId(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
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

      <DragOverlay>
        {activeTask ? (
          <div className="w-[320px] cursor-grabbing">
            <KanbanCard
              workspaceSlug={workspaceSlug}
              card={activeTask}
              onDeleteTask={async () => undefined}
              onUpdateTask={async () => undefined}
              hideActions
              disableLink
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
