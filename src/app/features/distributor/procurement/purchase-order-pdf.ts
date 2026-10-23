import { DistributorPurchaseOrder } from './procurement.models';

/** Opens a print-ready purchase order; users can choose Save as PDF in the browser dialog. */
export function printPurchaseOrderPdf(
  order: DistributorPurchaseOrder,
  total: number,
): boolean {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;

  const escapeHtml = (value: string): string =>
    value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[character];
    });
  const formatCurrency = (amount: number): string =>
    new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      maximumFractionDigits: 2,
    }).format(amount);
  const formatDate = (date: string): string =>
    new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium' }).format(new Date(date));
  const rows = order.lines
    .map(
      (line) => `<tr>
        <td>${escapeHtml(line.sku)}</td>
        <td>${escapeHtml(line.productName)}</td>
        <td class="number">${new Intl.NumberFormat('en-KE').format(line.quantity)} ${escapeHtml(line.unit)}</td>
        <td class="number">${formatCurrency(line.unitCost)}</td>
        <td class="number">${formatCurrency(line.quantity * line.unitCost)}</td>
      </tr>`,
    )
    .join('');
  const html = `<!doctype html>
    <html lang="en"><head><meta charset="utf-8"><title>Purchase Order ${escapeHtml(order.id)}</title>
    <style>
      @page { size: A4; margin: 18mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #172033; font: 12px/1.5 Arial, sans-serif; }
      header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 16px; }
      .brand { color: #1d4ed8; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      h1 { margin: 6px 0 0; font-size: 22px; }
      .status { border: 1px solid #bfdbfe; border-radius: 4px; padding: 4px 8px; color: #1d4ed8; font-size: 10px; font-weight: 700; }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 28px; padding: 18px 0; }
      .label { color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
      .value { margin-top: 3px; font-weight: 600; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th { background: #f1f5f9; color: #475569; text-align: left; font-size: 10px; text-transform: uppercase; }
      th, td { border-bottom: 1px solid #e2e8f0; padding: 9px 7px; vertical-align: top; }
      .number { text-align: right; white-space: nowrap; }
      .totals { width: 280px; margin: 14px 0 0 auto; }
      .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
      .grand { border-top: 1px solid #cbd5e1; margin-top: 4px; padding-top: 9px; font-size: 14px; font-weight: 700; }
      footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 9px; color: #64748b; font-size: 10px; }
    </style></head><body>
      <header><div><div class="brand">LogiFlow · Distributor Procurement</div><h1>Purchase Order ${escapeHtml(order.id)}</h1></div><span class="status">${escapeHtml(order.status.replace('_', ' '))}</span></header>
      <section class="meta">
        <div><div class="label">Supplier</div><div class="value">${escapeHtml(order.manufacturerName)}</div><div>${escapeHtml(order.manufacturerLocation)}</div></div>
        <div><div class="label">Deliver to</div><div class="value">${escapeHtml(order.destination)}</div></div>
        <div><div class="label">Order date</div><div class="value">${escapeHtml(formatDate(order.orderDate))}</div></div>
        <div><div class="label">Expected delivery</div><div class="value">${escapeHtml(formatDate(order.expectedDelivery))}</div></div>
      </section>
      <h2>Ordered items</h2>
      <table><thead><tr><th>SKU / ID</th><th>Product</th><th class="number">Quantity</th><th class="number">Unit cost</th><th class="number">Subtotal</th></tr></thead><tbody>${rows}</tbody></table>
      <section class="totals">
        <div class="total-row"><span>Items subtotal</span><span>${formatCurrency(total - order.logisticsCost)}</span></div>
        <div class="total-row"><span>Inbound logistics</span><span>${formatCurrency(order.logisticsCost)}</span></div>
        <div class="total-row grand"><span>Grand total</span><span>${formatCurrency(total)}</span></div>
      </section>
      <footer>Generated from LogiFlow · ${escapeHtml(formatDate(new Date().toISOString()))}</footer>
    </body></html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
  return true;
}
