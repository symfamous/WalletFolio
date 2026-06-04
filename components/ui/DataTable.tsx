import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface Column<Row> {
  /** Header label */
  header: ReactNode;
  /** Cell renderer */
  cell: (row: Row, index: number) => ReactNode;
  /** Optional alignment (default left) */
  align?: "left" | "right" | "center";
  /** Optional fixed/relative width class, e.g. "w-32" */
  className?: string;
  /** Optional header-only class */
  headerClassName?: string;
}

interface DataTableProps<Row> {
  columns: Column<Row>[];
  rows: Row[];
  /** Stable key extractor */
  rowKey: (row: Row, index: number) => string | number;
  /** Optional per-row click handler */
  onRowClick?: (row: Row, index: number) => void;
  /** Shown when rows is empty */
  empty?: ReactNode;
  className?: string;
}

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

/**
 * Linear-style table: uppercase muted header, hairline row separators,
 * NO zebra striping. Hover tints the row via surface-raised.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  className,
}: DataTableProps<Row>) {
  if (rows.length === 0 && empty) {
    return <div className="py-10 text-center text-sm text-text-lo">{empty}</div>;
  }

  return (
    <table className={cn("w-full border-collapse", className)}>
      <thead>
        <tr className="border-b border-border">
          {columns.map((col, i) => (
            <th
              key={i}
              className={cn(
                "px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-text-lo",
                alignClass[col.align ?? "left"],
                col.headerClassName ?? col.className
              )}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr
            key={rowKey(row, rowIndex)}
            onClick={onRowClick ? () => onRowClick(row, rowIndex) : undefined}
            className={cn(
              "border-b border-border last:border-0",
              onRowClick && "cursor-pointer transition-colors hover:bg-surface-raised"
            )}
          >
            {columns.map((col, colIndex) => (
              <td
                key={colIndex}
                className={cn(
                  "px-3 py-2.5 text-sm text-text-mid",
                  alignClass[col.align ?? "left"],
                  col.className
                )}
              >
                {col.cell(row, rowIndex)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
