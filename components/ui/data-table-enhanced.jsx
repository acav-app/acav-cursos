"use client";
import React, { useCallback, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Search,
  RotateCcw,
  FolderKanban,
  SlidersHorizontal,
  X,
} from "lucide-react";

function getNestedValue(obj, path) {
  if (obj == null) return "";
  const keys = String(path || "").split(".").filter(Boolean);
  let acc = obj;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (acc == null) return "";
    if (Object.prototype.hasOwnProperty.call(acc, key)) {
      acc = acc[key];
    } else {
      return "";
    }
  }
  return acc;
}

function universalStringify(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => universalStringify(item)).filter(Boolean).join(" ");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}

const MIN_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZES = [10, 20, 40, 60, 100];

export function DataTableEnhanced(props) {
  const {
    data,
    columns,
    searchPlaceholder = "Buscar en la tabla...",
    searchableColumnKeys,
    showSearch = true,
    showPagination = true,
    showPageSize = true,
    showFiltersRow = false,
    showColumnVisibility = false,
    className = "",
    defaultSorting = [],
    defaultPageSize = 20,
    pageSizes = DEFAULT_PAGE_SIZES,
    onRowClick,
    compact = false,
    toolbarLeft,
    toolbarRight,
    emptyTitle = "No se encontraron resultados",
    emptySubtitle = "Intenta ajustar los filtros de búsqueda.",
    wrapperClassName = "rounded-[28px] border border-[#E5E7EB] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.04)]",
  } = props || {};

  const safePageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(MIN_PAGE_SIZE, Number.isFinite(Number(defaultPageSize)) ? Number(defaultPageSize) : 20)
  );

  const safePageSizes = useMemo(() => {
    const normalized = (Array.isArray(pageSizes) ? pageSizes : DEFAULT_PAGE_SIZES)
      .map((n) => Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Number(n) || 20)))
      .sort((a, b) => a - b);
    const unique = Array.from(new Set(normalized));
    if (!unique.includes(safePageSize)) {
      const withDefault = [...unique, safePageSize].sort((a, b) => a - b);
      return withDefault;
    }
    return unique;
  }, [pageSizes, safePageSize]);

  const [sorting, setSorting] = useState(defaultSorting || []);
  const [headerFilters, setHeaderFilters] = useState({});
  const [columnVisibility, setColumnVisibility] = useState({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [{ pageIndex, pageSize }, setPagination] = useState({
    pageIndex: 0,
    pageSize: safePageSize,
  });
  const [showColumnPanel, setShowColumnPanel] = useState(false);

  const getSearchableKeys = useCallback(
    (fallbackColumns) => {
      if (Array.isArray(searchableColumnKeys) && searchableColumnKeys.length) {
        return searchableColumnKeys;
      }
      return (fallbackColumns || [])
        .map((col) => col && col.accessorKey)
        .filter(Boolean);
    },
    [searchableColumnKeys]
  );

  const getHeaderFilterableKeys = useCallback((fallbackColumns) => {
    return (fallbackColumns || [])
      .filter((col) => !(col && col.meta && col.meta.enableColumnFilter === false))
      .map((col) => ({ id: col.id, accessorKey: col.accessorKey }));
  }, []);

  const filteredData = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];
    const query = String(globalFilter || "").trim().toLowerCase();
    const activeHeaderEntries = [];
    const filterKeys = Object.keys(headerFilters || {});
    for (let i = 0; i < filterKeys.length; i++) {
      const key = filterKeys[i];
      const value = headerFilters ? headerFilters[key] : "";
      if (String(value || "").trim()) {
        activeHeaderEntries.push([key, String(value).trim()]);
      }
    }
    if (!query && !activeHeaderEntries.length) return rows;

    const searchKeys = getSearchableKeys(columns);
    const headerColumns = getHeaderFilterableKeys(columns);

    return rows.filter((row) => {
      if (query) {
        let matchesGlobal = false;
        for (let k = 0; k < searchKeys.length; k++) {
          const haystack = universalStringify(getNestedValue(row, searchKeys[k])).toLowerCase();
          if (haystack.includes(query)) {
            matchesGlobal = true;
            break;
          }
        }
        if (!matchesGlobal) return false;
      }

      for (let i = 0; i < activeHeaderEntries.length; i++) {
        const entry = activeHeaderEntries[i];
        const column = headerColumns.find((c) => c.id === entry[0]);
        if (!column) continue;
        const accessor = column.accessorKey || column.id;
        const needle = String(entry[1]).toLowerCase();
        const haystack = universalStringify(getNestedValue(row, accessor)).toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [data, globalFilter, headerFilters, columns, getSearchableKeys, getHeaderFilterableKeys]);

  const pagination = useMemo(() => ({ pageIndex, pageSize }), [pageIndex, pageSize]);

  const safeSetPagination = useCallback((updater) => {
    setPagination((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const nextPageSize = Math.min(
        MAX_PAGE_SIZE,
        Math.max(MIN_PAGE_SIZE, Number(next && next.pageSize ? next.pageSize : prev.pageSize))
      );
      let nextPageIndex = Number(next && Number.isFinite(Number(next.pageIndex)) ? next.pageIndex : prev.pageIndex);
      if (!Number.isFinite(nextPageIndex) || nextPageIndex < 0) nextPageIndex = 0;
      const nextTotalPages = Math.max(1, Math.ceil(filteredData.length / nextPageSize) || 1);
      if (nextPageIndex >= nextTotalPages) nextPageIndex = nextTotalPages - 1;
      return { pageIndex: nextPageIndex, pageSize: nextPageSize };
    });
  }, [filteredData.length]);

  const table = useReactTable({
    data: filteredData,
    columns: columns || [],
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
      columnVisibility,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: safeSetPagination,
    autoResetPageIndex: false,
    autoResetAll: false,
    manualPagination: false,
    pageCount: Math.max(1, Math.ceil(filteredData.length / pagination.pageSize) || 1),
  });

  const totalRows = filteredData.length;
  const totalPages = Math.max(1, table.getPageCount ? table.getPageCount() : 1);
  const currentPage = Math.min(totalPages, pagination.pageIndex + 1);
  const start = totalRows === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const end = Math.min((pagination.pageIndex + 1) * pagination.pageSize, totalRows);

  const activeHeaderFilterCount = Object.keys(headerFilters || {}).reduce((acc, key) => {
    return acc + (String(headerFilters ? headerFilters[key] || "" : "").trim() ? 1 : 0);
  }, 0);
  const hasActiveFilters = Boolean(globalFilter) || activeHeaderFilterCount > 0;

  const resetAllFilters = () => {
    setHeaderFilters({});
    setGlobalFilter("");
    setSorting(defaultSorting || []);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const setHeaderFilter = (columnId, value) => {
    setHeaderFilters((prev) => {
      const next = { ...(prev || {}) };
      if (!String(value || "").trim()) {
        delete next[columnId];
      } else {
        next[columnId] = String(value).trim();
      }
      return next;
    });
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  return (
    <div className={`w-full ${className}`}>
      <section className={`${wrapperClassName} overflow-hidden`}>
        <header
          className={`flex flex-col gap-3 border-b border-[#EEF2F7] bg-[#FAFBFD] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-7 md:py-5 ${
            compact ? "px-4 py-3" : ""
          }`}
        >
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#4338CA]">
              <SlidersHorizontal className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={`font-semibold text-[#0F172A] ${compact ? "text-sm" : "text-base"}`}>
                  {totalRows} {totalRows === 1 ? "registro" : "registros"}
                </h3>
                {hasActiveFilters ? (
                  <Badge variant="soft" color="info" className="rounded-full">
                    Filtros activos
                  </Badge>
                ) : null}
              </div>
              <p className={`mt-1 text-[#64748B] ${compact ? "text-xs" : "text-sm"}`}>
                Página {currentPage} de {totalPages}
              </p>
            </div>
            {toolbarLeft ? <div className="w-full md:w-auto md:ml-3">{toolbarLeft}</div> : null}
          </div>

          <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center md:justify-end md:gap-3">
            {showSearch ? (
              <div className="relative w-full md:w-[320px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <Input
                  placeholder={searchPlaceholder}
                  value={globalFilter}
                  onChange={(event) => {
                    setGlobalFilter(event.target.value);
                    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                  }}
                  className={`h-11 rounded-2xl bg-white pl-10 pr-10 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-[#2356B8]/40 ${
                    compact ? "h-9 text-xs" : ""
                  }`}
                />
                {globalFilter ? (
                  <button
                    type="button"
                    onClick={() => setGlobalFilter("")}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ) : null}

            {showColumnVisibility ? (
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  size={compact ? "sm" : "default"}
                  onClick={() => setShowColumnPanel((v) => !v)}
                  className="rounded-2xl border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
                >
                  <FolderKanban className="h-4 w-4" />
                  <span className="ml-2 hidden sm:inline">Columnas</span>
                </Button>
                {showColumnPanel ? (
                  <div className="absolute right-0 z-30 mt-2 w-[260px] rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
                    <div className="mb-2 flex items-center justify-between">
                      <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">
                        Visibilidad
                      </Label>
                      <button
                        type="button"
                        onClick={() => setShowColumnPanel(false)}
                        className="text-[#94A3B8] hover:text-[#0F172A]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid max-h-72 gap-1.5 overflow-auto pr-1">
                      {(table.getAllLeafColumns ? table.getAllLeafColumns() : []).map((col) => {
                        const isVisible = typeof col.getIsVisible === "function" ? col.getIsVisible() : true;
                        const headerLabel =
                          col && col.columnDef && typeof col.columnDef.header === "string"
                            ? col.columnDef.header
                            : col && col.id;
                        return (
                          <label
                            key={col && col.id}
                            className="flex cursor-pointer items-center justify-between gap-2 rounded-xl px-2 py-2 hover:bg-[#F8FAFC]"
                          >
                            <span className="text-sm text-[#0F172A]">{headerLabel}</span>
                            <input
                              type="checkbox"
                              checked={Boolean(isVisible)}
                              onChange={(e) => {
                                if (typeof col.toggleVisibility === "function") {
                                  col.toggleVisibility(e.target.checked);
                                }
                              }}
                              className="h-4 w-4 rounded border-[#CBD5E1] text-[#2356B8] focus:ring-[#2356B8]/40"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <Button
              type="button"
              variant="outline"
              size={compact ? "sm" : "default"}
              onClick={resetAllFilters}
              className="rounded-2xl border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Limpiar filtros</span>
            </Button>

            {toolbarRight ? <div>{toolbarRight}</div> : null}
          </div>
        </header>

        <div className="overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              {(table.getHeaderGroups ? table.getHeaderGroups() : []).map((headerGroup) => (
                <TableRow
                  key={headerGroup && headerGroup.id}
                  className="border-b border-[#EEF2F7] bg-[#F8FAFC] hover:bg-[#F8FAFC]"
                >
                  {(headerGroup && headerGroup.headers ? headerGroup.headers : []).map((header) => {
                    const canSort =
                      header && header.column && typeof header.column.getCanSort === "function"
                        ? header.column.getCanSort()
                        : Boolean(header && header.column && header.column.getCanSort);
                    const sortState =
                      header && header.column && typeof header.column.getIsSorted === "function"
                        ? header.column.getIsSorted()
                        : false;
                    const canFilter =
                      showFiltersRow &&
                      header &&
                      header.column &&
                      header.column.columnDef &&
                      header.column.columnDef.meta &&
                      header.column.columnDef.meta.enableColumnFilter !== false;
                    return (
                      <TableHead
                        key={header && header.id}
                        className={`whitespace-nowrap border-r border-[#EEF2F7] last:border-r-0 bg-[#F8FAFC] text-left font-semibold uppercase tracking-[0.12em] text-[#475569] ${
                          compact ? "px-3 py-2.5 text-[11px]" : "px-4 py-3.5 text-[11px]"
                        }`}
                      >
                        <div className="flex flex-col gap-1.5">
                          <div
                            className={`flex items-center gap-1.5 ${
                              canSort ? "cursor-pointer select-none" : ""
                            }`}
                            onClick={
                              canSort &&
                              header &&
                              header.column &&
                              typeof header.column.getToggleSortingHandler === "function"
                                ? header.column.getToggleSortingHandler()
                                : undefined
                            }
                            aria-sort={
                              sortState === "asc"
                                ? "ascending"
                                : sortState === "desc"
                                  ? "descending"
                                  : "none"
                            }
                          >
                            {header && header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext ? header.getContext() : undefined
                                )}
                            {canSort ? (
                              <span className="inline-flex flex-col leading-none text-[#94A3B8]">
                                <span
                                  aria-hidden="true"
                                  className={sortState === "asc" ? "text-[#1D4ED8]" : "opacity-40"}
                                >
                                  ▲
                                </span>
                                <span
                                  aria-hidden="true"
                                  className={
                                    sortState === "desc" ? "-mt-1 text-[#1D4ED8]" : "-mt-1 opacity-40"
                                  }
                                >
                                  ▼
                                </span>
                              </span>
                            ) : null}
                          </div>
                          {canFilter && header && header.column ? (
                            <Input
                              value={headerFilters && header.column.id ? headerFilters[header.column.id] || "" : ""}
                              onChange={(e) =>
                                setHeaderFilter(header.column.id, e.target.value)
                              }
                              placeholder="Filtrar"
                              className={`h-9 rounded-xl border-[#E5E7EB] bg-white px-2.5 text-xs font-normal tracking-normal text-[#0F172A] shadow-none placeholder:text-[#94A3B8] focus-visible:ring-2 focus-visible:ring-[#2356B8]/30 ${
                                compact ? "h-8 text-[11px]" : ""
                              }`}
                            />
                          ) : null}
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel &&
              table.getRowModel().rows &&
              Array.isArray(table.getRowModel().rows) &&
              table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row, rowIndex) => {
                  const zebra = rowIndex % 2 === 0 ? "bg-white" : "bg-[#FAFBFD]";
                  return (
                    <TableRow
                      key={row && row.id}
                      data-state={typeof row.getIsSelected === "function" && row.getIsSelected() ? "selected" : undefined}
                      className={`border-b border-[#EEF2F7] last:border-b-0 transition-colors ${zebra} ${
                        typeof onRowClick === "function" ? "cursor-pointer hover:bg-[#EEF4FF]/60" : ""
                      }`}
                      onClick={
                        typeof onRowClick === "function"
                          ? () => onRowClick(row && row.original, row)
                          : undefined
                      }
                    >
                      {(row && typeof row.getVisibleCells === "function" ? row.getVisibleCells() : []).map((cell) => (
                        <TableCell
                          key={cell && cell.id}
                          className={`align-top border-r border-[#EEF2F7]/60 last:border-r-0 text-[#0F172A] ${
                            compact ? "px-3 py-2.5 text-xs" : "px-4 py-3.5 text-sm"
                          }`}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext ? cell.getContext() : undefined
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={table.getAllLeafColumns ? table.getAllLeafColumns().length : 1}
                    className="h-36 px-4 text-center align-middle text-[#64748B]"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 py-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F5F9] text-[#94A3B8]">
                        <Search className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold text-[#0F172A]">{emptyTitle}</p>
                      <p className="text-xs leading-6 text-[#64748B]">{emptySubtitle}</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {showPagination ? (
          <footer
            className={`flex flex-col gap-3 border-t border-[#EEF2F7] bg-[#FAFBFD] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-7 md:py-5 ${
              compact ? "px-4 py-3" : ""
            }`}
          >
            <div className="flex flex-wrap items-center gap-3 text-sm text-[#475569]">
              <span>
                Mostrando <span className="font-semibold text-[#0F172A]">{start}</span> a{" "}
                <span className="font-semibold text-[#0F172A]">{end}</span> de{" "}
                <span className="font-semibold text-[#0F172A]">{totalRows}</span> resultados
              </span>

              {showPageSize ? (
                <div className="flex items-center gap-2">
                  <Label htmlFor="pageSizeSelect" className="text-xs text-[#64748B]">
                    Filas:
                  </Label>
                  <Select
                    value={`${pagination.pageSize}`}
                    onValueChange={(value) => {
                      const next = Math.min(
                        MAX_PAGE_SIZE,
                        Math.max(MIN_PAGE_SIZE, Number(value) || 20)
                      );
                      safeSetPagination({ pageIndex: 0, pageSize: next });
                    }}
                  >
                    <SelectTrigger
                      id="pageSizeSelect"
                      className={`h-10 w-28 rounded-2xl border-[#E5E7EB] bg-white text-sm ${
                        compact ? "h-8 text-xs" : ""
                      }`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {safePageSizes.map((size) => (
                        <SelectItem key={size} value={`${size}`}>
                          {size} filas
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            <nav
              aria-label="Paginación de tabla"
              className="flex flex-wrap items-center justify-start gap-1.5 md:justify-end"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => safeSetPagination({ pageIndex: 0, pageSize: pagination.pageSize })}
                disabled={currentPage <= 1}
                className="h-9 w-9 rounded-2xl border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Ir a la primera página"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => (typeof table.previousPage === "function" ? table.previousPage() : null)}
                disabled={currentPage <= 1}
                className="h-9 w-9 rounded-2xl border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="mx-1 flex items-center gap-1.5">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      type="button"
                      size="sm"
                      variant={currentPage === pageNum ? "default" : "outline"}
                      onClick={() =>
                        safeSetPagination({
                          pageIndex: pageNum - 1,
                          pageSize: pagination.pageSize,
                        })
                      }
                      aria-current={currentPage === pageNum ? "page" : undefined}
                      aria-label={`Ir a la página ${pageNum}`}
                      className={`h-9 min-w-9 rounded-2xl px-3 text-sm ${
                        currentPage === pageNum
                          ? "bg-[#2356B8] text-white hover:bg-[#1D4ED8]"
                          : "border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
                      }`}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => (typeof table.nextPage === "function" ? table.nextPage() : null)}
                disabled={currentPage >= totalPages}
                className="h-9 w-9 rounded-2xl border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Página siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  safeSetPagination({
                    pageIndex: Math.max(0, totalPages - 1),
                    pageSize: pagination.pageSize,
                  })
                }
                disabled={currentPage >= totalPages}
                className="h-9 w-9 rounded-2xl border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Ir a la última página"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </nav>
          </footer>
        ) : null}
      </section>
    </div>
  );
}

export default DataTableEnhanced;
