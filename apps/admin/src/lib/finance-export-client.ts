'use client';

import type {
  FinancialReportExport,
  MovementExportRow,
  UnitStatementExport,
} from '@veka/shared';
import {
  buildFinancialReportCsv,
  buildMovementsCsv,
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
  let y = 16;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Estado de cuenta', 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(statement.condominiumName, 14, y);
  y += 5;
  doc.text(`Unidad: ${statement.unitIdentifier}`, 14, y);
  y += 5;
  doc.text(`Torre: ${statement.clusterName}`, 14, y);
  y += 5;
  doc.text(`Saldo pendiente: ${formatExportAmount(statement.balanceDue)}`, 14, y);
  y += 5;
  doc.text(`Generado: ${statement.generatedAt}`, 14, y);
  y += 8;

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
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 41, 59] },
  });

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
