'use client';

import type {
  FinancialReportExport,
  MovementExportRow,
  PolizaExportRow,
  UnitStatementExport,
} from '@veka/shared';
import {
  buildFinancialReportCsv,
  buildMovementsCsv,
  buildPolizaCsv,
  buildUnitStatementCsv,
  formatExportAmount,
  sanitizeExportFilename,
} from '@veka/shared';

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadFinancialReportCsv(report: FinancialReportExport): void {
  const slug = sanitizeExportFilename(`${report.condominiumName}-${report.periodLabel}`);
  downloadCsv(`reporte-financiero-${slug}.csv`, buildFinancialReportCsv(report));
}

export function downloadUnitStatementCsv(statement: UnitStatementExport): void {
  const slug = sanitizeExportFilename(`${statement.condominiumName}-${statement.unitIdentifier}`);
  downloadCsv(`estado-cuenta-${slug}.csv`, buildUnitStatementCsv(statement));
}

export function downloadMovementsCsv(
  meta: { condominiumName: string; scopeLabel: string; generatedAt: string },
  movements: MovementExportRow[],
): void {
  const slug = sanitizeExportFilename(`${meta.condominiumName}-${meta.scopeLabel}`);
  downloadCsv(`movimientos-${slug}.csv`, buildMovementsCsv(meta, movements));
}

export function downloadPolizaCsv(
  meta: { condominiumName: string; periodLabel: string; generatedAt: string },
  rows: PolizaExportRow[],
): void {
  const slug = sanitizeExportFilename(`${meta.condominiumName}-${meta.periodLabel}`);
  downloadCsv(`poliza-contable-${slug}.csv`, buildPolizaCsv(meta, rows));
}

async function loadPdfLibs() {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  return { jsPDF, autoTable };
}

function addSectionTitle(doc: import('jspdf').jsPDF, title: string, y: number): number {
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, y);
  return y + 4;
}

function hexToRgb(hex: string | null | undefined, fallback: [number, number, number]): [number, number, number] {
  if (!hex) return fallback;
  const normalized = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function imageFormatFromDataUrl(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
  if (dataUrl.startsWith('data:image/jpeg')) return 'JPEG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'PNG';
}

async function loadHtmlImage(dataUrl: string): Promise<HTMLImageElement | null> {
  if (typeof Image === 'undefined') return null;
  return await new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

async function getImageNaturalSize(dataUrl: string): Promise<{ width: number; height: number } | null> {
  const image = await loadHtmlImage(dataUrl);
  if (!image) return null;
  return { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height };
}

/** Knock out near-white logo backgrounds so they sit cleanly on the brand header. */
async function knockOutNearWhiteBackground(dataUrl: string, threshold = 245): Promise<string> {
  if (typeof document === 'undefined') return dataUrl;
  const image = await loadHtmlImage(dataUrl);
  if (!image) return dataUrl;

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return dataUrl;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    if (r >= threshold && g >= threshold && b >= threshold) {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

/** Fit image into a box preserving aspect ratio; returns centered draw rect. */
function fitImageInBox(
  naturalWidth: number,
  naturalHeight: number,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
): { x: number; y: number; w: number; h: number } {
  const ratio = naturalWidth / Math.max(naturalHeight, 1);
  let w = boxW;
  let h = w / ratio;
  if (h > boxH) {
    h = boxH;
    w = h * ratio;
  }
  return {
    x: boxX + (boxW - w) / 2,
    y: boxY + (boxH - h) / 2,
    w,
    h,
  };
}

async function addFittedImage(
  doc: import('jspdf').jsPDF,
  dataUrl: string,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
): Promise<boolean> {
  const size = await getImageNaturalSize(dataUrl);
  if (!size || size.width <= 0 || size.height <= 0) return false;
  const fitted = fitImageInBox(size.width, size.height, boxX, boxY, boxW, boxH);
  try {
    doc.addImage(
      dataUrl,
      imageFormatFromDataUrl(dataUrl),
      fitted.x,
      fitted.y,
      fitted.w,
      fitted.h,
      undefined,
      'FAST',
    );
    return true;
  } catch {
    return false;
  }
}

function drawRoundedRect(
  doc: import('jspdf').jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: [number, number, number],
) {
  doc.setFillColor(...fill);
  doc.roundedRect(x, y, w, h, r, r, 'F');
}

export async function exportFinancialReportPdf(report: FinancialReportExport): Promise<void> {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF();
  let y = 16;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Reporte financiero', 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(report.condominiumName, 14, y);
  y += 5;
  doc.text(`Periodo: ${report.periodLabel}`, 14, y);
  y += 5;
  doc.text(`Alcance: ${report.scopeLabel}`, 14, y);
  y += 5;
  doc.text(`Generado: ${report.generatedAt}`, 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Concepto', 'Valor', 'Variación']],
    body: report.kpis.map((kpi) => [kpi.label, kpi.value, kpi.change ?? '—']),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  y = (doc as import('jspdf').jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  y = addSectionTitle(doc, 'Presupuesto vs real (egresos)', y);

  autoTable(doc, {
    startY: y,
    head: [['Categoría', 'Presupuesto', 'Real', 'Variación']],
    body:
      report.budgetRows.length > 0
        ? report.budgetRows.map((row) => [
            row.label,
            formatExportAmount(row.budget),
            formatExportAmount(row.actual),
            formatExportAmount(row.variance),
          ])
        : [['Sin datos', '—', '—', '—']],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  y = (doc as import('jspdf').jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  y = addSectionTitle(doc, 'Ingresos y egresos por categoría', y);

  autoTable(doc, {
    startY: y,
    head: [['Tipo', 'Categoría', 'Monto']],
    body: [
      ...report.incomeByCategory.map((row) => ['Ingreso', row.label, formatExportAmount(row.amount)]),
      ...report.expenseByCategory.map((row) => ['Egreso', row.label, formatExportAmount(row.amount)]),
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  y = (doc as import('jspdf').jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  y = addSectionTitle(doc, 'Morosidad y saldos', y);

  autoTable(doc, {
    startY: y,
    head: [['Concepto', 'Monto']],
    body: [
      ...(report.collectionRate !== null
        ? [['Tasa de cobranza', `${report.collectionRate}%`]]
        : []),
      ['Por cobrar (vencido)', formatExportAmount(report.totalReceivable)],
      ['Proveedores pendientes', formatExportAmount(report.totalPayables)],
      ...report.agingRows.map((row) => [row.label, formatExportAmount(row.amount)]),
      ...report.fundBalances.map((row) => [
        `${row.label} (al ${row.asOf})`,
        formatExportAmount(row.amount),
      ]),
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  const slug = sanitizeExportFilename(`${report.condominiumName}-${report.periodLabel}`);
  doc.save(`reporte-financiero-${slug}.pdf`);
}

export async function exportUnitStatementPdf(statement: UnitStatementExport): Promise<void> {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const headerH = 36;
  const primary = hexToRgb(statement.branding?.primaryColor, [47, 90, 68]);
  const accent = hexToRgb(statement.branding?.accentColor, [180, 83, 9]);

  // Prefer wordmark (true horizontal) over near-square lockup assets.
  const [condoLogoRaw, vekaLogo] = await Promise.all([
    statement.branding?.logoUrl ? loadImageAsDataUrl(statement.branding.logoUrl) : Promise.resolve(null),
    loadImageAsDataUrl('/brand/veka-wordmark.png'),
  ]);
  const condoLogo = condoLogoRaw ? await knockOutNearWhiteBackground(condoLogoRaw) : null;

  // Header band (no white logo plates — logos sit directly on brand color)
  doc.setFillColor(...primary);
  doc.rect(0, 0, pageWidth, headerH, 'F');
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, headerH, pageWidth, 2.2, 'F');

  const logoPadY = 7;
  const logoBoxH = headerH - logoPadY * 2;
  const condoBoxW = 30;
  const vekaBoxW = 36;
  let titleX = margin;

  if (condoLogo) {
    const drawn = await addFittedImage(doc, condoLogo, margin, logoPadY, condoBoxW, logoBoxH);
    if (drawn) titleX = margin + condoBoxW + 6;
  }

  let vekaDrawn = false;
  if (vekaLogo) {
    vekaDrawn = await addFittedImage(
      doc,
      vekaLogo,
      pageWidth - margin - vekaBoxW,
      logoPadY,
      vekaBoxW,
      logoBoxH,
    );
  }
  if (!vekaDrawn) {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Veka', pageWidth - margin, headerH / 2 + 1.5, { align: 'right' });
  }

  const titleMaxWidth = pageWidth - titleX - margin - (vekaDrawn ? vekaBoxW + 4 : 18);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Estado de cuenta', titleX, 13, { maxWidth: titleMaxWidth });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(statement.condominiumName, titleX, 20, { maxWidth: titleMaxWidth });
  doc.setFontSize(8);
  doc.text(`Generado: ${statement.generatedAt}`, titleX, 27, { maxWidth: titleMaxWidth });

  let y = headerH + 12;

  // Summary cards
  const cardW = (pageWidth - margin * 2 - 8) / 3;
  const cards = [
    { label: 'Unidad', value: statement.unitIdentifier },
    { label: 'Torre / cluster', value: statement.clusterName },
    { label: 'Saldo pendiente', value: `$${formatExportAmount(statement.balanceDue)}` },
  ];

  cards.forEach((card, index) => {
    const x = margin + index * (cardW + 4);
    drawRoundedRect(doc, x, y, cardW, 18, 2, [248, 250, 252]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, cardW, 18, 2, 2, 'S');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(card.label.toUpperCase(), x + 4, y + 6);
    doc.setTextColor(index === 2 && statement.balanceDue > 0 ? accent[0] : 30, index === 2 && statement.balanceDue > 0 ? accent[1] : 41, index === 2 && statement.balanceDue > 0 ? accent[2] : 59);
    doc.setFontSize(11);
    doc.text(card.value, x + 4, y + 13);
  });

  y += 26;

  doc.setTextColor(...primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Movimientos', margin, y);
  y += 3;
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Concepto', 'Cargo', 'Abono', 'Saldo', 'Estado']],
    body: statement.lines.map((line) => [
      line.date,
      line.concept,
      line.debit > 0 ? formatExportAmount(line.debit) : '—',
      line.credit > 0 ? formatExportAmount(line.credit) : '—',
      formatExportAmount(line.runningBalance),
      line.status,
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 2.4,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  });

  const finalY =
    (doc as import('jspdf').jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;

  // Footer
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${statement.condominiumName} · Unidad ${statement.unitIdentifier} · Documento generado con Veka`,
    margin,
    pageHeight - 10,
  );
  doc.text(`Página 1`, pageWidth - margin, pageHeight - 10, { align: 'right' });

  // Keep finalY referenced so lint/ts doesn't complain if table is empty.
  void finalY;

  const slug = sanitizeExportFilename(`${statement.condominiumName}-${statement.unitIdentifier}`);
  doc.save(`estado-cuenta-${slug}.pdf`);
}

export async function exportMovementsPdf(
  meta: { condominiumName: string; scopeLabel: string; generatedAt: string },
  movements: MovementExportRow[],
): Promise<void> {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF({ orientation: movements.length > 20 ? 'landscape' : 'portrait' });
  let y = 16;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Libro de movimientos', 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(meta.condominiumName, 14, y);
  y += 5;
  doc.text(`Alcance: ${meta.scopeLabel}`, 14, y);
  y += 5;
  doc.text(`Generado: ${meta.generatedAt}`, 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Tipo', 'Fecha', 'Concepto', 'Categoría', 'Monto', 'Fondo', 'Estado']],
    body: movements.map((row) => [
      row.movementType,
      row.date,
      row.concept,
      row.category,
      formatExportAmount(row.amount),
      row.fund,
      row.status,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  const slug = sanitizeExportFilename(`${meta.condominiumName}-${meta.scopeLabel}`);
  doc.save(`movimientos-${slug}.pdf`);
}
