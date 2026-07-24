"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Loader2,
  Users,
  MapPin,
  Calendar,
  IndianRupee,
  Check,
  AlertCircle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  UserPlus,
  UserMinus,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/Input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Player, AuctionRound } from "@/features/auction/types/index.types";
import { ROLE_OPTIONS, type PlayerRole } from "@/features/auction/hooks/usePlayerPool";
import { RoleFilter } from "./RoleFilter";
import { formatLakhs } from "@/features/auction/utils/index.utils";

// ── Types ────────────────────────────────────────────────────────────────

interface PlayerPoolTableProps {
  players: Player[];
  rounds: AuctionRound[];
  loading: boolean;
  error: string | null;

  // Filtering
  searchQuery: string;
  onSearchChange: (q: string) => void;
  roleFilter: PlayerRole[];
  onToggleRole: (role: PlayerRole) => void;
  onClearFilters: () => void;

  // Selection
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;

  // Assignment
  assigning: boolean;
  assignError: string | null;
  onAssignToRound: (roundId: string) => void;
  onRemoveFromRound: (roundId: string) => void;

  // Context
  currentRoundId?: string;
  playerRoundMap: Map<string, string>;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function getRoundName(rounds: AuctionRound[], roundId?: string): string | null {
  if (!roundId) return null;
  return rounds.find((r) => r.id === roundId)?.name ?? null;
}

function getRoleColor(role?: string): string {
  const map: Record<string, string> = {
    batsman: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    bowler: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    allrounder: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    wicketkeeper: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  };
  return map[role?.toLowerCase() ?? ""] || "text-slate-400 bg-slate-500/10 border-slate-500/20";
}

function getRoleLabel(role?: string): string {
  const map: Record<string, string> = {
    batsman: "BAT",
    bowler: "BOWL",
    allrounder: "AR",
    wicketkeeper: "WK",
  };
  return map[role?.toLowerCase() ?? ""] ?? (role?.toUpperCase() ?? "—");
}

// ── Component ────────────────────────────────────────────────────────────

export function PlayerPoolTable({
  players,
  rounds,
  loading,
  error,
  searchQuery,
  onSearchChange,
  roleFilter,
  onToggleRole,
  onClearFilters,
  selectedIds,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  assigning,
  assignError,
  onAssignToRound,
  onRemoveFromRound,
  currentRoundId,
  playerRoundMap,
}: PlayerPoolTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pageSize, setPageSize] = useState(25);

  const selectedCount = selectedIds.size;

  // ── Columns ────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<Player>[]>(
    () => [
      {
        id: "select",
        header: () => (
          <Checkbox
            checked={
              players.length > 0 && players.every((p) => selectedIds.has(p.id))
                ? true
                : players.some((p) => selectedIds.has(p.id))
                ? "indeterminate"
                : false
            }
            onCheckedChange={(checked) => {
              if (checked) onSelectAll();
              else onClearSelection();
            }}
            aria-label="Select all players"
            className="border-white/20 data-[state=checked]:bg-amber-400 data-[state=checked]:text-slate-950"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.has(row.original.id)}
            onCheckedChange={() => onToggleSelection(row.original.id)}
            aria-label={`Select ${row.original.name}`}
            className="border-white/20 data-[state=checked]:bg-amber-400 data-[state=checked]:text-slate-950"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 40,
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-1 font-semibold text-slate-300 hover:text-white transition"
          >
            Player
            <ArrowUpDown className="h-3 w-3 text-slate-500" />
          </button>
        ),
        cell: ({ row }) => {
          const p = row.original;
          const assignedRoundId = playerRoundMap.get(p.id);
          const assignedRoundName = getRoundName(rounds, assignedRoundId ?? undefined);
          const isInCurrentRound = assignedRoundId === currentRoundId;

          return (
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-800 text-xs font-bold text-slate-300 ring-1 ring-white/10">
                {p.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "truncate text-sm font-semibold",
                      assignedRoundId ? "text-slate-400" : "text-white"
                    )}
                  >
                    {p.name}
                  </span>
                  {p.overseas && (
                    <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300 ring-1 ring-indigo-500/20">
                      OS
                    </span>
                  )}
                </div>
                {assignedRoundName && (
                  <span
                    className={cn(
                      "text-xs",
                      isInCurrentRound ? "text-emerald-400" : "text-slate-500"
                    )}
                  >
                    {isInCurrentRound ? "✓ In this round" : `Assigned to ${assignedRoundName}`}
                  </span>
                )}
              </div>
            </div>
          );
        },
        size: 280,
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => {
          const role = row.original.role;
          return (
            <span
              className={cn(
                "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                getRoleColor(role)
              )}
            >
              {getRoleLabel(role)}
            </span>
          );
        },
        size: 90,
      },
      {
        accessorKey: "country",
        header: "Country",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-sm text-slate-400">
            <MapPin className="h-3 w-3 text-slate-600" />
            {row.original.country || "—"}
          </div>
        ),
        size: 120,
      },
      {
        accessorKey: "age",
        header: "Age",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-sm text-slate-400">
            <Calendar className="h-3 w-3 text-slate-600" />
            {row.original.age || "—"}
          </div>
        ),
        size: 80,
      },
      {
        accessorKey: "basePrice",
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-1 font-semibold text-slate-300 hover:text-white transition"
          >
            Base Price
            <ArrowUpDown className="h-3 w-3 text-slate-500" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-1 text-sm font-semibold text-amber-300">
            <IndianRupee className="h-3 w-3" />
            {formatLakhs(row.original.basePrice)}
          </div>
        ),
        size: 120,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status;
          const styles: Record<string, string> = {
            pending: "text-slate-400 bg-slate-500/10 border-slate-500/20",
            current: "text-sky-400 bg-sky-500/10 border-sky-500/20",
            sold: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
            unsold: "text-rose-400 bg-rose-500/10 border-rose-500/20",
          };
          return (
            <span
              className={cn(
                "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                styles[status] || styles.pending
              )}
            >
              {status}
            </span>
          );
        },
        size: 100,
      },
    ],
    [selectedIds, onToggleSelection, onSelectAll, onClearSelection, playerRoundMap, rounds, currentRoundId]
  );

  const table = useReactTable({
    data: players,
    columns,
    state: { sorting, pagination: { pageIndex: 0, pageSize } },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualFiltering: true, // We filter upstream in the hook
    manualPagination: false,
  });

  const pageCount = table.getPageCount();
  const currentPage = table.getState().pagination.pageIndex;

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
        <p className="text-sm text-slate-500">Loading player pool…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <AlertCircle className="h-10 w-10 text-rose-400" />
        <p className="text-sm text-rose-400">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
          className="border-white/10 text-slate-300 hover:bg-white/5"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="space-y-3 border-b border-white/10 p-4">
        {/* Search + Stats */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Search by name or country…"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="border-white/10 bg-slate-950 pl-9 text-sm text-white placeholder:text-slate-600 focus:border-amber-400/50"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
            <Users className="h-3.5 w-3.5" />
            <span className="font-semibold text-white">{players.length}</span> players
          </div>
        </div>

        {/* Role Filter */}
        <RoleFilter
          activeRoles={roleFilter}
          onToggle={onToggleRole}
          onClear={onClearFilters}
        />
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-white/10 hover:bg-transparent"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="text-xs font-bold uppercase tracking-wider text-slate-500"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <Search className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No players match your filters.</p>
                    <button
                      onClick={onClearFilters}
                      className="text-xs text-amber-400 hover:underline"
                    >
                      Clear all filters
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const isSel = selectedIds.has(row.original.id);
                const assignedRoundId = playerRoundMap.get(row.original.id);
                const isAssigned = !!assignedRoundId;
                const isInCurrentRound = assignedRoundId === currentRoundId;

                return (
                  <TableRow
                    key={row.id}
                    data-state={isSel ? "selected" : undefined}
                    className={cn(
                      "border-white/5 transition-colors",
                      isSel
                        ? "bg-amber-400/5 hover:bg-amber-400/10"
                        : isInCurrentRound
                        ? "bg-emerald-500/5 hover:bg-emerald-500/10"
                        : isAssigned
                        ? "bg-white/[0.01] hover:bg-white/[0.03]"
                        : "hover:bg-white/[0.03]"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            Page <span className="font-semibold text-white">{currentPage + 1}</span> of{" "}
            <span className="font-semibold text-white">{pageCount}</span>
          </span>
          <Select
            value={`${pageSize}`}
            onValueChange={(v) => {
              setPageSize(Number(v));
              table.setPageSize(Number(v));
            }}
          >
            <SelectTrigger className="h-7 w-[80px] border-white/10 bg-slate-950 text-xs text-slate-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-slate-900">
              {[10, 25, 50, 100].map((s) => (
                <SelectItem key={s} value={`${s}`} className="text-xs text-slate-300">
                  {s} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 border-white/10 bg-transparent text-slate-400 hover:bg-white/5 hover:text-white"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 border-white/10 bg-transparent text-slate-400 hover:bg-white/5 hover:text-white"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 border-white/10 bg-transparent text-slate-400 hover:bg-white/5 hover:text-white"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 border-white/10 bg-transparent text-slate-400 hover:bg-white/5 hover:text-white"
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Bulk Action Bar ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/95 px-5 py-3 shadow-2xl shadow-black/50 backdrop-blur-xl"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-slate-950">
                {selectedCount}
              </div>
              <span className="text-sm font-medium text-white">
                {selectedCount === 1 ? "player selected" : "players selected"}
              </span>
            </div>

            <div className="h-4 w-px bg-white/10" />

            {currentRoundId && (
              <>
                <Button
                  size="sm"
                  onClick={() => onAssignToRound(currentRoundId)}
                  disabled={assigning}
                  className="gap-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30"
                >
                  {assigning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" />
                  )}
                  Add to Round
                </Button>

                <Button
                  size="sm"
                  onClick={() => onRemoveFromRound(currentRoundId)}
                  disabled={assigning}
                  className="gap-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30"
                >
                  {assigning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserMinus className="h-3.5 w-3.5" />
                  )}
                  Remove from Round
                </Button>
              </>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={onClearSelection}
              className="text-slate-400 hover:text-white hover:bg-white/5"
            >
              Clear
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Assignment Error ────────────────────────────────────────────── */}
      <AnimatePresence>
        {assignError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-xs text-rose-400"
          >
            {assignError}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}