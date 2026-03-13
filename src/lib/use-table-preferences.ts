"use client";

import { useState, useCallback } from "react";
import type { SortOrder } from "@/components/ui/sortable-table-head";
import type { FilterValue } from "@/lib/table-utils";

const STORAGE_PREFIX = "gearflow-table-";

function getStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + key);
    if (stored !== null) return JSON.parse(stored) as T;
  } catch {
    // ignore
  }
  return fallback;
}

function setStored<T>(key: string, value: T) {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
}

export function useTablePreferences(
  tableId: string,
  defaults: {
    sortBy: string;
    sortOrder: SortOrder;
    pageSize?: number;
    view?: string;
  },
) {
  const [sortBy, setSortByState] = useState(() =>
    getStored(`${tableId}-sortBy`, defaults.sortBy),
  );
  const [sortOrder, setSortOrderState] = useState<SortOrder>(() =>
    getStored(`${tableId}-sortOrder`, defaults.sortOrder),
  );
  const [pageSize, setPageSizeState] = useState(() =>
    getStored(`${tableId}-pageSize`, defaults.pageSize ?? 25),
  );
  const [view, setViewState] = useState(() =>
    getStored(`${tableId}-view`, defaults.view ?? ""),
  );
  const [page, setPage] = useState(1);

  // Column visibility — persisted
  const [columnVisibility, setColumnVisibilityState] = useState<Record<string, boolean>>(() =>
    getStored(`${tableId}-colVis`, {}),
  );

  // Filters — persisted
  const [filters, setFiltersState] = useState<Record<string, FilterValue>>(() =>
    getStored(`${tableId}-filters`, {}),
  );

  const setSortBy = useCallback(
    (value: string) => {
      setSortByState(value);
      setStored(`${tableId}-sortBy`, value);
    },
    [tableId],
  );

  const setSortOrder = useCallback(
    (value: SortOrder) => {
      setSortOrderState(value);
      setStored(`${tableId}-sortOrder`, value);
    },
    [tableId],
  );

  const setPageSize = useCallback(
    (value: number) => {
      setPageSizeState(value);
      setStored(`${tableId}-pageSize`, value);
      setPage(1);
    },
    [tableId],
  );

  const setView = useCallback(
    (value: string) => {
      setViewState(value);
      setStored(`${tableId}-view`, value);
      setPage(1);
    },
    [tableId],
  );

  const setColumnVisibility = useCallback(
    (value: Record<string, boolean>) => {
      setColumnVisibilityState(value);
      setStored(`${tableId}-colVis`, value);
    },
    [tableId],
  );

  const toggleColumnVisibility = useCallback(
    (columnId: string) => {
      setColumnVisibilityState((prev) => {
        const next = { ...prev, [columnId]: !prev[columnId] };
        // Remove the entry if toggling back to undefined (let default apply)
        if (next[columnId] === undefined) delete next[columnId];
        setStored(`${tableId}-colVis`, next);
        return next;
      });
    },
    [tableId],
  );

  const setFilters = useCallback(
    (value: Record<string, FilterValue>) => {
      setFiltersState(value);
      setStored(`${tableId}-filters`, value);
      setPage(1);
    },
    [tableId],
  );

  const setFilter = useCallback(
    (key: string, value: FilterValue | undefined) => {
      setFiltersState((prev) => {
        const next = { ...prev };
        if (value === undefined || (Array.isArray(value) && value.length === 0)) {
          delete next[key];
        } else {
          next[key] = value;
        }
        setStored(`${tableId}-filters`, next);
        setPage(1);
        return next;
      });
    },
    [tableId],
  );

  const clearFilters = useCallback(() => {
    setFiltersState({});
    setStored(`${tableId}-filters`, {});
    setPage(1);
  }, [tableId]);

  const resetPreferences = useCallback(() => {
    setSortByState(defaults.sortBy);
    setSortOrderState(defaults.sortOrder);
    setPageSizeState(defaults.pageSize ?? 25);
    setColumnVisibilityState({});
    setFiltersState({});
    setPage(1);
    localStorage.removeItem(STORAGE_PREFIX + `${tableId}-sortBy`);
    localStorage.removeItem(STORAGE_PREFIX + `${tableId}-sortOrder`);
    localStorage.removeItem(STORAGE_PREFIX + `${tableId}-pageSize`);
    localStorage.removeItem(STORAGE_PREFIX + `${tableId}-colVis`);
    localStorage.removeItem(STORAGE_PREFIX + `${tableId}-filters`);
  }, [tableId, defaults]);

  const handleSort = useCallback(
    (key: string) => {
      if (sortBy === key) {
        const next = sortOrder === "asc" ? "desc" : "asc";
        setSortOrder(next);
      } else {
        setSortBy(key);
        setSortOrder("asc");
      }
      setPage(1);
    },
    [sortBy, sortOrder, setSortBy, setSortOrder],
  );

  return {
    sortBy,
    sortOrder,
    pageSize,
    view,
    page,
    setPage,
    setPageSize,
    setView,
    handleSort,
    columnVisibility,
    setColumnVisibility,
    toggleColumnVisibility,
    filters,
    setFilters,
    setFilter,
    clearFilters,
    resetPreferences,
  };
}
