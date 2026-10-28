import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Check, Clock3, Package, RefreshCw, RotateCcw, Truck } from 'lucide-react'
import Navbar from '../../components/layout/Navbar.jsx'
import Footer from '../../components/layout/Footer.jsx'
import api from '../../api/axios.js'

const steps = [
  { id: 'confirmed', label: 'Order confirmed' },
  { id: 'processing', label: 'Preparing your order' },
  { id: 'shipped', label: 'On its way' },
  { id: 'delivered', label: 'Delivered' },
]

const filters = [
  { id: 'all', label: 'All orders' },
  { id: 'pending', label: 'Pending' },
  { id: 'paid', label: 'Paid / partially refunded' },
  { id: 'refunded', label: 'Refunded' },
  { id: 'failed', label: 'Rejected' },
]

const fulfillmentFilters = [
  { id: 'all', label: 'Any delivery status' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'processing', label: 'Preparing' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
]

const fulfillmentLabels = {
  pending: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  processing: 'Preparing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const money = (amount) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(Number(amount) || 0)

const date = (value) => value
  ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Date unavailable'

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true)
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

function PaymentBadge({ status }) {
  const styles = {
    pending: 'bg-amber-50 text-amber-800 ring-amber-200',
    paid: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    failed: 'bg-rose-50 text-rose-800 ring-rose-200',
    refunded: 'bg-slate-100 text-slate-700 ring-slate-200',
    partially_refunded: 'bg-violet-50 text-violet-800 ring-violet-200',
  }
  const labels = { pending: 'Pending', paid: 'Succeeded', failed: 'Rejected', refunded: 'Refunded', partially_refunded: 'Partially refunded' }
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${styles[status] || styles.pending}`}>
    {['paid', 'partially_refunded'].includes(status) ? <Check size={13} /> : status === 'failed' ? <AlertCircle size={13} /> : <Clock3 size={13} />}
    {labels[status] || 'Pending'}
  </span>
}

function OrderTracker({ order }) {
  const isCancelled = order.orderStatus === 'cancelled'
  const isPaymentFailed = order.paymentStatus === 'failed'
  const stage = order.orderStatus === 'pending' ? -1 : steps.findIndex((step) => step.id === order.orderStatus)
  const currentStage = Math.max(stage, 0)

  if (isCancelled || isPaymentFailed) {
    return <div className="mt-5 flex items-start gap-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
      <AlertCircle className="mt-0.5 shrink-0" size={18} />
      <div><p className="font-semibold">{isCancelled ? 'Order cancelled' : 'Payment rejected'}</p>
        <p className="mt-1 text-rose-700">{isCancelled ? 'This order will not be shipped.' : 'Payment was not completed. Check your payment details before placing a new order.'}</p>
      </div>
    </div>
  }

  return <div className="mt-6">
    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><Truck size={17} className="text-[#2874f0]" />Order tracking</div>
    <ol className="grid grid-cols-4 gap-2" aria-label={`Order progress: ${order.orderStatus}`}>
      {steps.map((step, index) => {
        const complete = order.orderStatus === 'delivered' || (stage >= 0 && index <= currentStage)
        const current = index === currentStage && order.orderStatus !== 'delivered'
        return <li className="min-w-0" key={step.id}>
          <div className={`mb-2 h-1.5 rounded-full ${complete ? 'bg-[#2874f0]' : 'bg-slate-200'}`} />
          <span className={`text-[11px] leading-4 ${current ? 'font-bold text-[#172337]' : complete ? 'font-medium text-slate-700' : 'text-slate-400'}`}>{step.label}</span>
        </li>
      })}
    </ol>
    <p className="mt-3 text-xs text-slate-500">{order.orderStatus === 'delivered' ? 'Delivered' : order.orderStatus === 'pending' ? 'We’ll begin preparing this order after payment is confirmed.' : `Last updated ${date(order.updatedAt || order.placedAt)}`}</p>
  </div>
}

function OrderCard({ order, returnBusy, onReturnRequest, onPayNow, paymentBusy, onCancel, cancelBusy }) {
  const [returnFormOpen, setReturnFormOpen] = useState(false)
  const [returnReason, setReturnReason] = useState('defective')
  const [returnDetails, setReturnDetails] = useState('')
  const [returnQuantities, setReturnQuantities] = useState({})
  const items = Array.isArray(order.items) ? order.items : []
  const vendorOrders = Array.isArray(order.vendorOrders) ? order.vendorOrders : []
  const request = order.returnRequest || {}
  const canRequestReturn = order.orderStatus === 'delivered'
    && order.paymentStatus === 'paid'
    && (!request.status || request.status === 'none')
    && order.returnEligible
  const canRetryPayment = order.paymentMethod === 'razorpay'
    && ['pending', 'failed'].includes(order.paymentStatus)
    && order.orderStatus !== 'cancelled'
    && !order.inventoryReleasedAt
  const canCancel = ['pending', 'confirmed'].includes(order.orderStatus)
    && ['pending', 'failed'].includes(order.paymentStatus)
    && !order.inventoryReleasedAt
  const requestReturn = async (event) => {
    event.preventDefault()
    const selectedItems = items
      .map((item) => ({ productId: String(item.product), variant: item.variant || '', quantity: Number(returnQuantities[`${String(item.product)}:${item.variant || ''}`] || 0) }))
      .filter((item) => item.quantity > 0)
    if (selectedItems.length && await onReturnRequest(order._id, returnReason, returnDetails, selectedItems)) setReturnFormOpen(false)
  }
  const selectedReturnSubtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(returnQuantities[`${String(item.product)}:${item.variant || ''}`] || 0), 0)
  const estimatedRefund = selectedReturnSubtotal - (Number(order.subtotal) > 0
    ? Math.round(Number(order.discount || 0) * selectedReturnSubtotal / Number(order.subtotal) * 100) / 100
    : 0)
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
    <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-bold text-[#172337]">Order {order.orderNumber || order._id}</h2>
          <PaymentBadge status={order.paymentStatus} />
        </div>
        <p className="mt-2 text-xs text-slate-500">Placed {date(order.placedAt || order.createdAt)}</p>
      </div>
      <div className="sm:text-right"><p className="text-xs text-slate-500">Order total</p><p className="mt-1 text-lg font-bold text-[#172337]">{money(order.totalAmount)}</p><div className="mt-2 flex flex-wrap gap-2 sm:justify-end">{canRetryPayment && <button className="rounded-lg bg-[#2874f0] px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60" type="button" disabled={paymentBusy} onClick={() => onPayNow(order)}>{paymentBusy ? 'Opening secure payment…' : 'Pay now'}</button>}{canCancel && <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-700 disabled:opacity-60" type="button" disabled={cancelBusy} onClick={() => onCancel(order)}>{cancelBusy ? 'Cancelling…' : 'Cancel order'}</button>}</div></div>
    </div>

    <div className="divide-y divide-slate-100">
      {items.map((item, index) => <div className="flex items-center gap-4 py-4" key={`${item.product || item.name}-${index}`}>
        {item.image ? <img className="h-16 w-16 rounded-lg bg-slate-50 object-contain p-1" src={item.image} alt="" /> : <span className="grid h-16 w-16 place-items-center rounded-lg bg-slate-50 text-slate-400"><Package size={22} /></span>}
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{item.name || 'Product'}{item.variant ? ` · ${item.variant}` : ''}</p><p className="mt-1 text-xs text-slate-500">Quantity: {item.quantity || 1}</p></div>
        <p className="shrink-0 text-sm font-medium text-slate-700">{money((item.price || 0) * (item.quantity || 1))}</p>
      </div>)}
    </div>

    {vendorOrders.length > 0 && <section className="border-t border-slate-100 py-3" aria-label="Seller shipment progress">
      <h3 className="mb-2 text-xs font-semibold text-slate-700">Seller shipments</h3>
      <div className="grid gap-2 sm:grid-cols-2">{vendorOrders.map((shipment) => <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2" key={shipment._id}>
        <div className="min-w-0"><span className="block truncate text-xs text-slate-600">{shipment.storeName || 'Seller'}</span>{shipment.trackingNumber && <span className="mt-1 block text-[10px] text-slate-500">Tracking: {shipment.trackingNumber}{shipment.trackingUrl && <> · <a className="font-semibold text-blue-700 underline" href={shipment.trackingUrl} target="_blank" rel="noreferrer">Track</a></>}</span>}</div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold capitalize text-slate-700">{fulfillmentLabels[shipment.fulfillmentStatus] || shipment.fulfillmentStatus || 'Pending'}</span>
      </div>)}</div>
    </section>}

    <OrderTracker order={order} />

    {canRequestReturn && <section className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-800">Need to return this order?</h3><p className="mt-1 text-xs text-slate-500">Submit a return request within 30 days of delivery. Refunds are reviewed by our team.</p></div><button type="button" onClick={() => setReturnFormOpen((open) => !open)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 text-xs font-semibold text-indigo-700"><RotateCcw size={14}/>{returnFormOpen ? 'Close request' : 'Request a return'}</button></div>
      {returnFormOpen && <form onSubmit={requestReturn} className="mt-4 grid gap-3 sm:grid-cols-2">
        <fieldset className="grid gap-2 sm:col-span-2"><legend className="mb-1 text-xs font-semibold text-slate-700">Choose items and quantities</legend>{items.map((item) => {
          const productId = String(item.product)
          const returnKey = `${productId}:${item.variant || ''}`
          return <label className="flex items-center justify-between gap-3 rounded-lg border border-indigo-100 bg-white px-3 py-2" key={returnKey}>
            <span className="min-w-0 flex-1 truncate text-xs text-slate-700">{item.name}{item.variant ? ` · ${item.variant}` : ''} · purchased {item.quantity}</span>
            <span className="flex shrink-0 items-center gap-2 text-xs text-slate-600">Return qty<input className="h-9 w-16 rounded border border-slate-200 px-2 text-center" type="number" min="0" max={item.quantity} step="1" value={returnQuantities[returnKey] ?? 0} onChange={(event) => setReturnQuantities((current) => ({ ...current, [returnKey]: event.target.value }))} /></span>
          </label>
        })}</fieldset>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-700">Reason for return<select value={returnReason} onChange={(event) => setReturnReason(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-normal"><option value="defective">Defective or damaged</option><option value="wrong_item">Wrong item received</option><option value="not_as_described">Not as described</option><option value="changed_mind">Changed my mind</option><option value="other">Other</option></select></label>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-700 sm:row-span-2">Details (optional)<textarea maxLength={500} rows={3} value={returnDetails} onChange={(event) => setReturnDetails(event.target.value)} placeholder="Tell us a little more (up to 500 characters)" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal outline-none focus:border-indigo-400"/></label>
        <p className="text-xs text-slate-600">Estimated refund after proportional coupon discount: <strong>{money(estimatedRefund)}</strong></p>
        <button type="submit" disabled={returnBusy || selectedReturnSubtotal <= 0} className="h-10 self-end rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-50">{returnBusy ? 'Submitting…' : 'Submit return request'}</button>
      </form>}
    </section>}
    {order.orderStatus === 'delivered' && order.paymentStatus === 'paid' && order.returnEligible === false && (!request.status || request.status === 'none') && <p className="mt-5 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">The 30-day return window has ended for this order.</p>}
    {request.status && request.status !== 'none' && <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800"><RotateCcw size={15}/>Return request · <span className="capitalize">{request.status}</span></h3><span className="text-[11px] text-slate-500">Requested {date(request.requestedAt)}</span></div>
      <p className="mt-2 text-xs text-slate-600">Reason: {{ defective: 'Defective or damaged', wrong_item: 'Wrong item received', not_as_described: 'Not as described', changed_mind: 'Changed my mind', other: 'Other' }[request.reason] || '—'}</p>
      {!!request.items?.length && <div className="mt-2 text-xs text-slate-600"><p className="font-semibold">Items requested</p><ul className="mt-1 list-inside list-disc">{request.items.map((item) => <li key={`${item.product}-${item.name}`}>{item.quantity} × {item.name}</li>)}</ul><p className="mt-1">Requested refund: {money(request.refundAmount)}</p></div>}
      {request.details && <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-500">{request.details}</p>}
      {request.reviewNote && <p className="mt-2 text-xs text-slate-600">Team note: {request.reviewNote}</p>}
      <p className="mt-2 text-xs text-slate-600">Refund progress: <span className="font-semibold capitalize">{order.refundStatus || 'not started'}</span>{order.refundStatus === 'failed' ? ' · Our team will retry the refund.' : ''}</p>
      {order.refundStatus === 'processed' && <p className="mt-1 text-xs font-semibold text-emerald-700">{money(request.refundAmount || order.totalAmount)} refunded</p>}
    </section>}

    {order.shippingAddress && <div className="mt-5 border-t border-slate-100 pt-4">
      <p className="text-xs font-semibold text-slate-700">Delivering to</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{order.shippingAddress.fullName}, {order.shippingAddress.addressLine1}{order.shippingAddress.addressLine2 ? `, ${order.shippingAddress.addressLine2}` : ''}, {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</p>
    </div>}
  </article>
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('all')
  const [fulfillmentFilter, setFulfillmentFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [signedOut, setSignedOut] = useState(false)
  const [returnBusyId, setReturnBusyId] = useState('')
  const [paymentBusyId, setPaymentBusyId] = useState('')
  const [cancelBusyId, setCancelBusyId] = useState('')
  const [totalOrders, setTotalOrders] = useState(0)
  const [loadedPage, setLoadedPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [notice, setNotice] = useState('')
  const [lookupDetails, setLookupDetails] = useState({ orderNumber: '', email: '' })
  const [lookupOrder, setLookupOrder] = useState(null)
  const [lookupMessage, setLookupMessage] = useState('')
  const [lookupBusy, setLookupBusy] = useState(false)

  const lookupGuestOrder = async (event) => {
    event.preventDefault()
    setLookupBusy(true)
    setLookupMessage('')
    setLookupOrder(null)
    try {
      const response = await api.post('/orders/lookup', lookupDetails)
      setLookupOrder(response.data?.data || null)
    } catch (requestError) {
      setLookupMessage(requestError.response?.data?.message || 'Could not find this order.')
    } finally { setLookupBusy(false) }
  }

  const loadOrders = useCallback(async (quiet = false) => {
    if (!window.localStorage.getItem('authToken')) {
      setSignedOut(true)
      setLoading(false)
      return
    }
    if (quiet) setRefreshing(true)
    else setLoading(true)
    try {
      const response = await api.get('/orders?limit=100&page=1')
      const nextOrders = Array.isArray(response.data?.data) ? response.data.data : []
      setOrders((current) => quiet ? [...nextOrders, ...current.slice(100)] : nextOrders)
      setTotalOrders(Number(response.data?.pagination?.total) || 0)
      if (!quiet) setLoadedPage(1)
      setError('')
      setSignedOut(false)
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        window.localStorage.removeItem('authToken')
        setSignedOut(true)
      } else {
        setError(requestError.response?.data?.message || 'Your orders could not be loaded. Please try again.')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const loadMoreOrders = async () => {
    setLoadingMore(true)
    setError('')
    try {
      const nextPage = loadedPage + 1
      const response = await api.get('/orders', { params: { limit: 100, page: nextPage } })
      const nextOrders = Array.isArray(response.data?.data) ? response.data.data : []
      setOrders((current) => [...current, ...nextOrders])
      setLoadedPage(nextPage)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Older orders could not be loaded.')
    } finally {
      setLoadingMore(false)
    }
  }

  const payOrder = async (order) => {
    setPaymentBusyId(order._id)
    setError('')
    try {
      const orderResponse = await api.post('/payments/create-order', { orderId: order._id })
      if (!(await loadRazorpay())) throw new Error('Secure payment could not be loaded. Please try again.')
      const paymentOrder = orderResponse.data
      const razorpay = new window.Razorpay({
        key: paymentOrder.key,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: 'goodthings',
        description: `Order ${order.orderNumber}`,
        order_id: paymentOrder.razorpayOrderId,
        prefill: { name: order.shippingAddress?.fullName, contact: order.shippingAddress?.phone },
        theme: { color: '#172337' },
        handler: async (payment) => {
          try {
            await api.post('/payments/verify', {
              orderId: order._id,
              razorpay_order_id: payment.razorpay_order_id,
              razorpay_payment_id: payment.razorpay_payment_id,
              razorpay_signature: payment.razorpay_signature,
            })
            setNotice('Payment verified. Your order is confirmed.')
            await loadOrders(true)
          } catch (requestError) {
            setError(requestError.response?.data?.message || 'Payment could not be verified. Refresh your orders before retrying.')
          } finally {
            setPaymentBusyId('')
          }
        },
        modal: { ondismiss: () => setPaymentBusyId('') },
      })
      razorpay.open()
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to start payment.')
      setPaymentBusyId('')
    }
  }

  const cancelCustomerOrder = async (order) => {
    if (!window.confirm(`Cancel order ${order.orderNumber || ''}?`)) return
    setCancelBusyId(order._id)
    setError('')
    try {
      const response = await api.patch(`/orders/${order._id}/cancel`)
      setOrders((current) => current.map((item) => item._id === order._id ? response.data?.data : item))
      setNotice('Your order was cancelled.')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'This order could not be cancelled.')
    } finally {
      setCancelBusyId('')
    }
  }

  const submitReturnRequest = async (orderId, reason, details, items) => {
    setReturnBusyId(orderId)
    setError('')
    try {
      const response = await api.post(`/orders/${orderId}/return-request`, { reason, details, items })
      setOrders((current) => current.map((order) => order._id === orderId ? response.data.data : order))
      return true
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Your return request could not be submitted. Please try again.')
      return false
    } finally {
      setReturnBusyId('')
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => loadOrders(), 0)
    const interval = window.setInterval(() => loadOrders(true), 30000)
    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(interval)
    }
  }, [loadOrders])

  const visibleOrders = useMemo(() => orders.filter((order) => (
    (filter === 'all' || (filter === 'paid' ? ['paid', 'partially_refunded'].includes(order.paymentStatus) : order.paymentStatus === filter))
    && (fulfillmentFilter === 'all' || order.orderStatus === fulfillmentFilter)
  )), [filter, fulfillmentFilter, orders])

  return <div className="min-h-screen bg-[#f1f3f6] font-sans text-slate-800">
    <Navbar />
    <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <Link className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-[#2874f0]" to="/"><ArrowLeft size={16} /> Continue shopping</Link>
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#2874f0]">Your good things</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[#172337]">Your orders</h1><p className="mt-2 text-sm text-slate-500">Payment updates and delivery progress, all in one place.</p></div>
        {!signedOut && <button className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:opacity-60 sm:self-auto" type="button" onClick={() => loadOrders(true)} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />Refresh status</button>}
      </div>

      {signedOut ? <section className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-blue-50 text-[#2874f0]"><Package size={25} /></span>
        <h2 className="mt-4 text-lg font-bold text-[#172337]">Sign in to see your orders</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">Sign in to browse your order history, or look up one order using its order number and the email on your account.</p>
        <Link className="mt-5 inline-flex rounded-lg bg-[#172337] px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700" to="/login?redirect=%2Forders">Sign in</Link>
        <form className="mx-auto mt-8 max-w-lg border-t border-slate-100 pt-6 text-left" onSubmit={lookupGuestOrder}>
          <h3 className="text-sm font-bold text-[#172337]">Look up an order</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600">Order number<input className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" required autoComplete="off" placeholder="ORD-…" value={lookupDetails.orderNumber} onChange={(event) => setLookupDetails((current) => ({ ...current, orderNumber: event.target.value }))} /></label><label className="text-xs font-semibold text-slate-600">Account email<input className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" required type="email" autoComplete="email" value={lookupDetails.email} onChange={(event) => setLookupDetails((current) => ({ ...current, email: event.target.value }))} /></label></div>
          <button disabled={lookupBusy} className="mt-3 rounded-lg bg-[#2874f0] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{lookupBusy ? 'Looking up…' : 'Find order'}</button>
          {lookupMessage && <p className="mt-3 text-sm text-rose-700" role="alert">{lookupMessage}</p>}
          {lookupOrder && <article className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4" aria-live="polite"><div className="flex flex-wrap justify-between gap-2"><b className="text-sm">{lookupOrder.orderNumber}</b><span className="text-xs capitalize">{String(lookupOrder.orderStatus).replaceAll('_', ' ')} · payment {String(lookupOrder.paymentStatus).replaceAll('_', ' ')}</span></div><p className="mt-1 text-xs text-slate-500">Placed {date(lookupOrder.placedAt)} · {money(lookupOrder.totalAmount)}</p><ul className="mt-3 divide-y divide-slate-200">{(lookupOrder.items || []).map((item, index) => <li className="flex justify-between gap-3 py-2 text-xs" key={`${item.product}-${index}`}><span>{item.name} · qty {item.quantity}</span><span>{money(item.price * item.quantity)}</span></li>)}</ul></article>}
        </form>
      </section> : <>
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1" aria-label="Filter orders">
          {filters.map((item) => <button className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${filter === item.id ? 'bg-[#172337] text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`} key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}{item.id === 'all' ? ` (${totalOrders})` : ''}</button>)}
        </div>
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1" aria-label="Filter by delivery status">
          {fulfillmentFilters.map((item) => <button className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${fulfillmentFilter === item.id ? 'bg-blue-100 text-blue-800' : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`} key={item.id} type="button" aria-pressed={fulfillmentFilter === item.id} onClick={() => setFulfillmentFilter(item.id)}>{item.label}</button>)}
        </div>

        {error && <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert"><span>{error}</span><button className="font-semibold underline" type="button" onClick={() => loadOrders()}>Try again</button></div>}
          {notice && <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">{notice}</p>}
          {loading ? <div className="grid min-h-48 place-items-center rounded-2xl bg-white text-sm text-slate-500"><span className="flex items-center gap-2"><RefreshCw size={16} className="animate-spin" />Loading your orders…</span></div>
            : visibleOrders.length ? <><div className="space-y-5">{visibleOrders.map((order) => <OrderCard key={order._id} order={order} returnBusy={returnBusyId === order._id} onReturnRequest={submitReturnRequest} onPayNow={payOrder} paymentBusy={paymentBusyId === order._id} onCancel={cancelCustomerOrder} cancelBusy={cancelBusyId === order._id} />)}</div>{loadedPage * 100 < totalOrders && <div className="mt-7 text-center"><button className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60" type="button" onClick={loadMoreOrders} disabled={loadingMore}>{loadingMore ? 'Loading older orders…' : 'Load older orders'}</button></div>}</>
            : <section className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-500"><Package size={25} /></span>
              <h2 className="mt-4 text-lg font-bold text-[#172337]">{orders.length ? 'No orders in this group' : 'No orders yet'}</h2>
              <p className="mt-2 text-sm text-slate-500">{orders.length ? 'Choose another payment status to see more.' : 'When you place an order, payment and delivery updates will show up here.'}</p>
              {!orders.length && <Link className="mt-5 inline-flex rounded-lg bg-[#172337] px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700" to="/">Find something good</Link>}
            </section>}
      </>}
    </main>
    <Footer />
  </div>
}
