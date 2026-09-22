// RFC 4180-style CSV: any field containing a comma, double quote, or
// newline is wrapped in double quotes, with internal double quotes doubled.
function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) =>
    row.map((cell) => escapeCsvField(String(cell))).join(',')
  );
  // CRLF per RFC 4180.
  return lines.join('\r\n');
}
