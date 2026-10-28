import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, ShieldCheck } from 'lucide-react'
import Navbar from '../../components/layout/Navbar.jsx'
import Footer from '../../components/layout/Footer.jsx'
import api from '../../api/axios.js'

export default function PrivacyPage() {
  const navigate = useNavigate()
  const [privacy, setPrivacy] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (!window.localStorage.getItem('authToken')) { navigate('/login?redirect=%2Faccount%2Fprivacy', { replace: true }); return }
    let active = true
    api.get('/users/me/export').then((response) => { if (active) setPrivacy(response.data?.data || null) }).catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Could not load privacy settings.') })
    return () => { active = false }
  }, [navigate])

  const downloadData = async () => {
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await api.get('/users/me/export')
      const data = response.data?.data
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = 'goodthings-account-data.json'; link.click()
      URL.revokeObjectURL(url)
      setPrivacy(data)
      setMessage('Your account data export has downloaded.')
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not prepare your data export.') }
    finally { setBusy(false) }
  }

  const unsubscribe = async () => {
    if (!privacy?.profile?.email) return
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await api.post('/storefront/newsletter/unsubscribe', { email: privacy.profile.email })
      setPrivacy((current) => ({ ...current, newsletter: { subscribed: false } }))
      setMessage(response.data?.message || 'You are unsubscribed.')
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not update your newsletter settings.') }
    finally { setBusy(false) }
  }

  return <div className="min-h-screen bg-[#f5f6f8] text-slate-800"><Navbar/><main className="mx-auto max-w-3xl px-4 py-9 sm:px-6 sm:py-12">
    <Link to="/account" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#2874f0]"><ArrowLeft size={16}/> Your account</Link>
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"><span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-[#2874f0]"><ShieldCheck size={20}/></span><p className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-[#2874f0]">Your data, your choice</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[#172337]">Privacy and data</h1><p className="mt-3 text-sm leading-6 text-slate-600">View a copy of your profile, saved addresses, order history, and reviews. You can also opt out of Goodthings newsletter emails here.</p>
      {error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p>}{message && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{message}</p>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2"><article className="rounded-xl border border-slate-200 p-4"><h2 className="text-sm font-bold">Account data</h2><p className="mt-1 text-xs leading-5 text-slate-500">Download a JSON copy of your account information and store activity.</p><button disabled={busy} onClick={downloadData} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-[#172337] px-4 text-xs font-semibold text-white disabled:opacity-50"><Download size={14}/>{busy ? 'Please wait…' : 'Download my data'}</button></article>
        <article className="rounded-xl border border-slate-200 p-4"><h2 className="text-sm font-bold">Newsletter preferences</h2><p className="mt-1 text-xs leading-5 text-slate-500">{privacy ? privacy.newsletter?.subscribed ? `Subscribed since ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(privacy.newsletter.consentedAt))}.` : 'You are not subscribed to newsletter updates.' : 'Loading your preference…'} You can subscribe again from the homepage.</p>{privacy?.newsletter?.subscribed && <button disabled={busy} onClick={unsubscribe} className="mt-4 h-10 rounded-lg border border-rose-200 px-4 text-xs font-semibold text-rose-700 disabled:opacity-50">Unsubscribe</button>}</article></div>
      <div className="mt-6 border-t border-slate-100 pt-5 text-sm text-slate-600">To change your contact details or close your account, visit <Link className="font-semibold text-[#2874f0]" to="/account">account settings</Link>. Read the <Link className="font-semibold text-[#2874f0]" to="/policies/privacy">privacy notice</Link> for more information.</div>
    </section>
  </main><Footer/></div>
}
