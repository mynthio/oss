import { print } from "./print.ts";

export type Column<Row> = {
  readonly header: string;
  readonly value: (row: Row) => string;
};

/**
 * Renders left-aligned, space-padded columns. The last column is never padded,
 * so trailing whitespace never ends up in piped output.
 */
export const printTable = <Row>(
  rows: ReadonlyArray<Row>,
  columns: ReadonlyArray<Column<Row>>,
  emptyMessage: string,
): void => {
  if (rows.length === 0) {
    print(emptyMessage);
    return;
  }

  const cells = rows.map((row) => columns.map((column) => column.value(row)));
  const widths = columns.map((column, index) =>
    Math.max(column.header.length, ...cells.map((cell) => cell[index]!.length)),
  );

  const line = (values: ReadonlyArray<string>) =>
    values
      .map((value, index) => (index === values.length - 1 ? value : value.padEnd(widths[index]!)))
      .join("  ");

  print(line(columns.map((column) => column.header)));
  for (const cell of cells) print(line(cell));
};
