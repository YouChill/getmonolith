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
import { useQueryClient } from "@tanstack/react-query";
import { KanbanCard } from "@/components/board/KanbanCard";
import { KanbanColumn, type KanbanTaskCard } from "@/components/board/KanbanColumn";
import { TASK_STATUSES, type TaskStatus } from "@/lib/db/types";
import { useBoardFiltersStore, type BoardSortOption } from "@/lib/stores/board-filters-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { boardColumnsQueryKey } from "@/lib/react-query/query-keys";

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

const SORT_OPTIONS: Array<{ value: BoardSortOption; label: string }> = [
  { value: "position", label: "Po pozycji" },
  { value: "due_date", label: "Po due date" },
  { value: "priority", label: "Po priorytecie" },
];

const PRIORITY_ORDER: Record<NonNullable<KanbanTaskCard["priority"]>, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
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
  const queryClient = useQueryClient();
  const columnsQueryKey = boardColumnsQueryKey(workspaceSlug, projectId);
  const [boardColumns, setBoardColumns] = useState(() => {
    const cachedColumns = queryClient.getQueryData<Record<TaskStatus, KanbanTaskCard[]>>(columnsQueryKey);

    if (cachedColumns) {
      return cachedColumns;
    }

    queryClient.setQueryData(columnsQueryKey, columns);
    return columns;
  });

  const updateBoardColumns = (
    updater: Record<TaskStatus, KanbanTaskCard[]> | ((previous: Record<TaskStatus, KanbanTaskCard[]>) => Record<TaskStatus, KanbanTaskCard[]>)
  ) => {
    setBoardColumns((previous) => {
      const next = typeof updater === "function" ? updater(previous) : updater;
      queryClient.setQueryData(columnsQueryKey, next);
      return next;
    });
  };
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [creatingByStatus, setCreatingByStatus] = useState<Record<TaskStatus, boolean>>({
    todo: false,
    in_progress: false,
    done: false,
  });
  const { searchQuery, priority, assignee, sortBy, setSearchQuery, setPriority, setAssignee, setSortBy, resetFilters } =
    useBoardFiltersStore();

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

  const assigneeOptions = useMemo(() => {
    const uniqueAssignees = new Set<string>();

    for (const status of TASK_STATUSES) {
      for (const card of boardColumns[status]) {
        if (card.assignee) {
          uniqueAssignees.add(card.assignee);
        }
      }
    }

    return Array.from(uniqueAssignees).sort((left, right) => left.localeCompare(right));
  }, [boardColumns]);

  const visibleColumns = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const sortCards = (cards: KanbanTaskCard[]) => {
      if (sortBy === "position") {
        return [...cards].sort((left, right) => left.position - right.position);
      }

      if (sortBy === "due_date") {
        return [...cards].sort((left, right) => {
          const leftDate = left.dueDate ? new Date(left.dueDate).getTime() : Number.POSITIVE_INFINITY;
          const rightDate = right.dueDate ? new Date(right.dueDate).getTime() : Number.POSITIVE_INFINITY;

          if (leftDate === rightDate) {
            return left.position - right.position;
          }

          return leftDate - rightDate;
        });
      }

      return [...cards].sort((left, right) => {
        const leftPriority = left.priority ? PRIORITY_ORDER[left.priority] : 0;
        const rightPriority = right.priority ? PRIORITY_ORDER[right.priority] : 0;

        if (leftPriority === rightPriority) {
          return left.position - right.position;
        }

        return rightPriority - leftPriority;
      });
    };

    return {
      todo: sortCards(
        boardColumns.todo.filter((card) => {
          if (query && !card.title.toLowerCase().includes(query)) {
            return false;
          }

          if (priority !== "all" && card.priority !== priority) {
            return false;
          }

          if (assignee === "all") {
            return true;
          }

          if (assignee === "unassigned") {
            return !card.assignee;
          }

          return card.assignee === assignee;
        })
      ),
      in_progress: sortCards(
        boardColumns.in_progress.filter((card) => {
          if (query && !card.title.toLowerCase().includes(query)) {
            return false;
          }

          if (priority !== "all" && card.priority !== priority) {
            return false;
          }

          if (assignee === "all") {
            return true;
          }

          if (assignee === "unassigned") {
            return !card.assignee;
          }

          return card.assignee === assignee;
        })
      ),
      done: sortCards(
        boardColumns.done.filter((card) => {
          if (query && !card.title.toLowerCase().includes(query)) {
            return false;
          }

          if (priority !== "all" && card.priority !== priority) {
            return false;
          }

          if (assignee === "all") {
            return true;
          }

          if (assignee === "unassigned") {
            return !card.assignee;
          }

          return card.assignee === assignee;
        })
      ),
    };
  }, [assignee, boardColumns, priority, searchQuery, sortBy]);

  const isPositionSort = sortBy === "position";

  const handleCreateTask = async (status: TaskStatus, title: string) => {
    const optimisticId = `optimistic-${Date.now()}`;

    setCreatingByStatus((previous) => ({ ...previous, [status]: true }));
    updateBoardColumns((previous) => upsertCard(previous, { id: optimisticId, title, status, position: 0, isOptimistic: true }));

    const response = await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, projectId, type: "task", title, status }),
    });

    const result = (await response.json()) as ApiResponse<BlockApiData>;

    if (!response.ok || !result.data) {
      updateBoardColumns((previous) => ({
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

    updateBoardColumns((previous) =>
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

  const handleUpdateTask = async (taskId: string, payload: { title?: string; status?: TaskStatus; due_date?: string | null }) => {
    const snapshot = boardColumns;

    updateBoardColumns((previous) => {
      const currentStatus = findTaskStatusById(previous, taskId);

      if (!currentStatus) {
        return previous;
      }

      const currentCard = previous[currentStatus].find((card) => card.id === taskId);

      if (!currentCard) {
        return previous;
      }

      const nextStatus = payload.status ?? currentCard.status;

      return upsertCard(previous, {
        ...currentCard,
        id: taskId,
        title: typeof payload.title === "string" ? payload.title : currentCard.title,
        status: nextStatus,
        dueDate: typeof payload.due_date !== "undefined" ? payload.due_date ?? undefined : currentCard.dueDate,
      });
    });

    const response = await fetch(`/api/blocks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as ApiResponse<BlockApiData>;

    if (!response.ok || !result.data) {
      updateBoardColumns(snapshot);
      return;
    }

    const updatedTask = result.data;
    const updatedStatus = updatedTask.properties.status;
    const nextStatus: TaskStatus = updatedStatus && isTaskStatus(updatedStatus) ? updatedStatus : "todo";

    updateBoardColumns((previous) => upsertCard(previous, {
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

    updateBoardColumns((previous) => ({
      todo: previous.todo.filter((card) => card.id !== taskId),
      in_progress: previous.in_progress.filter((card) => card.id !== taskId),
      done: previous.done.filter((card) => card.id !== taskId),
    }));

    const response = await fetch(`/api/blocks/${taskId}`, {
      method: "DELETE",
    });

    const result = (await response.json()) as ApiResponse<{ id: string }>;

    if (!response.ok || !result.data) {
      updateBoardColumns(snapshot);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (!isPositionSort) {
      return;
    }

    setActiveTaskId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTaskId(null);

    if (!isPositionSort) {
      return;
    }

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

    updateBoardColumns(nextColumns);

    const response = await fetch(`/api/blocks/${activeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: movedTask.status, position: movedTask.position }),
    });

    const result = (await response.json()) as ApiResponse<BlockApiData>;

    if (!response.ok || !result.data) {
      updateBoardColumns(snapshot);
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
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-border-subtle bg-bg-base p-3 md:grid-cols-2 xl:grid-cols-5">
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Szukaj po tytule..."
          aria-label="Szukaj kart"
          className="xl:col-span-2"
        />

        <select
          value={priority}
          onChange={(event) => setPriority(event.target.value as "all" | "high" | "medium" | "low")}
          className="h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          aria-label="Filtr priorytetu"
        >
          <option value="all">Priorytet: wszystkie</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={assignee}
          onChange={(event) => setAssignee(event.target.value)}
          className="h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          aria-label="Filtr użytkownika"
        >
          <option value="all">Przypisany: wszyscy</option>
          <option value="unassigned">Nieprzypisane</option>
          {assigneeOptions.map((assigneeOption) => (
            <option key={assigneeOption} value={assigneeOption}>
              {assigneeOption}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as BoardSortOption)}
            className="h-10 flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            aria-label="Sortowanie kart"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button type="button" variant="ghost" onClick={resetFilters}>
            Reset
          </Button>
        </div>
      </div>

      {!isPositionSort ? (
        <p className="mb-4 text-xs text-content-muted">Przeciąganie kart działa tylko przy sortowaniu "Po pozycji".</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {TASK_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            title={COLUMN_TITLES[status]}
            status={status}
            workspaceSlug={workspaceSlug}
            cards={visibleColumns[status]}
            isCreating={creatingByStatus[status]}
            disableDrag={!isPositionSort}
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
