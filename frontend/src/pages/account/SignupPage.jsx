import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import api from '../../api/axios.js'
import './SignupPage.css'

function getRedirectTarget(searchParams) {
  const path = searchParams.get('redirect') || '/'
  return path.startsWith('/') && !path.startsWith('//') ? path : '/'
}

export default function SignupPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isVendorSignup = location.pathname === '/vendor/signup'
  const target = isVendorSignup ? '/vendor' : getRedirectTarget(searchParams)
  const [step, setStep] = useState('register')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const register = async (event) => {
    event.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Your passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const response = await api.post('/auth/register', {
        name: name.trim(),
        email: email.trim(),
        password,
        ...(phone.trim() && { phone: phone.trim() }),
      })
      setEmail(response.data?.user?.email || email.trim())
      setStep('verify')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create your account. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const verifyEmail = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.post('/auth/verify-email', { email: email.trim(), otp })
      navigate(`${isVendorSignup ? '/vendor/login' : '/login'}?verified=1&redirect=${encodeURIComponent(target)}`, { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'That code could not be verified. Check it and try again.')
    } finally {
      setBusy(false)
    }
  }

  return <main className={`signup-page grid min-h-screen bg-[#f1f3f6] font-sans text-[#172337] lg:grid-cols-2${isVendorSignup ? ' vendor-signup' : ''}`}>
    <section className="relative hidden overflow-hidden bg-[#172337] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
      <Link className="relative z-10 w-fit text-2xl font-extrabold tracking-tight" to="/" aria-label="Goodthings home">goodthings<span className="text-[#ffe500]">.</span></Link>
      <div className="relative z-10 max-w-lg pb-16">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-200"><Sparkles size={14} className={isVendorSignup ? 'text-[#9ce0bd]' : 'text-[#ffe500]'} />{isVendorSignup ? 'GOODTHINGS SELLER STUDIO' : 'A LITTLE MORE GOOD'}</span>
        <h1 className="text-5xl font-bold leading-[1.08] tracking-tight xl:text-6xl">{isVendorSignup ? <>Build your store on <span className="text-[#9ce0bd]">Goodthings.</span></> : <>Make room for the <span className="text-[#ffe500]">good stuff.</span></>}</h1>
        <p className="mt-6 max-w-md text-base leading-7 text-slate-300">{isVendorSignup ? 'Start with your personal account. After email verification, tell us about your store in the seller application.' : 'Create an account to keep your orders together and make checkout a little easier.'}</p>
      </div>
      <div className="relative z-10 flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={15} /> We’ll verify your email to protect your account.</div>
      <div className="pointer-events-none absolute -bottom-44 -right-40 h-[34rem] w-[34rem] rounded-full border border-white/10" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-[#2874f0]/20 blur-3xl" />
    </section>

    <section className="flex min-h-screen flex-col bg-white px-5 py-6 sm:px-10 lg:px-14 xl:px-24">
      <div className="flex items-center justify-between">
        <Link className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-[#2874f0]" to="/"><ArrowLeft size={16} /> Back to shop</Link>
        <Link className="text-lg font-extrabold tracking-tight text-[#172337] lg:hidden" to="/">goodthings<span className="text-[#2874f0]">.</span></Link>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        <div className="mb-7">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-[#2874f0]">{step === 'verify' ? <Mail size={22} /> : <UserRound size={22} />}</span>
          <p className="mt-7 text-xs font-bold uppercase tracking-[.2em] text-[#2874f0]">{isVendorSignup ? 'Seller account' : 'Your account'}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#172337] sm:text-4xl">{step === 'verify' ? 'Check your email' : isVendorSignup ? 'Create your account' : 'Create an account'}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">{step === 'verify' ? <>We sent a six-digit verification code to <b className="font-semibold text-slate-700">{email}</b>. The code is valid for 10 minutes.</> : isVendorSignup ? 'Enter your personal details to get started. Store details come after your account is verified.' : 'A few details, then you’re ready to find something good.'}</p>
        </div>

        {step === 'register' ? <form className="space-y-4" onSubmit={register}>
          <label className="block text-sm font-semibold text-slate-700" htmlFor="signup-name">Full name
            <span className="mt-2 flex h-12 items-center gap-3 rounded-lg border border-slate-200 px-3.5 transition focus-within:border-[#2874f0] focus-within:ring-4 focus-within:ring-blue-50"><UserRound size={17} className="shrink-0 text-slate-400" /><input className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm font-normal text-slate-800 outline-none placeholder:text-slate-400" id="signup-name" type="text" autoComplete="name" maxLength={50} placeholder="Your name" required value={name} onChange={(event) => setName(event.target.value)} /></span>
          </label>
          <label className="block text-sm font-semibold text-slate-700" htmlFor="signup-email">Email address
            <span className="mt-2 flex h-12 items-center gap-3 rounded-lg border border-slate-200 px-3.5 transition focus-within:border-[#2874f0] focus-within:ring-4 focus-within:ring-blue-50"><Mail size={17} className="shrink-0 text-slate-400" /><input className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm font-normal text-slate-800 outline-none placeholder:text-slate-400" id="signup-email" type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={(event) => setEmail(event.target.value)} /></span>
          </label>
          <label className="block text-sm font-semibold text-slate-700" htmlFor="signup-phone">Phone number <span className="font-normal text-slate-400">(optional)</span>
            <input className="mt-2 h-12 w-full rounded-lg border border-slate-200 px-3.5 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#2874f0] focus:ring-4 focus:ring-blue-50" id="signup-phone" type="tel" autoComplete="tel" placeholder="Your phone number" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-slate-700" htmlFor="signup-password">Password
            <span className="mt-2 flex h-12 items-center gap-3 rounded-lg border border-slate-200 px-3.5 transition focus-within:border-[#2874f0] focus-within:ring-4 focus-within:ring-blue-50"><LockKeyhole size={17} className="shrink-0 text-slate-400" /><input className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm font-normal text-slate-800 outline-none placeholder:text-slate-400" id="signup-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={72} placeholder="At least 8 characters" required value={password} onChange={(event) => setPassword(event.target.value)} /><button className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>
          </label>
          <label className="block text-sm font-semibold text-slate-700" htmlFor="signup-confirm-password">Confirm password
            <input className="mt-2 h-12 w-full rounded-lg border border-slate-200 px-3.5 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#2874f0] focus:ring-4 focus:ring-blue-50" id="signup-confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </label>
          {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-800" role="alert">{error}</p>}
          <button className="signup-submit flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#172337] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#243750] focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:cursor-wait disabled:opacity-60" type="submit" disabled={busy}>{busy ? 'Creating account…' : isVendorSignup ? 'Create seller account' : 'Create account'}</button>
          <p className="pt-1 text-center text-xs leading-5 text-slate-500">Google sign-up isn’t available for this store yet.</p>
        </form> : <form className="space-y-5" onSubmit={verifyEmail}>
          <label className="block text-sm font-semibold text-slate-700" htmlFor="signup-otp">Verification code
            <input className="mt-2 h-14 w-full rounded-lg border border-slate-200 px-4 text-center text-2xl font-bold tracking-[.5em] text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-[#2874f0] focus:ring-4 focus:ring-blue-50" id="signup-otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} />
          </label>
          {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-800" role="alert">{error}</p>}
          <button className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#172337] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#243750] focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:cursor-wait disabled:opacity-60" type="submit" disabled={busy || otp.length !== 6}>{busy ? 'Verifying…' : <><Check size={17} /> Verify email</>}</button>
          <button className="w-full py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-800" type="button" onClick={() => { setStep('register'); setOtp(''); setError('') }}>Back to account details</button>
        </form>}

        {step === 'register' && <p className="mt-6 text-center text-sm text-slate-500">{isVendorSignup ? 'Already have a seller account?' : 'Already have an account?'} <Link className="font-semibold text-[#2874f0] hover:underline" to={isVendorSignup ? '/vendor/login' : `/login${searchParams.get('redirect') ? `?redirect=${encodeURIComponent(searchParams.get('redirect'))}` : ''}`}>Sign in</Link></p>}
        <p className="mt-7 text-center text-xs leading-5 text-slate-500">Need help? <a className="font-semibold text-[#2874f0] hover:underline" href="mailto:help@goodthings.shop">Contact our team</a>.</p>
      </div>

      <p className="text-center text-xs text-slate-400">© {new Date().getFullYear()} Goodthings Supply Co.</p>
    </section>
  </main>
}
