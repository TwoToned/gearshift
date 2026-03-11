"use client";

import { useState, useCallback } from "react";
import type { SortOrder } from "@/components/ui/sortable-table-head";

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
  };
}
