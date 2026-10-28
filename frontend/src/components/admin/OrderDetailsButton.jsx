import { useEffect, useState } from 'react'
import { Eye, X } from 'lucide-react'
import api from '../../api/axios.js'
import { formatDate, formatMoney } from './adminUtils.js'

export default function OrderDetailsButton({ orderId, onRefresh, canCancel = false }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [details, setDetails] = useState(null)

  useEffect(() => {
    if (!open || details) return
    let live = true
    api.get(`/admin/orders/${orderId}`).then((response) => {
      if (live) setDetails(response.data?.data || null)
    }).catch((requestError) => {
      if (live) setError(requestError.response?.data?.message || 'Could not load order details.')
    }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [open, details, orderId])

  const order = details?.order
  const address = order?.shippingAddress || {}
  const cancelOrder = async () => {
    if (!window.confirm(`Cancel order ${order.orderNumber || orderId}? Paid Razorpay orders will be refunded.`)) return
    setLoading(true); setError(''); setNotice('')
    try {
      const response = await api.patch(`/admin/orders/${orderId}/cancel`)
      setNotice(response.data?.message || 'Order cancelled.')
      const refreshed = await api.get(`/admin/orders/${orderId}`)
      setDetails(refreshed.data?.data || null)
      onRefresh?.()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not cancel order.')
    } finally { setLoading(false) }
  }

  return <>
    <button type="button" onClick={() => { setOpen(true); setLoading(!details); setError(''); setNotice('') }} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:border-indigo-200 hover:text-indigo-700"><Eye size={13}/>Details</button>
    {open && <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/50 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
      <section className="my-auto max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="order-details-heading">
        <header className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-indigo-600">Order details</p><h2 id="order-details-heading" className="mt-1 text-xl font-bold text-slate-900">{order?.orderNumber || orderId}</h2>{order && <p className="mt-1 text-xs text-slate-500">Placed {formatDate(order.placedAt || order.createdAt, { day: 'numeric', month: 'long', year: 'numeric' })}</p>}</div><button type="button" onClick={() => setOpen(false)} aria-label="Close order details" className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={18}/></button></header>
        {loading && <p className="py-12 text-center text-sm text-slate-500">Loading order…</p>}{error && <p role="alert" className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{notice && <p role="status" className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
        {order && <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">{[['Fulfilment', order.orderStatus], ['Payment', `${order.paymentStatus} · ${order.paymentMethod}`], ['Total', formatMoney(order.totalAmount)]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><small className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</small><b className="mt-1 block text-sm capitalize text-slate-800">{value}</b></div>)}</div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2"><div><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Deliver to</h3><p className="mt-2 text-sm font-semibold text-slate-800">{address.fullName}</p><p className="mt-1 text-xs leading-5 text-slate-600">{[address.addressLine1, address.addressLine2, [address.city, address.state, address.postalCode].filter(Boolean).join(', '), address.country, address.phone].filter(Boolean).join('\n')}</p>{order.user?.email && <p className="mt-2 text-xs text-indigo-700">{order.user.email}</p>}</div><div><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Payment and fulfillment</h3><p className="mt-2 text-xs leading-6 text-slate-600">Refund: {order.refundStatus || 'not required'}<br/>Currency: {order.currency}<br/>Reservation expires: {order.inventoryExpiresAt ? formatDate(order.inventoryExpiresAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}<br/>Inventory released: {order.inventoryReleasedAt ? formatDate(order.inventoryReleasedAt) : 'No'}</p></div></div>
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200"><div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-700">Items ({order.items?.length || 0})</div>{order.items?.map((item, index) => <div key={`${item.product}-${index}`} className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 last:border-0"><div className="min-w-0"><b className="block truncate text-xs text-slate-800">{item.name}</b><small className="text-[11px] text-slate-500">{formatMoney(item.price)} × {item.quantity}</small></div><b className="shrink-0 text-xs">{formatMoney(item.price * item.quantity)}</b></div>)}<div className="grid gap-1 border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs"><span className="flex justify-between"><span>Subtotal</span><b>{formatMoney(order.subtotal)}</b></span><span className="flex justify-between"><span>Shipping / discount</span><b>{formatMoney(order.shippingFee)} / −{formatMoney(order.discount)}</b></span><span className="mt-1 flex justify-between border-t border-slate-200 pt-2 text-sm font-bold"><span>Total</span><b>{formatMoney(order.totalAmount)}</b></span></div></div>
          <div className="mt-6"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Admin activity</h3>{details.activity?.length ? <div className="mt-3 grid gap-3">{details.activity.map((entry) => <div key={entry._id} className="flex gap-3"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-indigo-500"/><p className="text-xs text-slate-700">{entry.summary}<small className="mt-1 block text-[10px] text-slate-400">{entry.actor?.name || 'Admin'} · {formatDate(entry.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></p></div>)}</div> : <p className="mt-2 text-xs text-slate-400">No admin changes recorded for this order yet.</p>}</div>
          {canCancel && ['pending', 'confirmed', 'processing'].includes(order.orderStatus) && !order.inventoryReleasedAt && <button type="button" disabled={loading} onClick={cancelOrder} className="mt-6 h-10 rounded-lg border border-rose-200 px-4 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Cancel order{order.paymentStatus === 'paid' ? ' and refund payment' : ''}</button>}
        </>}
      </section>
    </div>}
  </>
}
