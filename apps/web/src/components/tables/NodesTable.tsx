'use client';

import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, ChevronsUpDown, ExternalLink, CheckCircle, XCircle, AlertCircle, Shield, MapPin } from 'lucide-react';
import type { NodeWithProfile } from '@atlasp2p/types';
import { getThemeConfig, getChainConfig } from '@/config';

interface NodesTableProps {
  nodes: NodeWithProfile[];
  onNodeClick?: (node: NodeWithProfile) => void;
}

export function NodesTable({ nodes, onNodeClick }: NodesTableProps) {
  const theme = getThemeConfig();
  const chainConfig = getChainConfig();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 15,
  });

  const columns = useMemo<ColumnDef<NodeWithProfile>[]>(
    () => [
      {
        accessorKey: 'ip',
        header: 'Node',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNodeClick?.(row.original)}
              className="font-mono text-sm hover:text-primary transition-colors"
              title="View details"
            >
              {row.original.ip}
              {row.original.port !== chainConfig.p2pPort && `:${row.original.port}`}
            </button>
            <span title={
              row.original.status === 'up' ? 'Online' :
              row.original.status === 'reachable' ? 'Reachable (TCP only)' :
              'Offline'
            }>
              {row.original.status === 'up' ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : row.original.status === 'reachable' ? (
                <AlertCircle className="h-4 w-4 text-warning" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'displayName',
        header: 'Name',
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground max-w-xs truncate">
            {row.original.displayName || '—'}
          </div>
        ),
      },
      {
        accessorKey: 'version',
        header: 'User Agent',
        cell: ({ row }) => (
          <div className="font-mono text-xs">
            {row.original.version || 'Unknown'}
          </div>
        ),
      },
      {
        accessorKey: 'startHeight',
        header: 'Height',
        cell: ({ row }) => (
          <div className="text-sm tabular-nums">
            {row.original.startHeight?.toLocaleString() || '—'}
          </div>
        ),
      },
      {
        accessorKey: 'location',
        header: 'Location',
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm">
              {row.original.countryName || 'Unknown'}
              {row.original.city && `, ${row.original.city}`}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'tier',
        header: 'Tier',
        cell: ({ row }) => {
          const tier = row.original.tier || 'standard';
          const tierConfig = {
            diamond: { emoji: '💎', label: 'Diamond', color: 'hsl(var(--chart-1))' },
            gold: { emoji: '🥇', label: 'Gold', color: 'hsl(var(--warning))' },
            silver: { emoji: '🥈', label: 'Silver', color: 'hsl(var(--muted-foreground))' },
            bronze: { emoji: '🥉', label: 'Bronze', color: 'hsl(var(--chart-3))' },
            standard: { emoji: '○', label: 'Standard', color: theme.primaryColor },
          };
          const config = tierConfig[tier as keyof typeof tierConfig] || tierConfig.standard;

          return (
            <div className="flex items-center gap-1.5">
              <span>{config.emoji}</span>
              <span className="text-xs font-semibold" style={{ color: config.color }}>
                {config.label}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'verified',
        header: 'Verified',
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            {row.original.isVerified ? (
              <span title="Verified">
                <Shield className="h-4 w-4 text-success" />
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <button
            onClick={() => onNodeClick?.(row.original)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            Details
            <ExternalLink className="h-3 w-3" />
          </button>
        ),
      },
    ],
    [theme, onNodeClick]
  );

  const table = useReactTable({
    data: nodes,
    columns,
    state: {
      sorting,
      columnFilters,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const totalPages = table.getPageCount();
  const currentPage = pagination.pageIndex + 1;

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="relative overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {header.isPlaceholder ? null : (
                        <button
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {header.column.getCanSort() && (
                            <span className="text-muted-foreground">
                              {header.column.getIsSorted() === 'asc' ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : header.column.getIsSorted() === 'desc' ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronsUpDown className="h-4 w-4 opacity-50" />
                              )}
                            </span>
                          )}
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-border">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-muted/30 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-sm">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {table.getRowModel().rows.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No nodes found matching your filters.
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{pagination.pageIndex * pagination.pageSize + 1}</span> to{' '}
          <span className="font-semibold text-foreground">
            {Math.min((pagination.pageIndex + 1) * pagination.pageSize, nodes.length)}
          </span>{' '}
          of <span className="font-semibold text-foreground">{nodes.length}</span> nodes
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            First
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>

          <span className="text-sm text-muted-foreground">
            Page <span className="font-semibold text-foreground">{currentPage}</span> of{' '}
            <span className="font-semibold text-foreground">{totalPages}</span>
          </span>

          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
          <button
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Last
          </button>
        </div>
      </div>
    </div>
  );
}
