function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface ReportHtmlSection {
  heading: string;
  rows: (string | number)[][];
}

interface ReportHtmlOptions {
  title: string;
  subtitle?: string;
  statCards?: { label: string; value: string }[];
  columns: string[];
  rows: (string | number)[][];
  // When given, takes precedence over `rows` — renders each section under
  // its own full-width heading row instead of one flat table body. Used by
  // the Shop directory export to group by area; Reports/Activity Log don't
  // pass this and keep their existing flat-table rendering untouched.
  sections?: ReportHtmlSection[];
  generatedAt: string;
}

// Uses the app's light-mode navy tokens directly rather than the theme
// system — a PDF is a fixed, printed medium with no dark-mode viewer, so
// there's nothing to make theme-aware here.
export function buildReportHtml(options: ReportHtmlOptions): string {
  const { title, subtitle, statCards, columns, rows, sections, generatedAt } = options;

  const statsHtml = statCards?.length
    ? `<div class="stats">${statCards
        .map(
          (c) =>
            `<div class="stat"><div class="stat-label">${escapeHtml(c.label)}</div><div class="stat-value">${escapeHtml(c.value)}</div></div>`
        )
        .join('')}</div>`
    : '';

  function renderRows(dataRows: (string | number)[][]): string {
    return dataRows
      .map(
        (row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join('')}</tr>`
      )
      .join('');
  }

  const tableRows =
    sections && sections.length > 0
      ? sections
          .map(
            (section) =>
              `<tr><td class="section-heading" colspan="${columns.length}">${escapeHtml(section.heading)}</td></tr>${renderRows(section.rows)}`
          )
          .join('')
      : renderRows(rows);

  return `
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #0F1B2D; padding: 24px; }
      h1 { font-size: 22px; margin: 0 0 4px; }
      .subtitle { color: #5A6B82; font-size: 13px; margin-bottom: 16px; }
      .stats { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
      .stat { background: #F5F7FA; border: 1px solid #DCE3EC; border-radius: 8px; padding: 10px 14px; min-width: 120px; }
      .stat-label { font-size: 10px; color: #5A6B82; text-transform: uppercase; letter-spacing: 0.04em; }
      .stat-value { font-size: 16px; font-weight: 700; margin-top: 2px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { text-align: left; background: #1D4E89; color: #FFFFFF; padding: 6px 8px; }
      td { padding: 6px 8px; border-bottom: 1px solid #DCE3EC; }
      tr:nth-child(even) td { background: #F5F7FA; }
      td.section-heading { background: #E4ECF5; color: #1D4E89; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
      .footer { margin-top: 16px; font-size: 9px; color: #5A6B82; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ''}
    ${statsHtml}
    <table>
      <thead><tr>${columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
    <div class="footer">Generated ${escapeHtml(generatedAt)}</div>
  </body>
</html>
`;
}
