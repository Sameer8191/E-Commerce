import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, KeyRound, Mail, ShieldCheck } from 'lucide-react'
import api from '../../api/axios.js'

const fieldClass = 'mt-2 h-12 w-full rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#2874f0] focus:ring-4 focus:ring-blue-50'

export default function PasswordResetPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState('request')
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const requestCode = async (event) => {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await api.post('/auth/forgot-password', { email: email.trim() })
      setNotice(response.data?.message || 'If an account exists, a reset code has been sent.')
      setStep('reset')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not request a reset code.')
    } finally { setBusy(false) }
  }

  const resetPassword = async (event) => {
    event.preventDefault()
    setError(''); setNotice('')
    if (password !== confirmPassword) {
      setError('Your passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const response = await api.post('/auth/reset-password', { email: email.trim(), otp, password })
      setNotice(response.data?.message || 'Your password has been reset.')
      window.localStorage.removeItem('authToken')
      navigate(`/login?reset=1&redirect=${encodeURIComponent(searchParams.get('redirect') || '/')}`, { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not reset your password.')
    } finally { setBusy(false) }
  }

  return <main className="grid min-h-screen bg-[#f1f3f6] font-sans text-[#172337] lg:grid-cols-2">
    <section className="relative hidden overflow-hidden bg-[#172337] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
      <Link className="relative z-10 w-fit text-2xl font-extrabold tracking-tight" to="/">goodthings<span className="text-[#ffe500]">.</span></Link>
      <div className="relative z-10 max-w-lg pb-16"><span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200"><ShieldCheck size={14} className="text-[#ffe500]" /> ACCOUNT SECURITY</span><h1 className="text-5xl font-bold leading-tight tracking-tight">A fresh start for your <span className="text-[#ffe500]">account.</span></h1><p className="mt-6 max-w-md text-base leading-7 text-slate-300">We’ll send a one-time code to your email so you can securely choose a new password.</p></div>
      <span className="relative z-10 text-xs text-slate-400">Reset codes expire after 10 minutes.</span><div className="pointer-events-none absolute -bottom-40 -right-36 size-[30rem] rounded-full border border-white/10" />
    </section>
    <section className="flex min-h-screen flex-col bg-white px-5 py-6 sm:px-10 lg:px-14 xl:px-24">
      <Link className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-[#2874f0]" to="/login"><ArrowLeft size={16} /> Back to sign in</Link>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
        <span className="grid size-12 place-items-center rounded-2xl bg-blue-50 text-[#2874f0]">{step === 'request' ? <Mail size={21} /> : <KeyRound size={21} />}</span>
        <p className="mt-7 text-xs font-bold uppercase tracking-[.2em] text-[#2874f0]">Your account</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight">{step === 'request' ? 'Forgot password?' : 'Choose a new password'}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">{step === 'request' ? 'Enter your account email and we’ll send a reset code if an account matches.' : <>Enter the six-digit code sent to <b className="text-slate-700">{email}</b>.</>}</p>
        {notice && <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{notice}</p>}
        {error && <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">{error}</p>}
        {step === 'request' ? <form className="mt-6 space-y-5" onSubmit={requestCode}><label className="block text-sm font-semibold text-slate-700">Email address<input className={fieldClass} type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><button className="h-12 w-full rounded-xl bg-[#172337] text-sm font-bold text-white hover:bg-[#2874f0] disabled:opacity-60" disabled={busy}>{busy ? 'Sending…' : 'Send reset code'}</button></form>
          : <form className="mt-6 space-y-4" onSubmit={resetPassword}><label className="block text-sm font-semibold text-slate-700">Six-digit reset code<input className={`${fieldClass} text-center text-xl font-bold tracking-[.4em]`} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label><label className="block text-sm font-semibold text-slate-700">New password<input className={fieldClass} type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="block text-sm font-semibold text-slate-700">Confirm new password<input className={fieldClass} type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label><button className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#172337] text-sm font-bold text-white hover:bg-[#2874f0] disabled:opacity-60" disabled={busy || otp.length !== 6}>{busy ? 'Updating…' : <><Check size={16} /> Reset password</>}</button><button className="w-full py-2 text-sm font-semibold text-slate-500 hover:text-slate-800" type="button" disabled={busy} onClick={() => { setStep('request'); setOtp(''); setError(''); setNotice('') }}>Request a new code</button></form>}
      </div>
      <p className="text-center text-xs text-slate-400">© {new Date().getFullYear()} Goodthings Supply Co.</p>
    </section>
  </main>
}
