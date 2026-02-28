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
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KanbanCard } from "@/components/board/KanbanCard";
import { KanbanColumn, type KanbanTaskCard } from "@/components/board/KanbanColumn";
import { TASK_STATUSES, type TaskStatus } from "@/lib/db/types";
import { useBoardFiltersStore, type BoardSortOption } from "@/lib/stores/board-filters-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { boardColumnsQueryKey } from "@/lib/react-query/query-keys";
import { useWorkspace, type WorkspaceMemberOption } from "@/lib/hooks/use-workspace";
import { safeJson } from "@/lib/utils";

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

type BoardColumns = Record<TaskStatus, KanbanTaskCard[]>;

interface CreateTaskVars {
  status: TaskStatus;
  title: string;
  optimisticId: string;
}

interface UpdateTaskVars {
  taskId: string;
  payload: { title?: string; status?: TaskStatus; due_date?: string | null; assigned_to?: string | null };
}

interface DeleteTaskVars {
  taskId: string;
}

interface ReorderTaskVars {
  taskId: string;
  status: TaskStatus;
  position: number;
  nextColumns: BoardColumns;
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
  columns: BoardColumns,
  nextCard: KanbanTaskCard,
  options?: { removeIds?: string[] }
): BoardColumns {
  const idsToRemove = new Set([nextCard.id, ...(options?.removeIds ?? [])]);

  const nextColumns: BoardColumns = {
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

function removeCard(columns: BoardColumns, taskId: string): BoardColumns {
  return {
    todo: columns.todo.filter((card) => card.id !== taskId),
    in_progress: columns.in_progress.filter((card) => card.id !== taskId),
    done: columns.done.filter((card) => card.id !== taskId),
  };
}

function findTaskStatusById(columns: BoardColumns, id: string): TaskStatus | null {
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

function getInitials(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    return "?";
  }

  const chunks = normalized.split(/\s+/).filter(Boolean);

  if (chunks.length > 1) {
    return `${chunks[0][0] ?? ""}${chunks[1][0] ?? ""}`.toUpperCase();
  }

  return normalized.slice(0, 2).toUpperCase();
}

function moveTask(
  columns: BoardColumns,
  taskId: string,
  overId: string,
): { nextColumns: BoardColumns; movedTask: KanbanTaskCard | null } {
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

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const result = await safeJson<ApiResponse<T>>(response);

  if (!response.ok || !result.data) {
    throw new Error(result.error ?? "Request failed");
  }

  return result.data;
}

export function KanbanBoard({ workspaceSlug, workspaceId, projectId, columns }: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const columnsQueryKey = boardColumnsQueryKey(workspaceSlug, projectId);
  const [boardColumns, setBoardColumns] = useState(() => {
    const cachedColumns = queryClient.getQueryData<BoardColumns>(columnsQueryKey);

    if (cachedColumns) {
      return cachedColumns;
    }

    queryClient.setQueryData(columnsQueryKey, columns);
    return columns;
  });

  const updateBoardColumns = useCallback(
    (updater: BoardColumns | ((previous: BoardColumns) => BoardColumns)) => {
      setBoardColumns((previous) => {
        const next = typeof updater === "function" ? updater(previous) : updater;
        queryClient.setQueryData(columnsQueryKey, next);
        return next;
      });
    },
    [queryClient, columnsQueryKey]
  );

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [creatingByStatus, setCreatingByStatus] = useState<Record<TaskStatus, boolean>>({
    todo: false,
    in_progress: false,
    done: false,
  });
  const { searchQuery, priority, assignee, sortBy, setSearchQuery, setPriority, setAssignee, setSortBy, resetFilters } =
    useBoardFiltersStore();
  const { data: workspaceData } = useWorkspace(workspaceId);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 5 } }),
  );

  // ── Create task mutation ──────────────────────────────────────────────
  const createTaskMutation = useMutation({
    mutationFn: (vars: CreateTaskVars) =>
      apiRequest<BlockApiData>("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, projectId, type: "task", title: vars.title, status: vars.status }),
      }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: columnsQueryKey });
      const previous = queryClient.getQueryData<BoardColumns>(columnsQueryKey);

      setCreatingByStatus((prev) => ({ ...prev, [vars.status]: true }));
      updateBoardColumns((prev) =>
        upsertCard(prev, { id: vars.optimisticId, title: vars.title, status: vars.status, position: 0, isOptimistic: true })
      );

      return { previous, optimisticId: vars.optimisticId, status: vars.status };
    },
    onSuccess: (data, vars, ctx) => {
      const createdStatus = data.properties.status;
      const normalizedStatus: TaskStatus = createdStatus && isTaskStatus(createdStatus) ? createdStatus : vars.status;

      updateBoardColumns((prev) =>
        upsertCard(
          prev,
          {
            id: data.id,
            title: data.properties.title?.trim() || vars.title,
            status: normalizedStatus,
            position: typeof data.position === "number" ? data.position : 1,
            priority: data.properties.priority,
            dueDate: data.properties.due_date,
            assignee: data.properties.assigned_to,
          },
          { removeIds: [ctx.optimisticId] }
        )
      );
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        updateBoardColumns(ctx.previous);
      }
    },
    onSettled: (_data, _err, vars) => {
      setCreatingByStatus((prev) => ({ ...prev, [vars.status]: false }));
      queryClient.invalidateQueries({ queryKey: columnsQueryKey });
    },
  });

  // ── Update task mutation ──────────────────────────────────────────────
  const updateTaskMutation = useMutation({
    mutationFn: (vars: UpdateTaskVars) =>
      apiRequest<BlockApiData>(`/api/blocks/${vars.taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars.payload),
      }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: columnsQueryKey });
      const previous = queryClient.getQueryData<BoardColumns>(columnsQueryKey);

      updateBoardColumns((prev) => {
        const currentStatus = findTaskStatusById(prev, vars.taskId);

        if (!currentStatus) {
          return prev;
        }

        const currentCard = prev[currentStatus].find((card) => card.id === vars.taskId);

        if (!currentCard) {
          return prev;
        }

        const nextStatus = vars.payload.status ?? currentCard.status;

        return upsertCard(prev, {
          ...currentCard,
          id: vars.taskId,
          title: typeof vars.payload.title === "string" ? vars.payload.title : currentCard.title,
          status: nextStatus,
          dueDate: typeof vars.payload.due_date !== "undefined" ? vars.payload.due_date ?? undefined : currentCard.dueDate,
          assignee: typeof vars.payload.assigned_to !== "undefined" ? vars.payload.assigned_to ?? undefined : currentCard.assignee,
        });
      });

      return { previous };
    },
    onSuccess: (data) => {
      const updatedStatus = data.properties.status;
      const nextStatus: TaskStatus = updatedStatus && isTaskStatus(updatedStatus) ? updatedStatus : "todo";

      updateBoardColumns((prev) =>
        upsertCard(prev, {
          id: data.id,
          title: data.properties.title?.trim() || "Bez tytułu",
          status: nextStatus,
          position: typeof data.position === "number" ? data.position : 1,
          priority: data.properties.priority,
          dueDate: data.properties.due_date,
          assignee: data.properties.assigned_to,
        })
      );
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        updateBoardColumns(ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: columnsQueryKey });
    },
  });

  // ── Delete task mutation ──────────────────────────────────────────────
  const deleteTaskMutation = useMutation({
    mutationFn: (vars: DeleteTaskVars) =>
      apiRequest<{ id: string }>(`/api/blocks/${vars.taskId}`, {
        method: "DELETE",
      }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: columnsQueryKey });
      const previous = queryClient.getQueryData<BoardColumns>(columnsQueryKey);

      updateBoardColumns((prev) => removeCard(prev, vars.taskId));

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        updateBoardColumns(ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: columnsQueryKey });
    },
  });

  // ── Reorder task mutation (drag & drop) ───────────────────────────────
  const reorderTaskMutation = useMutation({
    mutationFn: (vars: ReorderTaskVars) =>
      apiRequest<BlockApiData>(`/api/blocks/${vars.taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: vars.status, position: vars.position }),
      }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: columnsQueryKey });
      const previous = queryClient.getQueryData<BoardColumns>(columnsQueryKey);

      updateBoardColumns(vars.nextColumns);

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        updateBoardColumns(ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: columnsQueryKey });
    },
  });

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

  const assigneeOptions = useMemo<WorkspaceMemberOption[]>(() => {
    const fromWorkspace = workspaceData?.members ?? [];

    if (fromWorkspace.length > 0) {
      return fromWorkspace;
    }

    const uniqueAssignees = new Set<string>();

    for (const status of TASK_STATUSES) {
      for (const card of boardColumns[status]) {
        if (card.assignee) {
          uniqueAssignees.add(card.assignee);
        }
      }
    }

    return Array.from(uniqueAssignees)
      .sort((left, right) => left.localeCompare(right))
      .map((id) => ({ id, label: id, initials: getInitials(id) }));
  }, [boardColumns, workspaceData?.members]);

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

    const filterCard = (card: KanbanTaskCard) => {
      if (query && !card.title.toLowerCase().includes(query)) {
        return false;
      }

      if (priority !== "all" && card.priority !== priority) {
        return false;
      }

      if (assignee === "all") return true;
      if (assignee === "mine") return card.assignee === workspaceData?.currentUserId;
      if (assignee === "unassigned") return !card.assignee;
      return card.assignee === assignee;
    };

    return {
      todo: sortCards(boardColumns.todo.filter(filterCard)),
      in_progress: sortCards(boardColumns.in_progress.filter(filterCard)),
      done: sortCards(boardColumns.done.filter(filterCard)),
    };
  }, [assignee, boardColumns, priority, searchQuery, sortBy, workspaceData?.currentUserId]);

  const isPositionSort = sortBy === "position";

  const handleCreateTask = async (status: TaskStatus, title: string) => {
    const optimisticId = `optimistic-${Date.now()}`;
    createTaskMutation.mutate({ status, title, optimisticId });
  };

  const handleUpdateTask = async (taskId: string, payload: { title?: string; status?: TaskStatus; due_date?: string | null; assigned_to?: string | null }) => {
    updateTaskMutation.mutate({ taskId, payload });
  };

  const handleDeleteTask = async (taskId: string) => {
    deleteTaskMutation.mutate({ taskId });
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (!isPositionSort) {
      return;
    }

    setActiveTaskId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
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

    const { nextColumns, movedTask } = moveTask(boardColumns, activeId, overId);

    if (!movedTask) {
      return;
    }

    reorderTaskMutation.mutate({
      taskId: activeId,
      status: movedTask.status,
      position: movedTask.position,
      nextColumns,
    });
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
          <option value="mine">Moje zadania</option>
          <option value="unassigned">Nieprzypisane</option>
          {assigneeOptions.map((assigneeOption) => (
            <option key={assigneeOption.id} value={assigneeOption.id}>
              {assigneeOption.label}
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
            assigneeOptions={assigneeOptions}
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
              assigneeOptions={assigneeOptions}
              hideActions
              disableLink
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
