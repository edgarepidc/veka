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
  const primary = hexToRgb(statement.branding?.primaryColor, [47, 90, 68]);
  const accent = hexToRgb(statement.branding?.accentColor, [180, 83, 9]);

  const [condoLogo, vekaLogo] = await Promise.all([
    statement.branding?.logoUrl ? loadImageAsDataUrl(statement.branding.logoUrl) : Promise.resolve(null),
    loadImageAsDataUrl('/brand/veka-lockup-horizontal.png'),
  ]);

  // Header band
  doc.setFillColor(...primary);
  doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 34, pageWidth, 2.2, 'F');

  if (condoLogo) {
    try {
      doc.addImage(condoLogo, imageFormatFromDataUrl(condoLogo), margin, 7, 28, 18, undefined, 'FAST');
    } catch {
      // Ignore broken condo logo and continue with text header.
    }
  }

  if (vekaLogo) {
    try {
      doc.addImage(vekaLogo, imageFormatFromDataUrl(vekaLogo), pageWidth - margin - 34, 9, 34, 12, undefined, 'FAST');
    } catch {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Veka', pageWidth - margin, 18, { align: 'right' });
    }
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Veka', pageWidth - margin, 18, { align: 'right' });
  }

  const titleX = condoLogo ? margin + 34 : margin;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Estado de cuenta', titleX, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(statement.condominiumName, titleX, 22);
  doc.text(`Generado: ${statement.generatedAt}`, titleX, 28);

  let y = 46;

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
