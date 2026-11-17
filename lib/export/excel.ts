type ExcelColumn = {
  header: string;
  key: string;
  width?: number;
};

function safeCellValue(value: unknown) {
  if (typeof value !== "string") return value ?? "";
  return /^[\t\r ]*[=+@-]/.test(value) ? `'${value}` : value;
}

export async function downloadExcel(options: {
  filename: string;
  worksheetName: string;
  columns: ExcelColumn[];
  rows: Array<Record<string, unknown>>;
}) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ACAV Cursos";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(options.worksheetName);
  worksheet.columns = options.columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width || Math.min(Math.max(column.header.length + 4, 14), 36),
  }));
  worksheet.addRows(
    options.rows.map((row) =>
      Object.fromEntries(options.columns.map((column) => [column.key, safeCellValue(row[column.key])]))
    )
  );
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2356B8" } };
  header.alignment = { vertical: "middle" };
  header.height = 24;

  if (options.columns.length && options.rows.length) {
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: options.rows.length + 1, column: options.columns.length },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = options.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function datedExcelFilename(name: string) {
  const date = new Date().toISOString().slice(0, 10);
  return `${name}-${date}.xlsx`;
}
