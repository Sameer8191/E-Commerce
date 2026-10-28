export const PAGE_SIZE = 10
export const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']

export const formatMoney = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(Number(value) || 0)

export const formatDate = (value, options = { day: '2-digit', month: 'short', year: 'numeric' }) => (
  value ? new Intl.DateTimeFormat('en-IN', options).format(new Date(value)) : '—'
)

export const shortId = (value = '') => value.length > 7 ? value.slice(-7).toUpperCase() : value.toUpperCase()

export const orderTone = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  confirmed: 'bg-blue-50 text-blue-700 ring-blue-200',
  processing: 'bg-violet-50 text-violet-700 ring-violet-200',
  shipped: 'bg-sky-50 text-sky-700 ring-sky-200',
  delivered: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200',
}

export const paymentTone = {
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  partially_refunded: 'bg-violet-50 text-violet-700 ring-violet-200',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  failed: 'bg-rose-50 text-rose-700 ring-rose-200',
  refunded: 'bg-slate-100 text-slate-600 ring-slate-200',
}
