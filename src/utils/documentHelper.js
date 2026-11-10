/**
 * Document & OCR Helper Utilities
 */

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_FILE_COUNT = 5;

/**
 * Format bytes to human readable string (KB, MB)
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Split markdown into page array based on Datalab result:
 * - If result.pages is array: use it
 * - If result.markdown contains \f (form feed): split by \f
 * - Otherwise single page or split by hr
 */
export function extractPagesFromOcrResult(ocrResult) {
  if (!ocrResult) return [];

  // Check if Datalab returned structured pages array
  if (Array.isArray(ocrResult.pages) && ocrResult.pages.length > 0) {
    return ocrResult.pages.map((p, idx) => ({
      pageNumber: p.page ?? p.page_number ?? idx + 1,
      markdown: (p.markdown ?? p.text ?? '').trim(),
    }));
  }

  const rawMarkdown = ocrResult.markdown || '';
  if (!rawMarkdown) return [];

  // Form feed '\f' is standard page break in Marker/Datalab
  if (rawMarkdown.includes('\f')) {
    const rawPages = rawMarkdown.split('\f');
    const validPages = [];
    rawPages.forEach((text, idx) => {
      const clean = text.trim();
      if (clean || rawPages.length === 1) {
        validPages.push({
          pageNumber: idx + 1,
          markdown: clean,
        });
      }
    });
    if (validPages.length > 0) return validPages;
  }

  // Fallback: check for horizontal rule breaks "---" or "___" with page headers
  return [
    {
      pageNumber: 1,
      markdown: rawMarkdown.trim(),
    },
  ];
}

/**
 * Build the full markdown document context for LLM consumption
 */
export function buildDocumentsContext(preparedDocuments) {
  if (!preparedDocuments || preparedDocuments.length === 0) {
    return '';
  }

  return preparedDocuments
    .map((doc, docIdx) => {
      const pages = doc.pages && doc.pages.length > 0 ? doc.pages : [{ pageNumber: 1, markdown: doc.markdown || '' }];
      const pagesText = pages
        .map((p) => `--- TRANG ${p.pageNumber} ---\n${p.markdown}`)
        .join('\n\n');

      return `========================================================\nTÀI LIỆU #${docIdx + 1}: ${doc.name} (Tổng cộng: ${pages.length} trang)\n========================================================\n${pagesText}`;
    })
    .join('\n\n\n');
}

/**
 * Regex to detect citations in assistant response
 * e.g. [hop_dong.pdf, Trang 2] or [file.png, Trang 1] or [file, Page 3]
 */
export const CITATION_REGEX = /\[([^[\s\]\n\r,]+?),\s*(?:Trang|trang|Page|page)\s*(\d+)\]/g;
