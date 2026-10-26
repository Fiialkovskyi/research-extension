import { describePageSource } from "@/shared/describePageSource";
import { Button } from "@/shared/ui";

import type { ComparisonCell, ComparisonTable as Table } from "../../types";

export interface ComparisonTableProps {
  table: Table;
  /** Shows the table of another type. */
  onChooseType: (entityType: string) => void;
  /** Replaces the type's columns, by attribute key; an empty list returns to the proposal. */
  onSetColumns: (entityType: string, columns: string[]) => void;
  onExport: () => void;
  /** Marks the facts behind a value wrong (REQ-LIN-008). */
  onReject: (factIds: string[]) => void;
  /** Undoes every rejection of the session. */
  onRestore: () => void;
}

/** How many values were marked wrong, and the way back. */
function Rejected({ count, onRestore }: { count: number; onRestore: () => void }) {
  return count === 0 ? null : (
    <p data-testid="table-rejected" className="mt-1 flex items-center gap-2 text-xs">
      {count} {count === 1 ? "value" : "values"} marked wrong
      <Button data-testid="table-restore" onClick={onRestore}>
        Restore all
      </Button>
    </p>
  );
}

/** One cell: the chosen value, its alternatives or conflict, and every value with its sources. */
function Cell({
  cell,
  onReject,
}: {
  cell: ComparisonCell | undefined;
  onReject: (factIds: string[]) => void;
}) {
  if (cell === undefined) {
    return (
      <td
        data-testid="table-cell"
        className="border border-neutral-200 p-1 dark:border-neutral-800"
      />
    );
  }

  return (
    <td
      data-testid="table-cell"
      data-conflict={cell.isConflict}
      className={`border border-neutral-200 p-1 align-top dark:border-neutral-800 ${
        cell.isConflict ? "bg-amber-50 dark:bg-amber-950" : ""
      }`}
    >
      <details>
        <summary className="cursor-pointer">
          {cell.value}
          {cell.isConflict && (
            <span
              data-testid="table-conflict"
              className="ml-1 text-xs font-medium text-amber-700 dark:text-amber-400"
            >
              conflict
            </span>
          )}
          {cell.alternativeCount > 0 && (
            <span className="ml-1 text-xs text-neutral-500 dark:text-neutral-400">
              +{cell.alternativeCount}
            </span>
          )}
        </summary>
        <ul className="mt-1 flex flex-col gap-1 text-xs">
          {cell.groups.map((group) => (
            <li key={group.value} data-testid="table-value">
              <span className="font-medium">{group.value}</span>
              {group.isNewest === true && (
                <>
                  {" "}
                  <span
                    data-testid="table-newest"
                    className="rounded bg-neutral-200 px-1 text-xs dark:bg-neutral-800"
                  >
                    newest source
                  </span>
                </>
              )}{" "}
              <button
                type="button"
                data-testid="table-reject"
                className="cursor-pointer text-xs text-red-700 underline dark:text-red-400"
                onClick={() => {
                  onReject(group.sources.map(({ factId }) => factId));
                }}
              >
                Wrong
              </button>
              <ul>
                {group.sources.map((source) => (
                  <li key={source.factId}>
                    <a href={source.url} target="_blank" rel="noreferrer" className="underline">
                      {source.pageTitle}
                    </a>
                    {describePageSource(source) !== "" && (
                      <span
                        data-testid="table-source-details"
                        className="text-neutral-500 dark:text-neutral-400"
                      >
                        {" "}
                        ({describePageSource(source)})
                      </span>
                    )}
                    : <q>{source.quote}</q>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </details>
    </td>
  );
}

/**
 * The comparison table (REQ-SYN-005..007): one row per entity of the chosen
 * type, one column per attribute, each cell expandable to its values and
 * sources, conflicts marked; columns can be removed and added, and the table
 * exported. Takes no client, so a sidebar can host it as the page does.
 */
export function ComparisonTable({
  table,
  onChooseType,
  onSetColumns,
  onExport,
  onReject,
  onRestore,
}: ComparisonTableProps) {
  const { entityType } = table;

  if (entityType === null) {
    return (
      <section aria-labelledby="table-heading" className="mt-6">
        <h2 id="table-heading" className="text-lg font-semibold">
          Comparison
        </h2>
        <p data-testid="table-empty" className="mt-1 text-sm">
          No entities with facts yet.
        </p>
        <Rejected count={table.rejectedCount} onRestore={onRestore} />
      </section>
    );
  }

  const keys = table.columns.map(({ key }) => key);

  return (
    <section aria-labelledby="table-heading" className="mt-6">
      <header className="flex flex-wrap items-center gap-3">
        <h2 id="table-heading" className="text-lg font-semibold">
          Comparison
        </h2>
        <label className="flex items-center gap-1 text-sm">
          Of
          <select
            data-testid="table-type"
            value={entityType}
            onChange={(event) => {
              onChooseType(event.target.value);
            }}
            className="rounded border border-slate-300 bg-transparent px-1 dark:border-slate-600"
          >
            {table.types.map(({ type, rowCount }) => (
              <option key={type} value={type}>
                {type} ({rowCount})
              </option>
            ))}
          </select>
        </label>
        {table.otherColumns.length > 0 && (
          <label className="flex items-center gap-1 text-sm">
            Add column
            <select
              data-testid="table-add-column"
              value=""
              onChange={(event) => {
                onSetColumns(entityType, [...keys, event.target.value]);
              }}
              className="rounded border border-slate-300 bg-transparent px-1 dark:border-slate-600"
            >
              <option value="" disabled>
                choose…
              </option>
              {table.otherColumns.map(({ key, label }) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <Button data-testid="table-export" onClick={onExport}>
          Export CSV
        </Button>
      </header>
      <Rejected count={table.rejectedCount} onRestore={onRestore} />
      <div className="mt-2 overflow-x-auto">
        <table data-testid="comparison-table" className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-neutral-200 p-1 text-left dark:border-neutral-800">
                {entityType}
              </th>
              {table.columns.map(({ key, label }) => (
                <th
                  key={key}
                  data-testid="table-column"
                  className="border border-neutral-200 p-1 text-left dark:border-neutral-800"
                >
                  {label}{" "}
                  <button
                    type="button"
                    data-testid="table-remove-column"
                    aria-label={`Remove the column ${label}`}
                    className="cursor-pointer text-xs text-neutral-500"
                    onClick={() => {
                      onSetColumns(
                        entityType,
                        keys.filter((other) => other !== key),
                      );
                    }}
                  >
                    ✕
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.entityId} data-testid="table-row">
                <th className="border border-neutral-200 p-1 text-left font-medium dark:border-neutral-800">
                  {row.name}
                </th>
                {table.columns.map(({ key }) => (
                  <Cell key={key} cell={row.cells[key]} onReject={onReject} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
