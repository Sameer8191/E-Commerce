import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, MapPin, Package, Pencil, Plus, ShieldCheck, Trash2, UserRound, X } from 'lucide-react'
import Navbar from '../../components/layout/Navbar.jsx'
import Footer from '../../components/layout/Footer.jsx'
import api from '../../api/axios.js'

const fieldClass = 'mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#2874f0] focus:ring-4 focus:ring-blue-50'
const emptyAddress = { fullName: '', phone: '', addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '', country: 'India', isDefault: false }

export default function ProfilePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [addressForm, setAddressForm] = useState(null)
  const [addressBusy, setAddressBusy] = useState(false)
  const [emailForm, setEmailForm] = useState({ email: '', password: '', otp: '', stage: 'request', busy: false, message: '' })
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

  const refreshProfile = async () => {
    const response = await api.get('/users/me')
    setProfile(response.data?.user || null)
  }

  const saveAddress = async (event) => {
    event.preventDefault()
    setAddressBusy(true)
    setError('')
    setNotice('')
    try {
      const payload = { ...addressForm, isDefault: Boolean(addressForm.isDefault) }
      if (addressForm._id) await api.patch(`/users/me/addresses/${addressForm._id}`, { address: payload })
      else await api.post('/users/me/addresses', { address: payload })
      setAddressForm(null)
      await refreshProfile()
      setNotice('Your delivery address has been saved.')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save this address.')
    } finally {
      setAddressBusy(false)
    }
  }

  const removeAddress = async (address) => {
    if (!window.confirm('Remove this saved address?')) return
    setAddressBusy(true)
    setError('')
    try {
      await api.delete(`/users/me/addresses/${address._id}`)
      await refreshProfile()
      setNotice('Saved address removed.')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not remove this address.')
    } finally {
      setAddressBusy(false)
    }
  }

  const makeAddressDefault = async (address) => {
    setAddressBusy(true)
    setError('')
    try {
      await api.patch(`/users/me/addresses/${address._id}`, { address: {
        fullName: address.fullName, phone: address.phone, addressLine1: address.street, addressLine2: address.street2 || '',
        city: address.city, state: address.state, postalCode: address.postalCode,
        country: address.country || 'India', isDefault: true,
      } })
      await refreshProfile()
      setNotice('Default delivery address updated.')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update the default address.')
    } finally {
      setAddressBusy(false)
    }
  }

  useEffect(() => {
    let active = true
    if (!window.localStorage.getItem('authToken')) {
      navigate('/login?redirect=%2Faccount', { replace: true })
      return () => { active = false }
    }
    api.get('/users/me').then((response) => {
      if (!active) return
      const user = response.data?.user
      setProfile(user)
      setForm({ name: user?.name || '', phone: user?.phone || '' })
    }).catch((requestError) => {
      if (!active) return
      if (requestError.response?.status === 401) {
        window.localStorage.removeItem('authToken')
        navigate('/login?redirect=%2Faccount', { replace: true })
      } else setError(requestError.response?.data?.message || 'Could not load your account.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [navigate])

  const saveProfile = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await api.patch('/users/me', { name: form.name.trim(), phone: form.phone.trim() })
      setProfile(response.data?.user || profile)
      setNotice('Your account details have been saved.')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Your details could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const submitEmailChange = async (event) => {
    event.preventDefault()
    setEmailForm((current) => ({ ...current, busy: true, message: '' }))
    try {
      if (emailForm.stage === 'request') {
        const response = await api.post('/users/me/email-change', { email: emailForm.email, password: emailForm.password })
        setEmailForm((current) => ({ ...current, stage: 'confirm', busy: false, message: response.data?.message || 'Enter the code sent to your new email.' }))
      } else {
        const response = await api.post('/users/me/email-change/confirm', { otp: emailForm.otp })
        setEmailForm((current) => ({ ...current, busy: false, message: response.data?.message || 'Email updated.' }))
        window.localStorage.removeItem('authToken')
        navigate('/login?redirect=%2Faccount', { replace: true })
      }
    } catch (requestError) {
      setEmailForm((current) => ({ ...current, busy: false, message: requestError.response?.data?.message || 'Could not update your email.' }))
    }
  }

  const closeAccount = async (event) => {
    event.preventDefault()
    if (!window.confirm('Close your account? You will be signed out and will no longer be able to access it.')) return
    setDeleteBusy(true)
    setError('')
    try {
      await api.delete('/users/me', { data: { password: deletePassword } })
      window.localStorage.removeItem('authToken')
      navigate('/', { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not close your account.')
    } finally { setDeleteBusy(false) }
  }

  return <div className="min-h-screen bg-[#f5f6f8] text-slate-800">
    <Navbar />
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#2874f0]"><ArrowLeft size={16} /> Back to shop</Link>
      <div className="mb-7 mt-6">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#2874f0]">Your account</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#172337]">Account overview</h1>
        <p className="mt-2 text-sm text-slate-500">Keep your contact details up to date and find your orders and saved items.</p>
      </div>
      {error && <p className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}</p>}
      {notice && <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">{notice}</p>}
      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Loading your account…</div> : profile && <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={saveProfile} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-[#2874f0]"><UserRound size={20} /></span>
            <div><h2 className="font-bold text-[#172337]">Personal information</h2><p className="mt-1 text-xs text-slate-500">Your email address is used to sign in.</p></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">Full name<input className={fieldClass} required minLength={2} maxLength={50} autoComplete="name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label className="text-xs font-semibold text-slate-700">Phone number<input className={fieldClass} type="tel" maxLength={30} autoComplete="tel" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Add a phone number" /></label>
            <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Email address<input className={`${fieldClass} bg-slate-50 text-slate-500`} type="email" value={profile.email || ''} readOnly /></label>
          </div>
          <button disabled={saving} className="mt-6 rounded-xl bg-[#172337] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2874f0] disabled:cursor-wait disabled:opacity-60">{saving ? 'Saving…' : 'Save changes'}</button>
        </form>
        <aside className="space-y-4">
          <Link to="/account/privacy" className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:shadow-sm"><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><ShieldCheck size={18}/></span><span className="flex-1"><b className="block text-sm text-[#172337]">Privacy &amp; data</b><small className="mt-1 block text-xs text-slate-500">Export your account data and manage email consent</small></span><span className="text-slate-400">→</span></Link>
          <Link to="/orders" className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:shadow-sm"><span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><Package size={19} /></span><span className="flex-1"><b className="block text-sm text-[#172337]">Your orders</b><small className="mt-1 block text-xs text-slate-500">Track deliveries and request returns</small></span><span className="text-slate-400">→</span></Link>
          <Link to="/wishlist" className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:shadow-sm"><span className="grid size-10 place-items-center rounded-xl bg-rose-50 text-rose-600">♡</span><span className="flex-1"><b className="block text-sm text-[#172337]">Saved items</b><small className="mt-1 block text-xs text-slate-500">Your wishlist, all in one place</small></span><span className="text-slate-400">→</span></Link>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><MapPin size={18} /></span><div><h2 className="text-sm font-bold text-[#172337]">Saved addresses</h2><p className="mt-1 text-xs text-slate-500">Choose an address at checkout</p></div></div><button type="button" disabled={addressBusy} onClick={() => setAddressForm({ ...emptyAddress })} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"><Plus size={14} />Add</button></div>
            {profile.addresses?.length ? (
              <div className="mt-4 space-y-3">
                {profile.addresses.map((address) => (
                  <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600" key={address._id}>
                    <b className="text-slate-800">{address.fullName}</b>
                    {address.isDefault && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Default</span>}
                    <p>{address.street}{address.street2 ? `, ${address.street2}` : ''}, {address.city}, {address.state} {address.postalCode}, {address.country}</p>
                    <p>{address.phone}</p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {!address.isDefault && <button type="button" disabled={addressBusy} onClick={() => makeAddressDefault(address)} className="font-semibold text-blue-700 disabled:opacity-50">Make default</button>}
                      <button type="button" disabled={addressBusy} onClick={() => setAddressForm({ ...emptyAddress, ...address, addressLine1: address.street || '' })} className="inline-flex items-center gap-1 font-semibold text-slate-600 disabled:opacity-50"><Pencil size={12} />Edit</button>
                      <button type="button" disabled={addressBusy} onClick={() => removeAddress(address)} className="inline-flex items-center gap-1 font-semibold text-rose-700 disabled:opacity-50"><Trash2 size={12} />Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="mt-4 text-xs leading-5 text-slate-500">Save an address here to select it during checkout.</p>}
            {addressForm && <form onSubmit={saveAddress} className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between"><b className="text-xs text-slate-800">{addressForm._id ? 'Edit address' : 'New address'}</b><button type="button" aria-label="Close address form" onClick={() => setAddressForm(null)} className="text-slate-400"><X size={16} /></button></div>
              <div className="grid gap-3 sm:grid-cols-2">{[['fullName','Full name'],['phone','Phone'],['addressLine1','Address line'],['addressLine2','Apartment / landmark'],['city','City'],['state','State'],['postalCode','Postal code'],['country','Country']].map(([key,label]) => <label key={key} className="text-[11px] font-semibold text-slate-600">{label}<input className={fieldClass} required={!['addressLine2'].includes(key)} maxLength={200} value={addressForm[key] || ''} onChange={(event) => setAddressForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={Boolean(addressForm.isDefault)} onChange={(event) => setAddressForm((current) => ({ ...current, isDefault: event.target.checked }))} />Set as default address</label>
              <button disabled={addressBusy} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#172337] px-4 text-xs font-semibold text-white disabled:opacity-50"><Check size={14} />{addressBusy ? 'Saving…' : 'Save address'}</button>
            </form>}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold text-[#172337]">Change email address</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">We’ll send a code to verify the new address. You’ll need to sign in again afterward.</p>
            <form onSubmit={submitEmailChange} className="mt-3 grid gap-3">
              {emailForm.stage === 'request' ? <><label className="text-xs font-semibold text-slate-600">New email<input className={fieldClass} type="email" required autoComplete="email" maxLength={254} value={emailForm.email} onChange={(event) => setEmailForm((current) => ({ ...current, email: event.target.value }))} /></label><label className="text-xs font-semibold text-slate-600">Current password<input className={fieldClass} type="password" required autoComplete="current-password" value={emailForm.password} onChange={(event) => setEmailForm((current) => ({ ...current, password: event.target.value }))} /></label></> : <label className="text-xs font-semibold text-slate-600">Six-digit code<input className={fieldClass} inputMode="numeric" autoComplete="one-time-code" required maxLength={6} value={emailForm.otp} onChange={(event) => setEmailForm((current) => ({ ...current, otp: event.target.value.replace(/\D/g, '').slice(0, 6) }))} /></label>}
              {emailForm.message && <p className="text-xs text-slate-600" role="status">{emailForm.message}</p>}
              <button disabled={emailForm.busy} className="h-10 rounded-lg bg-[#172337] px-4 text-xs font-semibold text-white disabled:opacity-50">{emailForm.busy ? 'Please wait…' : emailForm.stage === 'request' ? 'Send confirmation code' : 'Confirm new email'}</button>
            </form>
          </div>
          <div className="flex items-start gap-3 rounded-2xl bg-[#172337] p-5 text-white"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#ffe500]" /><div className="text-xs leading-5 text-slate-300"><p><b className="block text-white">Account security</b>Keep your password private. Need to reset it? <Link className="font-semibold text-[#ffe500] hover:underline" to="/password-reset">Update your password</Link>.</p><button className="mt-4 font-semibold text-white underline decoration-white/40 underline-offset-4 hover:text-[#ffe500]" type="button" onClick={() => { window.localStorage.removeItem('authToken'); navigate('/login', { replace: true }) }}>Sign out</button></div></div>
          <form onSubmit={closeAccount} className="rounded-2xl border border-rose-200 bg-white p-5">
            <h2 className="text-sm font-bold text-rose-800">Close account</h2><p className="mt-1 text-xs leading-5 text-slate-500">This disables sign-in and removes account access. Your past order records may be retained for service and legal obligations.</p>
            <label className="mt-3 block text-xs font-semibold text-slate-600">Current password<input className={fieldClass} type="password" autoComplete="current-password" required value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} /></label>
            <button disabled={deleteBusy} className="mt-3 rounded-lg border border-rose-300 px-4 py-2.5 text-xs font-semibold text-rose-700 disabled:opacity-50">{deleteBusy ? 'Closing account…' : 'Close my account'}</button>
          </form>
        </aside>
      </div>}
    </main>
    <Footer />
  </div>
}
