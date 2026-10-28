import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import Navbar from '../../components/layout/Navbar.jsx'
import Footer from '../../components/layout/Footer.jsx'
import CheckoutModal from '../../components/checkout/CheckoutModal.jsx'
import api from '../../api/axios.js'
import { getGuestCart, guestCartEventName, updateGuestCartItem } from '../../api/guestCart.js'

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value) || 0)

export default function CartPage() {
  const navigate = useNavigate()
  const [authenticated, setAuthenticated] = useState(() => Boolean(window.localStorage.getItem('authToken')))
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(() => Boolean(window.localStorage.getItem('authToken')))
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [guestItems, setGuestItems] = useState(() => getGuestCart())

  useEffect(() => {
    const refreshGuestItems = () => setGuestItems(getGuestCart())
    window.addEventListener(guestCartEventName(), refreshGuestItems)
    return () => window.removeEventListener(guestCartEventName(), refreshGuestItems)
  }, [])

  const refreshCart = useCallback(async () => {
    const response = await api.get('/cart')
    const nextItems = (response.data?.data?.items || []).filter((item) => item.product)
    setItems(nextItems)
    setCartCount(nextItems.reduce((sum, item) => sum + item.quantity, 0))
  }, [])

  useEffect(() => {
    if (!authenticated) return
    const timer = window.setTimeout(() => refreshCart().catch((requestError) => {
      if (requestError.response?.status === 401) {
        window.localStorage.removeItem('authToken')
        setAuthenticated(false)
        setError('Your session expired. Sign in again to view your saved cart.')
      } else setError(requestError.response?.data?.message || 'We could not load your cart.')
    }).finally(() => setLoading(false)), 0)
    return () => window.clearTimeout(timer)
  }, [authenticated, refreshCart])

  const cartItems = authenticated ? items : guestItems.map((item) => ({
    ...item,
    available: Number(item.product?.stock) >= guestItems.filter((entry) => entry.product?._id === item.product?._id).reduce((sum, entry) => sum + entry.quantity, 0),
  }))
  const visibleCartCount = authenticated ? cartCount : cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = useMemo(() => cartItems.reduce((sum, item) => sum + Number(item.product.price || 0) * item.quantity, 0), [cartItems])

  const changeQuantity = async (item, quantity) => {
    if (!authenticated) {
      updateGuestCartItem(item.product._id, quantity, item.variant || '')
      return
    }
    const id = item.product._id
    const variant = item.variant || ''
    setBusyId(`${id}:${variant}`); setError('')
    try {
      if (quantity < 1) await api.delete(`/cart/items/${id}?variant=${encodeURIComponent(variant)}`)
      else await api.patch(`/cart/items/${id}`, { quantity, variant })
      await refreshCart()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update this item.')
      await refreshCart().catch(() => {})
    } finally { setBusyId('') }
  }

  return <div className="min-h-screen bg-[#f7f7f5] text-slate-900">
    <Navbar cartCount={visibleCartCount} onOpenCart={() => setCheckoutOpen(true)} />
    <main className="mx-auto max-w-6xl px-4 py-9 sm:px-6 lg:py-14">
      <Link to="/products" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"><ArrowLeft size={16}/> Continue shopping</Link>
      <div className="mb-8 mt-6 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-600">Your picks</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Shopping cart</h1></div><span className="text-sm text-slate-500">{visibleCartCount} {visibleCartCount === 1 ? 'item' : 'items'}</span></div>
      {error && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error} {!authenticated && <Link className="font-semibold underline" to="/login?redirect=%2Fcart">Sign in</Link>}</p>}
      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Loading your cart…</div> : cartItems.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center"><ShoppingBag className="mx-auto text-slate-300" size={38}/><h2 className="mt-4 text-lg font-bold">Your cart is empty</h2><p className="mt-2 text-sm text-slate-500">{authenticated ? 'Find something good for your home, work, or everyday.' : 'Add products to your bag and they’ll stay saved on this device.'}</p><Link to="/products" className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Explore products</Link></div> : <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {cartItems.map((item) => { const product = item.product; const variant = item.variant || ''; const image = product.images?.[0]?.url || product.images?.[0] || ''; const busy = busyId === `${product._id}:${variant}`; const otherVariantQuantity = cartItems.filter((entry) => entry.product?._id === product._id && (entry.variant || '') !== variant).reduce((sum, entry) => sum + entry.quantity, 0); return <article key={`${product._id}:${variant}`} className="flex gap-4 border-b border-slate-100 p-4 last:border-0 sm:gap-5 sm:p-6">
            <Link to={`/products/${product._id}`} className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 sm:size-32">{image ? <img src={image} alt={product.name} className="h-full w-full object-cover"/> : <ShoppingBag className="text-slate-300"/>}</Link>
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="min-w-0"><Link to={`/products/${product._id}`} className="line-clamp-2 font-semibold text-slate-900 hover:text-indigo-700">{product.name}</Link>{variant && <p className="mt-1 text-xs text-slate-500">Option: {variant}</p>}<p className="mt-1 text-sm text-slate-500">{money(product.price)} each</p><p className={`mt-2 text-xs font-medium ${item.available ? 'text-emerald-700' : 'text-rose-600'}`}>{item.available ? `${product.stock} available` : 'Currently unavailable'}</p></div><div className="flex items-center justify-between gap-4 sm:justify-end"><div className="flex h-9 items-center rounded-lg border border-slate-200"><button type="button" disabled={busy} aria-label={`Decrease ${product.name} quantity`} onClick={() => changeQuantity(item, item.quantity - 1)} className="grid h-full w-9 place-items-center text-slate-600 disabled:opacity-40"><Minus size={14}/></button><span className="min-w-8 text-center text-sm font-semibold">{item.quantity}</span><button type="button" disabled={busy || otherVariantQuantity + item.quantity >= product.stock} aria-label={`Increase ${product.name} quantity`} onClick={() => changeQuantity(item, item.quantity + 1)} className="grid h-full w-9 place-items-center text-slate-600 disabled:opacity-40"><Plus size={14}/></button></div><b className="w-24 text-right text-sm">{money(product.price * item.quantity)}</b><button type="button" disabled={busy} aria-label={`Remove ${product.name}`} onClick={() => changeQuantity(item, 0)} className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"><Trash2 size={16}/></button></div></div>
          </article> })}
        </section>
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-bold">Order summary</h2><div className="mt-5 flex justify-between border-b border-slate-100 pb-4 text-sm"><span className="text-slate-500">Subtotal</span><b>{money(subtotal)}</b></div><p className="mt-4 text-xs leading-5 text-slate-500">Free shipping across India. Applicable GST is included in listed prices. Eligible coupon codes can be applied at checkout.</p><div className="mt-5 flex justify-between text-base"><span className="font-semibold">Estimated total</span><b>{money(subtotal)}</b></div><button type="button" disabled={cartItems.some((item) => !item.available)} onClick={() => authenticated ? setCheckoutOpen(true) : navigate('/login?redirect=%2Fcart')} className="mt-6 h-12 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300">{cartItems.some((item) => !item.available) ? 'Review unavailable items' : authenticated ? 'Continue to checkout' : 'Sign in to checkout'}</button><p className="mt-3 text-center text-[11px] text-slate-400">{authenticated ? 'Secure checkout · Payment in INR' : 'Your guest bag will sync after sign in.'}</p></aside>
      </div>}
    </main>
    <Footer />
    <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} onCartCount={(count) => { setCartCount(count); setAuthenticated(Boolean(window.localStorage.getItem('authToken'))); refreshCart().catch(() => {}) }} onAdded={() => refreshCart().catch(() => {})}/>
  </div>
}
