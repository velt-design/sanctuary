import 'server-only';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { QuoteVersionDetail } from './types';
import { fromCents } from './utils';

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;

function formatMoneyFromCents(cents: number): string {
  return `$${fromCents(cents).toFixed(2)}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString();
}

function wrapLines(text: string, maxWidth: number, font: any, size: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }

    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, size);
      if (width <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }

  return lines;
}

export function quotePdfFilename(quoteRef: string, versionNumber: number): string {
  return `${quoteRef}-v${versionNumber}.pdf`;
}

export async function generateQuotePdfBytes(quote: QuoteVersionDetail): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 40;
  const lineGap = 4;
  const baseSize = 10;
  const titleSize = 18;
  const headingSize = 12;
  const labelSize = 9;

  let cursorY = PAGE_HEIGHT - margin;

  const ensureSpace = (heightNeeded: number) => {
    if (cursorY - heightNeeded < margin) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursorY = PAGE_HEIGHT - margin;
    }
  };

  const drawText = (text: string, x: number, size = baseSize, bold = false, color = rgb(0, 0, 0)) => {
    page.drawText(text, {
      x,
      y: cursorY,
      size,
      font: bold ? fontBold : font,
      color,
    });
  };

  // Header
  ensureSpace(80);
  drawText('Sanctuary Pergolas', margin, titleSize, true);
  drawText(`Quote ${quote.quoteRef} • v${quote.versionNumber}`, margin, headingSize, true, rgb(0.1, 0.1, 0.1));
  cursorY -= titleSize + lineGap + 6;

  const infoCols = [margin, PAGE_WIDTH / 2 + 10];
  const contactLines = [
    quote.contact.name || '—',
    quote.contact.email || '—',
    quote.contact.phone || '—',
  ];

  const projectLines = [
    quote.project.name || '—',
    quote.project.siteAddress || '—',
    quote.project.region || '—',
    quote.project.quoteRef ? `Ref: ${quote.project.quoteRef}` : '',
  ].filter(Boolean);

  ensureSpace(70);
  drawText('Contact', infoCols[0], labelSize, true, rgb(0.4, 0.4, 0.4));
  drawText('Project', infoCols[1], labelSize, true, rgb(0.4, 0.4, 0.4));
  cursorY -= labelSize + lineGap;

  const maxLines = Math.max(contactLines.length, projectLines.length);
  for (let i = 0; i < maxLines; i += 1) {
    const left = contactLines[i] ?? '';
    const right = projectLines[i] ?? '';
    drawText(left, infoCols[0]);
    drawText(right, infoCols[1]);
    cursorY -= baseSize + lineGap;
  }

  cursorY -= 6;

  // Meta
  ensureSpace(50);
  drawText('Issue date:', margin, labelSize, true, rgb(0.4, 0.4, 0.4));
  drawText(formatDate(quote.sentAt ?? null), margin + 70, baseSize);
  drawText('Expiry:', margin + 220, labelSize, true, rgb(0.4, 0.4, 0.4));
  drawText(quote.expiresAt ?? '—', margin + 270, baseSize);
  drawText('Status:', margin + 400, labelSize, true, rgb(0.4, 0.4, 0.4));
  drawText(quote.status, margin + 450, baseSize);
  cursorY -= baseSize + lineGap + 8;

  if (quote.introText) {
    const introLines = wrapLines(quote.introText, PAGE_WIDTH - margin * 2, font, baseSize);
    ensureSpace(introLines.length * (baseSize + lineGap) + 6);
    introLines.forEach((line) => {
      drawText(line, margin, baseSize);
      cursorY -= baseSize + lineGap;
    });
    cursorY -= 6;
  }

  // Line items table
  ensureSpace(40);
  drawText('Description', margin, labelSize, true, rgb(0.4, 0.4, 0.4));
  drawText('Qty', PAGE_WIDTH - 210, labelSize, true, rgb(0.4, 0.4, 0.4));
  drawText('Unit (inc GST)', PAGE_WIDTH - 160, labelSize, true, rgb(0.4, 0.4, 0.4));
  drawText('Amount', PAGE_WIDTH - 60, labelSize, true, rgb(0.4, 0.4, 0.4));
  cursorY -= labelSize + lineGap + 4;

  for (const item of quote.lineItems) {
    const descLines = wrapLines(item.description || '—', PAGE_WIDTH - margin * 2 - 220, font, baseSize);
    const rowHeight = descLines.length * (baseSize + lineGap);
    ensureSpace(rowHeight + 8);

    descLines.forEach((line) => {
      drawText(line, margin, baseSize);
      cursorY -= baseSize + lineGap;
    });

    const rowMidY = cursorY + rowHeight + lineGap - baseSize; // approximate
    const qtyText = String(item.qty);
    const unitText = formatMoneyFromCents(item.unitPriceIncGstCents);
    const amountText = formatMoneyFromCents(item.lineTotalIncGstCents);

    page.drawText(qtyText, { x: PAGE_WIDTH - 210, y: rowMidY, size: baseSize, font });
    page.drawText(unitText, { x: PAGE_WIDTH - 160, y: rowMidY, size: baseSize, font });
    page.drawText(amountText, { x: PAGE_WIDTH - 60, y: rowMidY, size: baseSize, font, color: rgb(0, 0, 0) });

    cursorY -= 4;
  }

  cursorY -= 6;

  // Totals
  ensureSpace(60);
  const totals = quote.totals;
  const totalLines = [
    { label: 'Total (inc GST)', value: formatMoneyFromCents(totals.totalIncGstCents) },
    { label: 'Total (ex GST)', value: formatMoneyFromCents(totals.totalExGstCents) },
    { label: 'GST (15%)', value: formatMoneyFromCents(totals.gstCents) },
  ];

  totalLines.forEach((line) => {
    drawText(line.label, PAGE_WIDTH - 220, baseSize, true);
    drawText(line.value, PAGE_WIDTH - 60, baseSize, true);
    cursorY -= baseSize + lineGap;
  });

  cursorY -= 10;

  if (quote.termsText) {
    ensureSpace(60);
    drawText('Terms', margin, headingSize, true);
    cursorY -= headingSize + lineGap;
    const termLines = wrapLines(quote.termsText, PAGE_WIDTH - margin * 2, font, baseSize);
    termLines.forEach((line) => {
      ensureSpace(baseSize + lineGap);
      drawText(line, margin, baseSize);
      cursorY -= baseSize + lineGap;
    });
  }

  return pdfDoc.save();
}
