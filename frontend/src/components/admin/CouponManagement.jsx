import { useCallback, useEffect, useState } from 'react'
import { BadgePercent, RefreshCw, TicketCheck } from 'lucide-react'
import api from '../../api/axios.js'

const emptyForm = {
  code: '',
  discountType: 'percentage',
  discountValue: '',
  minimumSubtotal: '0',
  maximumDiscount: '',
  usageLimit: '',
  startsAt: '',
  expiresAt: '',
}

const localDateTime = (value) => {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function CouponManagement({ onNotice }) {
  const [coupons, setCoupons] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadCoupons = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/admin/coupons')
      setCoupons(Array.isArray(response.data?.data) ? response.data.data : [])
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load coupons.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadCoupons() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadCoupons])

  const create = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const payload = {
        ...form,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      }
      await api.post('/admin/coupons', payload)
      setForm(emptyForm)
      onNotice('Coupon created.')
      await loadCoupons()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not create coupon.')
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (coupon) => {
    setBusy(true)
    setError('')
    try {
      await api.patch(`/admin/coupons/${coupon._id}`, { isActive: !coupon.isActive })
      onNotice(`Coupon ${coupon.isActive ? 'paused' : 'activated'}.`)
      await loadCoupons()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update coupon.')
    } finally {
      setBusy(false)
    }
  }

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  return <div className="grid gap-6">
    <form onSubmit={create} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><BadgePercent size={19} /></span><div><h2 className="font-bold text-slate-900">Create a coupon</h2><p className="mt-1 text-xs text-slate-500">Discounts are calculated and checked again by the server at checkout.</p></div></div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1.5 text-xs font-semibold text-slate-700">Code<input required minLength={3} maxLength={40} pattern="[A-Za-z0-9_-]+" value={form.code} onChange={(event) => update('code', event.target.value.toUpperCase())} className="h-10 rounded-lg border border-slate-200 px-3" placeholder="GOOD10" /></label>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-700">Discount type<select value={form.discountType} onChange={(event) => update('discountType', event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3"><option value="percentage">Percentage</option><option value="fixed">Fixed INR amount</option></select></label>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-700">Discount value<input required type="number" min="0.01" max={form.discountType === 'percentage' ? '100' : undefined} step="0.01" value={form.discountValue} onChange={(event) => update('discountValue', event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3" /></label>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-700">Minimum subtotal (₹)<input type="number" min="0" step="0.01" value={form.minimumSubtotal} onChange={(event) => update('minimumSubtotal', event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3" /></label>
        {form.discountType === 'percentage' && <label className="grid gap-1.5 text-xs font-semibold text-slate-700">Maximum discount (₹, optional)<input type="number" min="0.01" step="0.01" value={form.maximumDiscount} onChange={(event) => update('maximumDiscount', event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3" /></label>}
        <label className="grid gap-1.5 text-xs font-semibold text-slate-700">Total uses (optional)<input type="number" min="1" step="1" value={form.usageLimit} onChange={(event) => update('usageLimit', event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3" /></label>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-700">Starts at (optional)<input type="datetime-local" value={form.startsAt} onChange={(event) => update('startsAt', event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3" /></label>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-700">Expires at (optional)<input type="datetime-local" value={form.expiresAt} onChange={(event) => update('expiresAt', event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3" /></label>
      </div>
      <button disabled={busy} className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"><TicketCheck size={15} />{busy ? 'Saving…' : 'Create coupon'}</button>
    </form>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-slate-900">Coupons</h2><p className="mt-1 text-xs text-slate-500">Each created order consumes one use. Cancellation, failed payment, or refund does not restore a use automatically.</p></div><button type="button" onClick={() => void loadCoupons()} disabled={loading} aria-label="Refresh coupons" className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button></div>
      {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading coupons…</p> : coupons.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No coupons created yet.</p> : <div className="divide-y divide-slate-100">{coupons.map((coupon) => <article key={coupon._id} className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
        <div><div className="flex flex-wrap items-center gap-2"><b className="font-mono text-sm text-slate-900">{coupon.code}</b><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${coupon.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{coupon.isActive ? 'ACTIVE' : 'PAUSED'}</span></div><p className="mt-1 text-xs text-slate-600">{coupon.discountType === 'percentage' ? `${coupon.discountValue}% off` : `₹${Number(coupon.discountValue).toFixed(2)} off`}{coupon.maximumDiscount ? ` · up to ₹${Number(coupon.maximumDiscount).toFixed(2)}` : ''} · min ₹{Number(coupon.minimumSubtotal || 0).toFixed(2)}</p><p className="mt-1 text-[11px] text-slate-500">Uses {coupon.usageCount}{coupon.usageLimit ? ` / ${coupon.usageLimit}` : ''} · Expires {localDateTime(coupon.expiresAt)}</p></div>
        <button type="button" disabled={busy} onClick={() => void toggle(coupon)} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{coupon.isActive ? 'Pause coupon' : 'Activate coupon'}</button>
      </article>)}</div>}
    </section>
  </div>
}
