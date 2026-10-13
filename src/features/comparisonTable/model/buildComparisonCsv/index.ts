import { FORMULA_TRIGGERS } from "../../constants";
import type { ComparisonTable } from "../../types";

/**
 * Writes one CSV field (RFC 4180): a field a spreadsheet would evaluate is
 * prefixed with a quote mark first, then a field with a quote, comma or line
 * break is quoted, its quotes doubled.
 */
const writeField = (text: string): string => {
  const safe = FORMULA_TRIGGERS.some((trigger) => text.startsWith(trigger)) ? `'${text}` : text;

  return /[",\r\n]/u.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

/**
 * Writes the table as CSV (REQ-SYN-007): the entity, then each column's value
 * — noting a conflict — and a column of that cell's source URLs. Lines end in
 * CRLF and the text starts with a byte-order mark, so spreadsheets read
 * non-Latin text correctly.
 */
export const buildComparisonCsv = (table: Pick<ComparisonTable, "columns" | "rows">): string => {
  const header = ["Entity", ...table.columns.flatMap(({ label }) => [label, `${label} sources`])];
  const lines = table.rows.map((row) => [
    row.name,
    ...table.columns.flatMap(({ key }) => {
      const cell = row.cells[key];

      if (cell === undefined) {
        return ["", ""];
      }

      const urls = [
        ...new Set(cell.groups.flatMap(({ sources }) => sources.map(({ url }) => url))),
      ];

      return [
        cell.isConflict ? `${cell.value} (conflict: ${cell.groups.length} values)` : cell.value,
        urls.join(" "),
      ];
    }),
  ]);

  return `﻿${[header, ...lines].map((line) => line.map(writeField).join(",")).join("\r\n")}\r\n`;
};
