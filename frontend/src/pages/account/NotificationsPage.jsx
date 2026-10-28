import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell, Check, RefreshCw } from 'lucide-react'
import Navbar from '../../components/layout/Navbar.jsx'
import Footer from '../../components/layout/Footer.jsx'
import api from '../../api/axios.js'

const formatDate = (value) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/users/me/notifications')
      setNotifications(Array.isArray(response.data?.data) ? response.data.data : [])
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        window.localStorage.removeItem('authToken')
        navigate('/login?redirect=%2Fnotifications', { replace: true })
      } else setError(requestError.response?.data?.message || 'Could not load your notifications.')
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    if (!window.localStorage.getItem('authToken')) {
      navigate('/login?redirect=%2Fnotifications', { replace: true })
      return
    }
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load, navigate])

  const markRead = async (notification) => {
    setBusyId(notification._id)
    setError('')
    try {
      await api.patch(`/users/me/notifications/${notification._id}/read`)
      setNotifications((current) => current.map((item) => item._id === notification._id ? { ...item, readAt: new Date().toISOString() } : item))
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update this notification.')
    } finally {
      setBusyId('')
    }
  }

  return <div className="min-h-screen bg-[#f5f6f8] text-slate-800">
    <Navbar />
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#2874f0]"><ArrowLeft size={16} /> Back to shop</Link>
      <div className="mt-6 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#2874f0]">YOUR ACCOUNT</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[#172337]">Order updates</h1><p className="mt-2 text-sm text-slate-500">Payment, fulfillment, and refund updates for your orders.</p></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh</button></div>
      {error && <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}</p>}
      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading ? <p className="p-12 text-center text-sm text-slate-500">Loading your updates…</p> : notifications.length ? <div className="divide-y divide-slate-100">{notifications.map((notification) => <article key={notification._id} className={`flex gap-4 p-5 ${notification.readAt ? '' : 'bg-blue-50/40'}`}><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${notification.readAt ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-700'}`}><Bell size={18} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-bold text-[#172337]">{notification.title}</h2><time className="text-[11px] text-slate-400">{formatDate(notification.createdAt)}</time></div><p className="mt-1 text-sm leading-6 text-slate-600">{notification.message}</p>{notification.order && <Link className="mt-2 inline-block text-xs font-semibold text-[#2874f0] hover:underline" to="/orders">View your orders</Link>}</div>{!notification.readAt && <button type="button" disabled={busyId === notification._id} onClick={() => void markRead(notification)} aria-label="Mark notification as read" className="grid size-8 shrink-0 place-items-center rounded-lg text-blue-700 hover:bg-blue-100 disabled:opacity-40"><Check size={16} /></button>}</article>)}</div> : <div className="px-6 py-16 text-center"><Bell size={30} className="mx-auto text-slate-300" /><h2 className="mt-4 font-bold text-[#172337]">No order updates yet</h2><p className="mt-2 text-sm text-slate-500">Important payment, delivery, and refund updates will show up here.</p><Link to="/orders" className="mt-5 inline-flex rounded-lg bg-[#172337] px-4 py-2.5 text-sm font-semibold text-white">View orders</Link></div>}
      </section>
    </main>
    <Footer />
  </div>
}
