import 'server-only';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { paymentDetailsLines } from '../payments/paymentDetails';

type DepositInvoicePdfData = {
  invoiceRef: string;
  quoteRef: string;
  quoteVersionNumber: number;
  customerName: string | null;
  projectName: string | null;
  projectAddress: string | null;
  issueDate: string;
  dueDate: string;
  depositPercent: number;
  quoteTotalIncGstCents: number;
  totalIncGstCents: number;
  totalExGstCents: number;
  gstCents: number;
};

const MONEY = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(cents: number): string {
  const amount = Number.isFinite(cents) ? cents / 100 : 0;
  return MONEY.format(amount);
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Pacific/Auckland',
  }).format(parsed);
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function depositInvoicePdfFilename(invoiceRef: string): string {
  return `${invoiceRef}.pdf`;
}

export async function generateDepositInvoicePdfBytes(data: DepositInvoicePdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const paymentLines = paymentDetailsLines('invoice');

  const left = 48;
  const right = 547;
  const footerY = 54;
  const paymentBottomY = 96;
  const paymentLineHeight = 13;
  const paymentTopY = paymentBottomY + paymentLineHeight * Math.max(paymentLines.length - 1, 0);
  const paymentDividerY = paymentTopY + 12;
  let y = 790;

  const draw = (text: string, opts?: { size?: number; bold?: boolean; x?: number; color?: ReturnType<typeof rgb> }) => {
    const size = opts?.size ?? 11;
    page.drawText(text, {
      x: opts?.x ?? left,
      y,
      size,
      font: opts?.bold ? fontBold : font,
      color: opts?.color ?? rgb(0.12, 0.12, 0.12),
    });
  };

  const drawPair = (label: string, value: string) => {
    page.drawText(label, { x: left, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
    const width = fontBold.widthOfTextAtSize(value, 10);
    page.drawText(value, { x: right - width, y, size: 10, font: fontBold, color: rgb(0.12, 0.12, 0.12) });
    y -= 16;
  };

  draw('Sanctuary Pergolas', { size: 11, bold: true, color: rgb(0.5, 0.2, 0.18) });
  y -= 22;
  draw('Deposit Invoice', { size: 24, bold: true });
  y -= 24;

  drawPair('Invoice number', data.invoiceRef);
  drawPair('Quote', `${data.quoteRef} v${data.quoteVersionNumber}`);
  drawPair('Issue date', formatDate(data.issueDate));
  drawPair('Due date', formatDate(data.dueDate));

  y -= 10;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: rgb(0.84, 0.84, 0.84) });
  y -= 20;

  draw('Bill to', { size: 10, bold: true, color: rgb(0.4, 0.4, 0.4) });
  y -= 14;
  draw(data.customerName?.trim() || 'Customer', { size: 12, bold: true });
  y -= 16;
  if (data.projectName?.trim()) {
    draw(data.projectName.trim(), { size: 10 });
    y -= 14;
  }
  if (data.projectAddress?.trim()) {
    draw(data.projectAddress.trim(), { size: 10 });
    y -= 14;
  }

  y -= 12;
  draw('Invoice items', { size: 10, bold: true, color: rgb(0.4, 0.4, 0.4) });
  y -= 14;

  page.drawRectangle({ x: left, y: y - 36, width: right - left, height: 36, borderColor: rgb(0.88, 0.88, 0.88), borderWidth: 1 });
  const itemLabel = `Deposit for quote ${data.quoteRef} v${data.quoteVersionNumber} (${clampPercent(data.depositPercent).toFixed(2).replace(/\.00$/, '')}%)`;
  page.drawText(itemLabel, { x: left + 10, y: y - 22, size: 10, font, color: rgb(0.12, 0.12, 0.12) });
  const itemAmount = formatMoney(data.totalIncGstCents);
  const itemAmountWidth = fontBold.widthOfTextAtSize(itemAmount, 10);
  page.drawText(itemAmount, { x: right - itemAmountWidth - 10, y: y - 22, size: 10, font: fontBold, color: rgb(0.12, 0.12, 0.12) });
  y -= 56;

  drawPair('Source quote total (incl. GST)', formatMoney(data.quoteTotalIncGstCents));
  drawPair('Subtotal (excl. GST)', formatMoney(data.totalExGstCents));
  drawPair('GST (15%)', formatMoney(data.gstCents));

  y -= 4;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: rgb(0.78, 0.78, 0.78) });
  y -= 18;

  const totalLabel = 'Amount due (incl. GST)';
  const totalValue = formatMoney(data.totalIncGstCents);
  page.drawText(totalLabel, { x: left, y, size: 12, font: fontBold, color: rgb(0.12, 0.12, 0.12) });
  const totalWidth = fontBold.widthOfTextAtSize(totalValue, 12);
  page.drawText(totalValue, { x: right - totalWidth, y, size: 12, font: fontBold, color: rgb(0.12, 0.12, 0.12) });

  page.drawLine({
    start: { x: left, y: paymentDividerY },
    end: { x: right, y: paymentDividerY },
    thickness: 1,
    color: rgb(0.9, 0.9, 0.9),
  });

  let paymentY = paymentTopY;
  for (const line of paymentLines) {
    page.drawText(line, { x: left, y: paymentY, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
    paymentY -= paymentLineHeight;
  }

  page.drawLine({ start: { x: left, y: 68 }, end: { x: right, y: 68 }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
  page.drawText('sanctuarypergolas.co.nz', { x: left, y: footerY, size: 9, font, color: rgb(0.45, 0.45, 0.45) });
  const email = 'info@sanctuarypergolas.co.nz';
  const emailWidth = font.widthOfTextAtSize(email, 9);
  page.drawText(email, { x: right - emailWidth, y: footerY, size: 9, font, color: rgb(0.45, 0.45, 0.45) });

  return pdf.save();
}
