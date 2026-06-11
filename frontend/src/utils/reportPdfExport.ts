import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export type PdfSummaryStat = { label: string; value: string | number };

export type ReportPdfMeta = {
  title: string;
  subtitle?: string;
  dateRange: string;
  filters: string[];
  rowCount: number;
  generatedAt: string;
  themeColor: string;
  summaryStats?: PdfSummaryStat[];
};

const THEME_RGB: Record<string, { primary: [number, number, number]; light: [number, number, number] }> = {
  blue: { primary: [37, 99, 235], light: [239, 246, 255] },
  green: { primary: [22, 163, 74], light: [240, 253, 244] },
  purple: { primary: [147, 51, 234], light: [250, 245, 255] },
  yellow: { primary: [202, 138, 4], light: [254, 252, 232] },
  teal: { primary: [13, 148, 136], light: [240, 253, 250] },
  orange: { primary: [234, 88, 12], light: [255, 247, 237] },
  slate: { primary: [71, 85, 105], light: [248, 250, 252] },
  rose: { primary: [225, 29, 72], light: [255, 241, 242] },
  indigo: { primary: [79, 70, 229], light: [238, 242, 255] },
  cyan: { primary: [8, 145, 178], light: [236, 254, 255] },
  red: { primary: [220, 38, 38], light: [254, 242, 242] },
  amber: { primary: [217, 119, 6], light: [255, 251, 235] },
};

type Rgb = [number, number, number];

export function downloadReportPdf(options: {
  meta: ReportPdfMeta;
  headerLabels: string[];
  rows: string[][];
  filename: string;
}): void {
  const theme = THEME_RGB[options.meta.themeColor] ?? THEME_RGB.slate;
  const primary: Rgb = theme.primary;
  const light: Rgb = theme.light;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.rect(0, 0, pageW, 34, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('ProdPulse · Smart Production Tracking', margin, 9);

  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(options.meta.title, margin, 19);

  if (options.meta.subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(options.meta.subtitle, margin, 27);
  }

  doc.setFontSize(8);
  doc.text(`Period: ${options.meta.dateRange}`, pageW - margin, 12, { align: 'right' });
  doc.text(`${options.meta.rowCount} rows`, pageW - margin, 18, { align: 'right' });

  let y = 42;
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated ${options.meta.generatedAt}`, margin, y);
  y += 5;

  if (options.meta.filters.length > 0) {
    const filterLine = options.meta.filters.join('  ·  ');
    const wrapped = doc.splitTextToSize(filterLine, pageW - margin * 2);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 4 + 2;
  }

  const stats = options.meta.summaryStats ?? [];
  if (stats.length > 0) {
    y += 2;
    const gap = 3;
    const boxW = Math.min(52, (pageW - margin * 2 - gap * (stats.length - 1)) / stats.length);
    stats.forEach((stat, i) => {
      const x = margin + i * (boxW + gap);
      doc.setFillColor(light[0], light[1], light[2]);
      doc.setDrawColor(primary[0], primary[1], primary[2]);
      doc.setLineWidth(0.25);
      doc.roundedRect(x, y, boxW, 14, 1.5, 1.5, 'FD');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(6.5);
      doc.text(stat.label.toUpperCase(), x + 2.5, y + 4.5);
      doc.setTextColor(primary[0], primary[1], primary[2]);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const valueText = doc.splitTextToSize(String(stat.value), boxW - 5);
      doc.text(valueText, x + 2.5, y + 10);
      doc.setFont('helvetica', 'normal');
    });
    y += 18;
  }

  autoTable(doc, {
    startY: y,
    head: [options.headerLabels],
    body: options.rows,
    margin: { left: margin, right: margin, top: margin, bottom: 14 },
    styles: {
      fontSize: 6.5,
      cellPadding: 1.8,
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.5,
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (data) => {
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `ProdPulse  ·  Page ${data.pageNumber} of ${doc.getNumberOfPages()}`,
        pageW / 2,
        pageH - 5,
        { align: 'center' }
      );
    },
  });

  doc.save(options.filename);
}
