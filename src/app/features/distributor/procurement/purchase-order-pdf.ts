import { DistributorPurchaseOrder } from './procurement.models';

/** Creates and downloads a self-contained PDF purchase order without opening a popup. */
export function downloadPurchaseOrderPdf(order: DistributorPurchaseOrder, total: number): void {
  const clean = (value: unknown): string =>
    String(value ?? '').normalize('NFKD').replace(/[^\x20-\x7E]/g, '');
  const money = (value: number): string =>
    `KES ${new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)}`;
  const date = (value: string): string => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? clean(value) : new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium' }).format(parsed);
  };
  const wrap = (value: string, max: number): string[] => {
    const words = clean(value).split(/\s+/);
    const result: string[] = [];
    let line = '';
    for (const word of words) {
      if (line && `${line} ${word}`.length > max) { result.push(line); line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    if (line) result.push(line);
    return result.length ? result : [''];
  };
  const contentPages: string[][] = [[]];
  const add = (line: string) => {
    if (contentPages.at(-1)!.length >= 48) contentPages.push([]);
    contentPages.at(-1)!.push(line);
  };
  add('LOGIFLOW | DISTRIBUTOR PROCUREMENT');
  add(`PURCHASE ORDER ${clean(order.id)}`);
  add('');
  add(`Status: ${clean(order.status.replace('_', ' '))}    Payment: ${clean(order.paymentStatus)}`);
  add(`Supplier: ${clean(order.manufacturerName)} (${clean(order.manufacturerId)})`);
  add(`Supplier location: ${clean(order.manufacturerLocation)}`);
  add(`Destination: ${clean(order.destination)}`);
  add(`Order date: ${date(order.orderDate)}    Expected delivery: ${date(order.expectedDelivery)}`);
  if (order.shipmentId) add(`Shipment: ${clean(order.shipmentId)}`);
  if (order.tripId) add(`Trip: ${clean(order.tripId)}`);
  if (order.driverName) add(`Driver: ${clean(order.driverName)}`);
  if (order.vehicleLabel) add(`Vehicle: ${clean(order.vehicleLabel)}`);
  add('');
  add('ORDERED ITEMS');
  add('SKU / ID       PRODUCT                         QTY / UNIT       UNIT COST       SUBTOTAL');
  add('-'.repeat(88));
  for (const item of order.lines) {
    const product = wrap(`${item.productName} (${item.sku})`, 38);
    product.forEach((part, index) => {
      const qty = index === 0 ? `${item.quantity} ${item.unit}` : '';
      const unitCost = index === 0 ? money(item.unitCost) : '';
      const subtotal = index === 0 ? money(item.quantity * item.unitCost) : '';
      add(`${index === 0 ? clean(item.sku).slice(0, 14).padEnd(14) : ''.padEnd(14)} ${part.slice(0, 38).padEnd(38)} ${qty.slice(0, 14).padEnd(14)} ${unitCost.padStart(14)} ${subtotal.padStart(14)}`);
    });
    if (item.shippedQuantity !== undefined) add(`  Shipped quantity: ${item.shippedQuantity}`);
  }
  add('-'.repeat(88));
  add(`Items subtotal: ${money(order.lines.reduce((sum, item) => sum + item.quantity * item.unitCost, 0))}`);
  add(`Inbound logistics: ${money(order.logisticsCost)}`);
  add(`GRAND TOTAL: ${money(total)}`);
  if (order.timeline.length) {
    add(''); add('ORDER TIMELINE');
    for (const event of order.timeline) {
      wrap(`${event.state}: ${event.title} - ${event.detail}`, 88).forEach(add);
    }
  }
  const pdfEscape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const objects: string[] = [];
  const addObject = (value: string) => { objects.push(value); return objects.length; };
  const catalogId = addObject('');
  const pagesId = addObject('');
  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds: number[] = [];
  for (const lines of contentPages) {
    const commands = ['BT', '/F1 9 Tf', '50 790 Td', '13 TL'];
    lines.forEach((line, index) => {
      commands.push(`(${pdfEscape(line)}) Tj`);
      if (index !== lines.length - 1) commands.push('T*');
    });
    commands.push('ET');
    const stream = commands.join('\n');
    const contentId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `purchase-order-${clean(order.id).replace(/[^a-zA-Z0-9_-]/g, '-') || 'report'}.pdf`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
