// Web equivalent of the native share sheet: use the Web Share API for files
// on touch devices that support it, otherwise trigger a normal download.
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function shareBlob(blob: Blob, filename: string, mimeType: string): Promise<void> {
  const file = new File([blob], filename, { type: mimeType });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
    }
  }
  downloadBlob(blob, filename);
}

export async function shareTextFile(
  filename: string,
  content: string,
  mimeType: string
): Promise<void> {
  await shareBlob(new Blob([content], { type: mimeType }), filename, mimeType);
}
