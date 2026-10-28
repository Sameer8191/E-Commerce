import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import api from '../../api/axios.js'
import { mergeGuestCartToAccount } from '../../api/guestCart.js'
import './LoginPage.css'

function getRedirectTarget(location, searchParams) {
  const requestedPath = location.state?.from || searchParams.get('redirect') || '/'
  return requestedPath.startsWith('/') && !requestedPath.startsWith('//') ? requestedPath : '/'
}

export default function LoginPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isVendorLogin = location.pathname === '/vendor/login' || getRedirectTarget(location, searchParams).startsWith('/vendor')
  const target = isVendorLogin ? getRedirectTarget({ state: { from: '/vendor' } }, searchParams) : getRedirectTarget(location, searchParams)
  const verified = searchParams.get('verified') === '1'
  const reset = searchParams.get('reset') === '1'

  useEffect(() => {
    if (window.localStorage.getItem('authToken')) navigate(target, { replace: true })
  }, [navigate, target])

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await api.post('/auth/login', { email: email.trim(), password })
      const token = response.data?.token
      if (!token) throw new Error('Sign in did not return an access token. Please try again.')
      window.localStorage.setItem('authToken', token)
      try {
        await mergeGuestCartToAccount(api)
      } catch (mergeError) {
        window.localStorage.removeItem('authToken')
        throw mergeError
      }
      navigate(target, { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to sign in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <main className={`login-page grid min-h-screen bg-[#f1f3f6] font-sans text-[#172337] lg:grid-cols-2${isVendorLogin ? ' vendor-login' : ''}`}>
    <section className="relative hidden overflow-hidden bg-[#172337] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
      <Link className="relative z-10 w-fit text-2xl font-extrabold tracking-tight" to="/" aria-label="Goodthings home">goodthings<span className="text-[#ffe500]">.</span></Link>
      <div className="relative z-10 max-w-lg pb-16">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-200"><Sparkles size={14} className={isVendorLogin ? 'text-[#9ce0bd]' : 'text-[#ffe500]'} />{isVendorLogin ? 'GOODTHINGS SELLER STUDIO' : 'GOOD THINGS, EVERY DAY'}</span>
        <h1 className="text-5xl font-bold leading-[1.08] tracking-tight xl:text-6xl">{isVendorLogin ? <>Your next big thing starts <span className="text-[#9ce0bd]">here.</span></> : <>Welcome back to the <span className="text-[#ffe500]">good stuff.</span></>}</h1>
        <p className="mt-6 max-w-md text-base leading-7 text-slate-300">{isVendorLogin ? 'Sign in to manage your products, fulfill orders, and follow how your store is growing.' : 'Sign in to pick up where you left off, keep an eye on your orders, and find something good for your everyday.'}</p>
      </div>
      <div className="relative z-10 flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={15} /> Your account is protected with secure sign in.</div>
      <div className="pointer-events-none absolute -bottom-44 -right-40 h-[34rem] w-[34rem] rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-[25rem] w-[25rem] rounded-full border border-white/10" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-[#2874f0]/20 blur-3xl" />
    </section>

    <section className="flex min-h-screen flex-col bg-white px-5 py-6 sm:px-10 lg:px-14 xl:px-24">
      <div className="flex items-center justify-between">
        <Link className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-[#2874f0]" to="/"><ArrowLeft size={16} /> Back to shop</Link>
        <Link className="text-lg font-extrabold tracking-tight text-[#172337] lg:hidden" to="/">goodthings<span className="text-[#2874f0]">.</span></Link>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
        <div className="mb-8">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-[#2874f0]"><LockKeyhole size={22} /></span>
          <p className="mt-7 text-xs font-bold uppercase tracking-[.2em] text-[#2874f0]">{isVendorLogin ? 'Seller account' : 'Your account'}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#172337] sm:text-4xl">{isVendorLogin ? 'Welcome back' : 'Sign in'}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">{isVendorLogin ? 'Sign in to continue to your seller workspace.' : 'Use your email and password to access your account.'}</p>
        </div>

        <form className="space-y-5" onSubmit={submit}>
          {verified && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-5 text-emerald-800" role="status">Email verified. You can now sign in to your account.</p>}
          {reset && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-5 text-emerald-800" role="status">Your password has been reset. Sign in with your new password.</p>}
          <label className="block text-sm font-semibold text-slate-700" htmlFor="login-email">Email address
            <span className="mt-2 flex h-12 items-center gap-3 rounded-lg border border-slate-200 px-3.5 transition focus-within:border-[#2874f0] focus-within:ring-4 focus-within:ring-blue-50">
              <Mail size={17} className="shrink-0 text-slate-400" />
              <input className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm font-normal text-slate-800 outline-none placeholder:text-slate-400" id="login-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </span>
          </label>

          <label className="block text-sm font-semibold text-slate-700" htmlFor="login-password">Password
            <span className="mt-2 flex h-12 items-center gap-3 rounded-lg border border-slate-200 px-3.5 transition focus-within:border-[#2874f0] focus-within:ring-4 focus-within:ring-blue-50">
              <LockKeyhole size={17} className="shrink-0 text-slate-400" />
              <input className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm font-normal text-slate-800 outline-none placeholder:text-slate-400" id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required value={password} onChange={(event) => setPassword(event.target.value)} />
              <button className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </span>
          </label>
          <div className="-mt-2 text-right"><Link className="text-xs font-semibold text-[#2874f0] hover:underline" to={`/password-reset?redirect=${encodeURIComponent(target)}${email ? `&email=${encodeURIComponent(email)}` : ''}`}>Forgot password?</Link></div>

          {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-800" role="alert">{error}</p>}

          <button className="login-submit flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#172337] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#243750] focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:cursor-wait disabled:opacity-60" type="submit" disabled={busy}>
            {busy ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Signing in…</> : 'Sign in to your account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">{isVendorLogin ? 'New to selling on Goodthings?' : 'New to Goodthings?'} <Link className="font-semibold text-[#2874f0] hover:underline" to={isVendorLogin ? '/vendor/signup' : `/signup${searchParams.get('redirect') ? `?redirect=${encodeURIComponent(searchParams.get('redirect'))}` : ''}`}>{isVendorLogin ? 'Create a seller account' : 'Create an account'}</Link></p>

        <p className="mt-7 text-center text-xs leading-5 text-slate-500">By signing in, you agree to keep your account details secure. Need help? <a className="font-semibold text-[#2874f0] hover:underline" href="mailto:help@goodthings.shop">Contact our team</a>.</p>
      </div>

      <p className="text-center text-xs text-slate-400">© {new Date().getFullYear()} Goodthings Supply Co.</p>
    </section>
  </main>
}
