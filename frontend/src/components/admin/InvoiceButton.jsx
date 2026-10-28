import { FileText } from 'lucide-react'

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]))

const money = (value, currency = 'INR') => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency, maximumFractionDigits: 2,
}).format(Number(value) || 0)

export default function InvoiceButton({ order }) {
  const printInvoice = () => {
    const invoiceWindow = window.open('', '_blank')
    if (!invoiceWindow) return
    invoiceWindow.opener = null

    const address = order.shippingAddress || {}
    const rows = (order.items || []).map((item) => `<tr>
      <td><strong>${escapeHtml(item.name || 'Product')}</strong><small>Qty: ${Number(item.quantity) || 0}</small></td>
      <td>${money(item.price, order.currency)}</td>
      <td>${Number(item.quantity) || 0}</td>
      <td class="amount">${money((Number(item.price) || 0) * (Number(item.quantity) || 0), order.currency)}</td>
    </tr>`).join('')
    const placedAt = order.placedAt || order.createdAt
    const addressLines = [address.fullName, address.addressLine1, address.addressLine2, [address.city, address.state, address.postalCode].filter(Boolean).join(', '), address.country, address.phone].filter(Boolean)

    invoiceWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${escapeHtml(order.orderNumber || order._id)}</title>
      <style>
        *{box-sizing:border-box}body{margin:0;padding:48px;color:#172337;font:14px/1.5 Arial,sans-serif}.invoice{max-width:850px;margin:auto}.top{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #172337;padding-bottom:24px}.brand{font-size:24px;font-weight:800}.brand span{color:#eab308}.muted{color:#64748b}.label{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#64748b;font-weight:700}.meta{text-align:right}.meta h1{margin:0 0 8px;font-size:28px}.addresses{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin:30px 0}.addresses p{margin:8px 0 0;line-height:1.7}table{width:100%;border-collapse:collapse;margin-top:22px}th{text-align:left;background:#f1f5f9;color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:.06em}th,td{padding:13px 12px;border-bottom:1px solid #e2e8f0}td small{display:block;margin-top:4px;color:#64748b}.amount{text-align:right}.totals{width:min(320px,100%);margin:22px 0 0 auto}.total-row{display:flex;justify-content:space-between;padding:7px 0;color:#475569}.grand{margin-top:6px;border-top:2px solid #172337;padding-top:12px;color:#172337;font-size:18px;font-weight:800}.thanks{margin-top:50px;border-top:1px solid #e2e8f0;padding-top:18px;text-align:center;color:#64748b;font-size:12px}@media print{body{padding:0}.invoice{max-width:none}.no-print{display:none}}
      </style></head><body><main class="invoice"><header class="top"><div><div class="brand">goodthings<span>.</span></div><div class="muted">Goodthings Supply Co.</div></div><div class="meta"><h1>INVOICE</h1><div><b>${escapeHtml(order.orderNumber || order._id)}</b></div><div class="muted">${placedAt ? escapeHtml(new Intl.DateTimeFormat('en-IN', { dateStyle: 'long' }).format(new Date(placedAt))) : ''}</div></div></header>
      <section class="addresses"><div><div class="label">Billed to</div><p>${addressLines.map(escapeHtml).join('<br>')}</p></div><div><div class="label">Order details</div><p>Payment: ${escapeHtml(order.paymentMethod || '—')}<br>Payment status: ${escapeHtml(order.paymentStatus || 'pending')}<br>Order status: ${escapeHtml(order.orderStatus || 'pending')}</p></div></section>
      <table><thead><tr><th>Item</th><th>Unit price</th><th>Qty</th><th class="amount">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <section class="totals"><div class="total-row"><span>Subtotal</span><b>${money(order.subtotal, order.currency)}</b></div><div class="total-row"><span>Shipping</span><b>${money(order.shippingFee, order.currency)}</b></div><div class="total-row"><span>Discount</span><b>−${money(order.discount, order.currency)}</b></div><div class="total-row grand"><span>Total</span><span>${money(order.totalAmount, order.currency)}</span></div><p class="muted">Applicable GST is included in listed prices; no separate tax is added at checkout.</p></section>
      <footer class="thanks">Thank you for shopping with Goodthings.</footer></main></body></html>`)
    invoiceWindow.document.close()
    window.setTimeout(() => invoiceWindow.print(), 250)
  }

  return <button type="button" onClick={printInvoice} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:border-indigo-200 hover:text-indigo-700" title="Print or save invoice as PDF"><FileText size={13}/>Invoice</button>
}
