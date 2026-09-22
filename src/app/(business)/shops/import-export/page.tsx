'use client';

import { useRef, useState } from 'react';

import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { useToast } from '@/components/toast';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { exportHtmlAsPdf } from '@/lib/pdf-export';
import { buildReportHtml } from '@/lib/pdf-templates';
import { shareTextFile } from '@/lib/share-file';
import { exportShops, importShops, listShops } from '@/lib/shops-api';

export default function ImportExportPage() {
  const { activeBusinessId, activeMembership } = useBusinessAuth();
  const toast = useToast();
  const isOwner = activeMembership?.role === 'owner';
  const fileInput = useRef<HTMLInputElement>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  async function handleExport() {
    if (!activeBusinessId || isExporting) return;
    setExportError(null);
    setIsExporting(true);
    try {
      const data = await exportShops(activeBusinessId);
      await shareTextFile(`shops-export-${Date.now()}.json`, JSON.stringify(data, null, 2), 'application/json');
    } catch (err) {
      setExportError(getErrorMessage(err, 'Could not export shops.'));
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportPdf() {
    if (!activeBusinessId || isExportingPdf) return;
    setExportPdfError(null);
    setIsExportingPdf(true);
    try {
      const shops = await listShops(activeBusinessId);

      // Grouped by area, matching the Shops list; "Other" always sorts last.
      const groups = new Map<string, typeof shops>();
      for (const shop of shops) {
        const key = shop.area?.trim() || 'Other';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(shop);
      }
      const sortedAreas = Array.from(groups.keys()).sort((a, b) => {
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;
        return a.localeCompare(b);
      });

      const html = buildReportHtml({
        title: 'Shop directory',
        subtitle: `${shops.length} shop${shops.length === 1 ? '' : 's'} across ${sortedAreas.length} area${sortedAreas.length === 1 ? '' : 's'}`,
        columns: ['Name', 'Owner', 'Phone', 'Address'],
        rows: [],
        sections: sortedAreas.map((area) => ({
          heading: area,
          rows: groups.get(area)!.map((s) => [s.name, s.owner_name ?? '', s.phone ?? '', s.address ?? '']),
        })),
        generatedAt: new Date().toLocaleString(),
      });
      await exportHtmlAsPdf(html, 'shop-directory.pdf');
    } catch (err) {
      setExportPdfError(getErrorMessage(err, 'Could not export a PDF.'));
    } finally {
      setIsExportingPdf(false);
    }
  }

  async function handleFile(file: File) {
    if (!activeBusinessId || isImporting) return;
    setImportError(null);
    setImportResult(null);
    setIsImporting(true);
    try {
      const parsed = JSON.parse(await file.text());
      const result = await importShops(activeBusinessId, parsed);
      setImportResult({ imported: result.imported, skipped: result.skipped });
      toast.show('Import complete');
    } catch (err) {
      setImportError(getErrorMessage(err, 'Could not import that file. Make sure it is valid JSON.'));
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <>
      <ScreenHeader back title="Import / Export" />
      <Page narrow>
        <SectionLabel>Export</SectionLabel>
        <p className="text-muted">Share your active shops as a JSON file.</p>
        <PrimaryButton label="Export shops (JSON)" onClick={handleExport} loading={isExporting} />
        {exportError ? <MessageBox tone="danger" message={exportError} /> : null}

        <p className="text-muted">Or export a printable directory.</p>
        <PrimaryButton label="Export as PDF" variant="outline" onClick={handleExportPdf} loading={isExportingPdf} />
        {exportPdfError ? <MessageBox tone="danger" message={exportPdfError} /> : null}

        {isOwner ? (
          <>
            <SectionLabel className="pt-4">Import</SectionLabel>
            <p className="text-muted">
              Pick a JSON file in the same format as an export. Shops with a name that already exists are skipped.
            </p>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = '';
              }}
            />
            <PrimaryButton
              label="Choose file to import"
              variant="outline"
              onClick={() => fileInput.current?.click()}
              loading={isImporting}
            />
            {importError ? <MessageBox tone="danger" message={importError} /> : null}
            {importResult ? (
              <MessageBox tone="success" message={`Imported ${importResult.imported}, skipped ${importResult.skipped}.`} />
            ) : null}
          </>
        ) : (
          <MessageBox tone="neutral" message="Only business owners can import shops." />
        )}
      </Page>
    </>
  );
}
