import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, MessageCircleQuestion } from 'lucide-react'
import Navbar from '../../components/layout/Navbar.jsx'
import Footer from '../../components/layout/Footer.jsx'
import api from '../../api/axios.js'

const initialForm = { name: '', email: '', orderNumber: '', subject: '', message: '' }

export default function ContactPage() {
  const [form, setForm] = useState(initialForm)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await api.post('/storefront/contact', form)
      setMessage(response.data?.message || 'Your message has been sent.')
      setForm(initialForm)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not send your message. Please try again.')
    } finally { setBusy(false) }
  }

  return <div className="min-h-screen bg-[#f5f6f8] text-slate-800"><Navbar /><main className="mx-auto max-w-5xl px-4 py-9 sm:px-6 sm:py-14">
    <Link to="/help" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#2874f0]"><MessageCircleQuestion size={16}/> Help and FAQs</Link>
    <div className="mt-6 grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
      <section><p className="text-xs font-bold uppercase tracking-[.18em] text-[#2874f0]">Customer care</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[#172337]">How can we help?</h1><p className="mt-3 text-sm leading-6 text-slate-600">Send us a note about an order, a product, or anything else. Include your order number if you have one.</p><a className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#2874f0]" href="mailto:help@goodthings.shop"><Mail size={16}/> help@goodthings.shop</a><p className="mt-7 text-xs leading-5 text-slate-500">Need delivery or return information? Visit <Link className="font-semibold text-[#2874f0]" to="/help">Help & FAQs</Link> or <Link className="font-semibold text-[#2874f0]" to="/orders">look up your order</Link>.</p></section>
      <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-700">Your name<input className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" required minLength={2} maxLength={80} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label><label className="text-xs font-semibold text-slate-700">Email address<input className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" required type="email" autoComplete="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></label></div>
        <label className="text-xs font-semibold text-slate-700">Order number (optional)<input className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" maxLength={80} value={form.orderNumber} onChange={(event) => setForm({ ...form, orderNumber: event.target.value })}/></label>
        <label className="text-xs font-semibold text-slate-700">Subject<input className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" required minLength={3} maxLength={120} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })}/></label>
        <label className="text-xs font-semibold text-slate-700">Message<textarea className="mt-1.5 min-h-36 w-full rounded-lg border border-slate-200 p-3 text-sm font-normal" required minLength={10} maxLength={4000} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })}/></label>
        {error && <p className="text-sm text-rose-700" role="alert">{error}</p>}{message && <p className="text-sm text-emerald-700" role="status">{message}</p>}
        <button disabled={busy} className="h-11 rounded-lg bg-[#172337] px-5 text-sm font-semibold text-white hover:bg-[#2874f0] disabled:opacity-50">{busy ? 'Sending…' : 'Send message'}</button>
      </form>
    </div>
  </main><Footer/></div>
}
