export function sanitizeCsvValue(v: any): string {
  let s = v == null ? "" : String(v);
  s = s.replace(/"/g, '""');
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (s.includes(",") || s.includes('"') || s.includes("\n")) s = `"${s}"`;
  return s;
}
export function toCsv(headers: string[], rows: any[][]): string {
  const h = headers.map(sanitizeCsvValue).join(",");
  const r = rows.map((row) => row.map(sanitizeCsvValue).join(",")).join("\n");
  return h + "\n" + r;
}
export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` } });
}
