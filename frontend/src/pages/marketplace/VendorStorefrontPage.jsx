import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BadgeCheck, PackageOpen, Store } from 'lucide-react'
import Navbar from '../../components/layout/Navbar.jsx'
import Footer from '../../components/layout/Footer.jsx'
import api from '../../api/axios.js'
import './VendorStorefrontPage.css'

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value) || 0)

export default function VendorStorefrontPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [store, setStore] = useState(null)
  const [products, setProducts] = useState([])
  const [total, setTotal] = useState(0)
  const [loadedSlug, setLoadedSlug] = useState('')
  const loading = loadedSlug !== slug
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true
    api.get(`/vendors/store/${encodeURIComponent(slug)}`).then((response) => {
      if (!active) return
      const data = response.data?.data
      setError('')
      setStore(data?.vendor || null)
      setProducts(Array.isArray(data?.products) ? data.products : [])
      setTotal(Number(data?.total) || 0)
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message || 'This store could not be loaded right now.')
    }).finally(() => { if (active) setLoadedSlug(slug) })
    return () => { active = false }
  }, [slug])

  return <div className="storefront vendor-public-store">
    <Navbar query={query} setQuery={setQuery} onSearch={() => navigate(query.trim() ? `/products?search=${encodeURIComponent(query.trim())}` : '/products')} />
    <main className="v-store-main">
      <div className="v-store-breadcrumb"><Link to="/">Home</Link><span>/</span><Link to="/products">Shop</Link><span>/</span><span>{store?.storeName || 'Store'}</span></div>
      {loading ? <div className="v-store-state"><span className="v-store-spinner" />Loading this store…</div> : error ? <div className="v-store-state v-store-error"><Store size={34} /><h1>We couldn’t find this store</h1><p>{error}</p><Link to="/products">Browse all products <ArrowRight size={15} /></Link></div> : <>
        <section className="v-store-hero"><div className="v-store-avatar"><Store size={31} strokeWidth={1.5} /></div><div className="v-store-intro"><span className="v-store-eyebrow"><BadgeCheck size={14} /> VERIFIED MARKETPLACE SELLER</span><h1>{store?.storeName}</h1><p>{store?.description || 'Thoughtful finds from an independent Goodthings seller.'}</p></div><div className="v-store-count"><b>{total}</b><span>{total === 1 ? 'product' : 'products'} in store</span></div></section>
        <div className="v-store-toolbar"><div><h2>Shop this store</h2><p>Explore the latest products from {store?.storeName}.</p></div><Link to="/products" className="v-store-back"><ArrowLeft size={14} /> All products</Link></div>
        {products.length ? <section className="v-store-grid" aria-label={`${store?.storeName} products`}>{products.map((product) => {
          const image = product.images?.[0]?.url || product.images?.[0] || ''
          const oldPrice = Number(product.compareAtPrice)
          const price = Number(product.price)
          const discount = oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0
          return <article className="v-store-product" key={product._id}><Link className="v-store-product-image" to={`/products/${product._id}`} aria-label={`View ${product.name}`}>{image ? <img src={image} alt={product.name} loading="lazy" /> : <PackageOpen size={34} />}{discount > 0 && <span>{discount}% off</span>}</Link><div className="v-store-product-info"><small>{product.brand || product.category?.name || store?.storeName}</small><Link className="v-store-product-name" to={`/products/${product._id}`}>{product.name}</Link><div className="v-store-price"><b>{money(price)}</b>{discount > 0 && <del>{money(oldPrice)}</del>}</div><p>{Number(product.stock) > 0 ? 'In stock' : 'Currently unavailable'}</p></div></article>
        })}</section> : <div className="v-store-empty"><PackageOpen size={38} /><h2>New finds are on their way</h2><p>This store doesn’t have any published products yet.</p><Link to="/products">Explore the marketplace <ArrowRight size={15} /></Link></div>}
      </>}
    </main>
    <Footer />
  </div>
}
