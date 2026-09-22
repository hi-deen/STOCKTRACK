// Same threshold the mobile app warns at — a single huge HTML table is slow
// to lay out and print in any renderer.
export const PDF_ROW_WARNING_THRESHOLD = 750;

// Web equivalent of the native PDF export: render the report HTML in a hidden
// iframe and open the browser's print dialog, where "Save as PDF" is offered.
export async function exportHtmlAsPdf(html: string, filename: string): Promise<void> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    throw new Error('Could not generate the PDF.');
  }

  doc.open();
  doc.write(html);
  doc.title = filename.replace(/\.pdf$/i, '');
  doc.close();

  await new Promise<void>((resolve) => {
    setTimeout(resolve, 250);
  });

  win.focus();
  win.print();
  setTimeout(() => iframe.remove(), 60_000);
}
