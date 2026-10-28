import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Heart, ShoppingBag } from 'lucide-react'
import Navbar from '../../components/layout/Navbar.jsx'
import Footer from '../../components/layout/Footer.jsx'
import ProductCard from '../../components/catalog/ProductCard.jsx'
import CheckoutModal from '../../components/checkout/CheckoutModal.jsx'
import api from '../../api/axios.js'

export default function WishlistPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [pendingProduct, setPendingProduct] = useState(null)

  useEffect(() => {
    let active = true
    if (!window.localStorage.getItem('authToken')) {
      navigate('/login?redirect=%2Fwishlist', { replace: true })
      return () => { active = false }
    }
    api.get('/wishlist').then((response) => {
      if (active) {
        const rows = response.data?.data?.products
        setProducts(Array.isArray(rows) ? rows.filter(Boolean) : [])
      }
    }).catch((requestError) => {
      if (!active) return
      if (requestError.response?.status === 401) {
        window.localStorage.removeItem('authToken')
        navigate('/login?redirect=%2Fwishlist', { replace: true })
      } else setError(requestError.response?.data?.message || 'Could not load your saved items.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [navigate])

  const removeProduct = async (product) => {
    setError('')
    try {
      await api.delete(`/wishlist/${product._id}`)
      setProducts((current) => current.filter((item) => item._id !== product._id))
      setNotice(`${product.name} removed from your saved items.`)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update your saved items.')
    }
  }

  return <div className="min-h-screen bg-[#f5f6f8] text-slate-800">
    <Navbar />
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Link to="/products" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#2874f0]"><ArrowLeft size={16} /> Continue shopping</Link>
      <div className="mb-7 mt-6 flex items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#2874f0]">Saved for later</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[#172337]">Your wishlist</h1><p className="mt-2 text-sm text-slate-500">Good finds you want to come back to.</p></div>
        {!loading && <span className="text-sm text-slate-500">{products.length} {products.length === 1 ? 'item' : 'items'}</span>}
      </div>
      {error && <p className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}</p>}
      {notice && <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">{notice}</p>}
      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Loading your saved items…</div>
        : products.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 xl:gap-5">{products.map((product) => <div className="relative" key={product._id}><ProductCard product={product} onAdd={(item) => { setPendingProduct(item); setCartOpen(true) }} /><button type="button" onClick={() => removeProduct(product)} className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full border border-slate-200 bg-white text-rose-600 shadow-sm transition hover:bg-rose-50" aria-label={`Remove ${product.name} from wishlist`}><Heart size={16} className="fill-current" /></button></div>)}</div>
          : !error && <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><span className="mx-auto grid size-14 place-items-center rounded-full bg-rose-50 text-rose-500"><Heart size={24} /></span><h2 className="mt-4 text-lg font-bold text-[#172337]">Your wishlist is waiting</h2><p className="mt-2 text-sm text-slate-500">Save products you love and find them here anytime.</p><Link to="/products" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#172337] px-5 py-3 text-sm font-semibold text-white hover:bg-[#2874f0]"><ShoppingBag size={16} /> Explore products</Link></div>}
    </main>
    <Footer />
    <CheckoutModal open={cartOpen} onClose={() => { setCartOpen(false); setPendingProduct(null) }} pendingProduct={pendingProduct} onAdded={(message) => { setNotice(message); setCartOpen(false); setPendingProduct(null) }} />
  </div>
}
