"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  MoreHorizontal,
  Search,
  SearchX,
  type LucideIcon,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, apiGet, toQueryString, type Paginated } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DataTablePagination } from "./DataTablePagination";
import { useListParams } from "./useListParams";

export type DataTableColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** API ordering field; makes the header sortable. */
  sortField?: string;
  className?: string;
  /** Hide the table column below this breakpoint. Such columns are also left out of the default mobile card. */
  hideBelow?: "md" | "lg";
};

export type DataTableFilter = {
  id: string;
  label: string;
  options: { value: string; label: string }[];
};

export type DataTableRowAction = {
  label: string;
  onSelect: () => void;
  icon?: LucideIcon;
  destructive?: boolean;
  disabled?: boolean;
};

export type DataTableProps<T extends { id: string | number }> = {
  queryKey: readonly unknown[];
  /** Path under /api/v1, e.g. "/admin/branches/". */
  endpoint: string;
  columns: DataTableColumn<T>[];
  mobileCard?: (row: T) => React.ReactNode;
  filters?: DataTableFilter[];
  /** Render a single filter as tabs instead of a select. */
  filtersAs?: "selects" | "tabs";
  searchPlaceholder: string;
  toolbarActions?: React.ReactNode;
  rowActions?: (row: T) => DataTableRowAction[];
  emptyText: string;
  defaultOrdering?: string;
};

const ALL = "__all__";
const SEARCH_DEBOUNCE_MS = 400;

/** Returns a function that refetches every page of the list under `queryKey`. */
export function useInvalidateList(queryKey: readonly unknown[]) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey });
}

export function DataTable<T extends { id: string | number }>(props: DataTableProps<T>) {
  // useSearchParams needs a Suspense boundary under Cache Components.
  return (
    <Suspense fallback={<ListSkeleton rows={5} columns={props.columns.length} />}>
      <DataTableInner {...props} />
    </Suspense>
  );
}

function DataTableInner<T extends { id: string | number }>({
  queryKey,
  endpoint,
  columns,
  mobileCard,
  filters = [],
  filtersAs = "selects",
  searchPlaceholder,
  toolbarActions,
  rowActions,
  emptyText,
  defaultOrdering = "",
}: DataTableProps<T>) {
  const queryClient = useQueryClient();
  const list = useListParams(
    filters.map((f) => f.id),
    defaultOrdering,
  );
  const { page, pageSize, search, ordering, setParams } = list;

  // Search box: local while typing, pushed to the URL after a pause.
  const [searchInput, setSearchInput] = useState(search);
  const [lastSearch, setLastSearch] = useState(search);
  const [pushedSearch, setPushedSearch] = useState(search);
  if (search !== lastSearch) {
    setLastSearch(search);
    if (search !== pushedSearch) setSearchInput(search); // back/forward or "Clear search"
  }
  useEffect(() => {
    const value = searchInput.trim();
    if (value === search) return;
    const timer = setTimeout(() => {
      setPushedSearch(value);
      setParams({ search: value, page: null });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search, setParams]);

  const baseQs = toQueryString({ page_size: pageSize, search, ordering, ...list.filters });
  const query = useQuery({
    queryKey: [...queryKey, baseQs, page],
    queryFn: () => apiGet<Paginated<T>>(`${endpoint}${baseQs}&page=${page}`),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const totalPages = data?.total_pages ?? 0;
  const settled = !query.isPlaceholderData;

  useEffect(() => {
    if (settled && page < totalPages) {
      void queryClient.prefetchQuery({
        queryKey: [...queryKey, baseQs, page + 1],
        queryFn: () => apiGet<Paginated<T>>(`${endpoint}${baseQs}&page=${page + 1}`),
      });
    }
  }, [queryClient, queryKey, baseQs, endpoint, page, totalPages, settled]);

  // After a delete the current page can disappear: step back to the last one.
  useEffect(() => {
    if (settled && totalPages > 0 && page > totalPages) setParams({ page: totalPages });
  }, [settled, page, totalPages, setParams]);

  const hasFilters = Object.keys(list.filters).length > 0;
  const clearAll = () => {
    setSearchInput("");
    setPushedSearch("");
    setParams({ search: null, page: null, ...Object.fromEntries(filters.map((f) => [f.id, null])) });
  };
  const toggleSort = (field: string) => {
    const next = ordering === field ? `-${field}` : ordering === `-${field}` ? null : field;
    setParams({ ordering: next ?? defaultOrdering, page: null });
  };
  const setFilter = (id: string, value: string) =>
    setParams({ [id]: value === ALL ? null : value, page: null });

  const showTabs = filtersAs === "tabs" && filters.length === 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 sm:max-w-sm sm:flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            inputMode="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="bg-card pl-9"
          />
        </div>
        {!showTabs &&
          filters.map((filter) => (
            <Select
              key={filter.id}
              value={list.filters[filter.id] ?? ALL}
              onValueChange={(v) => setFilter(filter.id, v)}
            >
              <SelectTrigger className="w-full bg-card sm:w-auto sm:min-w-40" aria-label={filter.label}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value={ALL}>All {filter.label.toLowerCase()}</SelectItem>
                {filter.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        {toolbarActions && (
          <div className="flex flex-wrap gap-2 sm:ml-auto [&>*]:flex-1 sm:[&>*]:flex-none">
            {toolbarActions}
          </div>
        )}
      </div>

      {showTabs && (
        <Tabs value={list.filters[filters[0].id] ?? ALL} onValueChange={(v) => setFilter(filters[0].id, v)}>
          <div className="-mx-1 overflow-x-auto px-1">
            <TabsList aria-label={filters[0].label}>
              <TabsTrigger value={ALL}>All</TabsTrigger>
              {filters[0].options.map((o) => (
                <TabsTrigger key={o.value} value={o.value}>
                  {o.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      )}

      {query.isError && !data ? (
        <ErrorState
          message={query.error instanceof ApiError ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
        />
      ) : !data ? (
        <ListSkeleton rows={Math.min(pageSize, 10)} columns={columns.length} />
      ) : data.count === 0 ? (
        <EmptyState
          icon={search || hasFilters ? SearchX : undefined}
          title={emptyText}
          description={search ? `No results for "${search}".` : undefined}
          action={
            (search || hasFilters) && (
              <Button variant="outline" onClick={clearAll}>
                {search ? "Clear search" : "Clear filters"}
              </Button>
            )
          }
        />
      ) : (
        <div
          aria-busy={query.isPlaceholderData}
          className={cn("space-y-4 transition-opacity", query.isPlaceholderData && "opacity-60")}
        >
          <div className="hidden overflow-hidden rounded-xl border bg-card shadow-sm md:block">
            <Table containerClassName="max-h-[70dvh] overflow-auto">
              <TableHeader className="sticky top-0 z-10 bg-muted">
                <TableRow className="hover:bg-transparent">
                  {columns.map((col) => (
                    <TableHead
                      key={col.id}
                      aria-sort={col.sortField ? ariaSort(ordering, col.sortField) : undefined}
                      className={cn(hideClass(col.hideBelow), col.className)}
                    >
                      {col.sortField ? (
                        <SortButton
                          label={col.header}
                          direction={ariaSort(ordering, col.sortField)}
                          onClick={() => toggleSort(col.sortField!)}
                        />
                      ) : (
                        col.header
                      )}
                    </TableHead>
                  ))}
                  {rowActions && (
                    <TableHead className="w-14">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((row) => (
                  <TableRow key={row.id}>
                    {columns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn("py-3", hideClass(col.hideBelow), col.className)}
                      >
                        {col.cell(row)}
                      </TableCell>
                    ))}
                    {rowActions && (
                      <TableCell className="py-2 text-right">
                        <RowActionsMenu actions={rowActions(row)} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="grid gap-3 md:hidden">
            {data.results.map((row) => (
              <li key={row.id} className="relative rounded-xl border bg-card p-4 shadow-sm">
                <div className={cn("min-w-0", rowActions && "pr-12")}>
                  {mobileCard ? mobileCard(row) : <DefaultCard row={row} columns={columns} />}
                </div>
                {rowActions && (
                  <div className="absolute top-2 right-2">
                    <RowActionsMenu actions={rowActions(row)} />
                  </div>
                )}
              </li>
            ))}
          </ul>

          <DataTablePagination
            page={page}
            pageSize={pageSize}
            count={data.count}
            totalPages={totalPages}
            onPageChange={(p) => setParams({ page: p })}
            onPageSizeChange={(size) => setParams({ page_size: size, page: null })}
          />
        </div>
      )}
    </div>
  );
}

type SortDirection = "ascending" | "descending" | "none";

function ariaSort(ordering: string, field: string): SortDirection {
  if (ordering === field) return "ascending";
  if (ordering === `-${field}`) return "descending";
  return "none";
}

function hideClass(hideBelow?: "md" | "lg") {
  return hideBelow === "lg" ? "hidden lg:table-cell" : undefined;
}

function SortButton({
  label,
  direction,
  onClick,
}: {
  label: string;
  direction: SortDirection;
  onClick: () => void;
}) {
  const Icon = direction === "ascending" ? ArrowUp : direction === "descending" ? ArrowDown : ChevronsUpDown;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn("-ml-2.5", direction !== "none" && "text-foreground")}
    >
      {label}
      <Icon className={cn(direction === "none" && "opacity-50")} aria-hidden />
    </Button>
  );
}

function RowActionsMenu({ actions }: { actions: DataTableRowAction[] }) {
  if (actions.length === 0) return null;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Row actions">
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {actions.map(({ label, icon: Icon, onSelect, destructive, disabled }) => (
          <DropdownMenuItem
            key={label}
            onSelect={onSelect}
            disabled={disabled}
            variant={destructive ? "destructive" : "default"}
          >
            {Icon && <Icon aria-hidden />}
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DefaultCard<T>({ row, columns }: { row: T; columns: DataTableColumn<T>[] }) {
  const [first, ...rest] = columns.filter((c) => !c.hideBelow);
  if (!first) return null;
  return (
    <div className="space-y-3">
      <div className="font-medium break-words">{first.cell(row)}</div>
      {rest.length > 0 && (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          {rest.map((col) => (
            <div key={col.id} className="contents">
              <dt className="text-muted-foreground">{col.header}</dt>
              <dd className="min-w-0 text-right break-words">{col.cell(row)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function ListSkeleton({ rows, columns }: { rows: number; columns: number }) {
  return (
    <div aria-hidden>
      <div className="hidden overflow-hidden rounded-xl border bg-card shadow-sm md:block">
        <div className="h-10 border-b bg-muted" />
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex h-[53px] items-center gap-4 border-b px-2 last:border-0">
            {Array.from({ length: columns }, (_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:hidden">
        {Array.from({ length: Math.min(rows, 4) }, (_, i) => (
          <div key={i} className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  );
}
