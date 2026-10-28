import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, PackageCheck, ShieldCheck, ShoppingBag, Star, Truck } from 'lucide-react'
import Navbar from '../../components/layout/Navbar.jsx'
import Footer from '../../components/layout/Footer.jsx'
import CheckoutModal from '../../components/checkout/CheckoutModal.jsx'
import ProductCard from '../../components/catalog/ProductCard.jsx'
import api from '../../api/axios.js'
import { addGuestCartItem } from '../../api/guestCart.js'

const formatPrice = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(Number(value) || 0)

export default function ProductDetailsPage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [activeImage, setActiveImage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [pendingProduct, setPendingProduct] = useState(null)
  const [cartCount, setCartCount] = useState(0)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [reviews, setReviews] = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [reviewsError, setReviewsError] = useState('')
  const [reviewPage, setReviewPage] = useState(1)
  const [reviewPages, setReviewPages] = useState(1)
  const [reviewTotal, setReviewTotal] = useState(0)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewTitle, setReviewTitle] = useState('')
  const [reviewComment, setReviewComment] = useState('')
  const [reviewBusy, setReviewBusy] = useState(false)
  const [reviewMessage, setReviewMessage] = useState('')
  const [myReview, setMyReview] = useState(null)
  const [postalCode, setPostalCode] = useState('')
  const [deliveryMessage, setDeliveryMessage] = useState('')
  const [stockEmail, setStockEmail] = useState('')
  const [stockMessage, setStockMessage] = useState('')
  const [stockBusy, setStockBusy] = useState(false)
  const [recentProducts, setRecentProducts] = useState([])
  const [selectedVariant, setSelectedVariant] = useState('')
  const reviewRequest = useRef(0)
  const relatedRequest = useRef(0)

  const loadProduct = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get(`/products/${productId}`)
      setProduct(response.data?.data || null)
      setSelectedVariant(response.data?.data?.variants?.[0] || '')
      setActiveImage(0)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'This product could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    const timer = window.setTimeout(() => loadProduct(), 0)
    return () => window.clearTimeout(timer)
  }, [loadProduct])

  useEffect(() => {
    if (!product?._id) return
    try {
      const prior = JSON.parse(window.localStorage.getItem('goodthingsRecentlyViewed') || '[]')
      const next = [product, ...prior.filter((item) => item?._id !== product._id)].slice(0, 8)
      window.localStorage.setItem('goodthingsRecentlyViewed', JSON.stringify(next))
      setRecentProducts(next.filter((item) => item._id !== product._id))
    } catch { setRecentProducts([]) }
  }, [product])

  const checkDelivery = (event) => {
    event.preventDefault()
    setDeliveryMessage(/^\d{6}$/.test(postalCode) ? 'PIN code format looks valid. Confirm delivery availability and timing at checkout.' : 'Enter a valid six-digit India PIN code.')
  }

  const requestStockAlert = async (event) => {
    event.preventDefault()
    setStockBusy(true)
    setStockMessage('')
    try {
      const response = await api.post(`/storefront/products/${productId}/stock-alert`, { email: stockEmail })
      setStockMessage(response.data?.message || 'We’ll email you when it is available.')
    } catch (requestError) {
      setStockMessage(requestError.response?.data?.message || 'Could not save your alert. Please try again.')
    } finally { setStockBusy(false) }
  }

  const loadReviews = useCallback(async (requestedPage = reviewPage) => {
    const requestId = ++reviewRequest.current
    setReviewsLoading(true)
    setReviewsError('')
    try {
      const response = await api.get(`/reviews/product/${productId}`, { params: { page: requestedPage, limit: 5 } })
      if (requestId !== reviewRequest.current) return
      setReviews(Array.isArray(response.data?.data) ? response.data.data : [])
      setReviewTotal(Number(response.data?.pagination?.total) || 0)
      setReviewPages(Math.max(1, Number(response.data?.pagination?.totalPages) || 1))
    } catch (requestError) {
      if (requestId !== reviewRequest.current) return
      setReviewsError(requestError.response?.data?.message || 'Reviews could not be loaded.')
    } finally {
      if (requestId === reviewRequest.current) setReviewsLoading(false)
    }
  }, [productId, reviewPage])

  useEffect(() => {
    const timer = window.setTimeout(() => loadReviews(), 0)
    return () => window.clearTimeout(timer)
  }, [loadReviews])

  useEffect(() => {
    if (!window.localStorage.getItem('authToken')) { setMyReview(null); return }
    let active = true
    api.get(`/reviews/product/${productId}/mine`).then((response) => {
      if (!active) return
      const review = response.data?.data || null
      setMyReview(review)
      if (review) { setReviewRating(review.rating); setReviewTitle(review.title || ''); setReviewComment(review.comment || '') }
    }).catch(() => { if (active) setMyReview(null) })
    return () => { active = false }
  }, [productId])

  const submitReview = async (event) => {
    event.preventDefault()
    setReviewMessage('')
    if (!window.localStorage.getItem('authToken')) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + '#reviews')}`)
      return
    }
    setReviewBusy(true)
    try {
      const payload = {
        rating: reviewRating,
        title: reviewTitle.trim(),
        comment: reviewComment.trim(),
      }
      const response = myReview
        ? await api.put(`/reviews/${myReview._id}`, payload)
        : await api.post(`/reviews/product/${productId}`, payload)
      setMyReview(response.data?.data || null)
      setReviewTitle('')
      setReviewComment('')
      setReviewRating(5)
      setReviewMessage(myReview ? 'Your review has been updated.' : 'Thanks for sharing your experience.')
      setReviewPage(1)
      await Promise.all([loadProduct(), loadReviews(1)])
    } catch (requestError) {
      setReviewMessage(requestError.response?.data?.message || 'Your review could not be submitted. Please try again.')
    } finally {
      setReviewBusy(false)
    }
  }

  const removeMyReview = async () => {
    if (!myReview || !window.confirm('Delete your review for this product?')) return
    setReviewBusy(true)
    setReviewMessage('')
    try {
      await api.delete(`/reviews/${myReview._id}`)
      setMyReview(null)
      setReviewTitle('')
      setReviewComment('')
      setReviewRating(5)
      setReviewMessage('Your review was deleted.')
      await Promise.all([loadProduct(), loadReviews(1)])
    } catch (requestError) {
      setReviewMessage(requestError.response?.data?.message || 'Your review could not be deleted.')
    } finally { setReviewBusy(false) }
  }

  useEffect(() => {
    if (!window.localStorage.getItem('authToken')) return
    api.get('/cart').then((response) => {
      const items = response.data?.data?.items || []
      setCartCount(items.reduce((count, item) => count + (item.product ? item.quantity : 0), 0))
    }).catch(() => {})
  }, [])

  const showNotice = (message) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3000)
  }

  const addToBag = (item) => {
    if (!window.localStorage.getItem('authToken')) {
      try {
        addGuestCartItem(item, 1, item.selectedVariant || '')
        showNotice(`${item.name} added to your bag.`)
      } catch (requestError) {
        showNotice(requestError.message || 'Could not add this item to your bag.')
      }
      return
    }
    setPendingProduct(item)
    setCartOpen(true)
  }

  const category = typeof product?.category === 'object' ? product.category : null
  const categoryId = category?._id
  const currentProductId = product?._id
  const images = product?.images?.map((image) => image.url).filter(Boolean) || []
  const price = Number(product?.price) || 0
  const compareAtPrice = Number(product?.compareAtPrice) || 0
  const hasDiscount = compareAtPrice > price
  const outOfStock = Number(product?.stock) < 1
  const [relatedProducts, setRelatedProducts] = useState([])
  const [relatedLoading, setRelatedLoading] = useState(false)
  const [relatedError, setRelatedError] = useState('')

  const loadRelatedProducts = useCallback(async () => {
    const requestId = ++relatedRequest.current
    if (!currentProductId || !categoryId) {
      setRelatedProducts([])
      setRelatedLoading(false)
      setRelatedError('')
      return
    }

    setRelatedLoading(true)
    setRelatedError('')
    try {
      const response = await api.get('/products', {
        params: { category: categoryId, limit: 8, sort: 'newest' },
      })
      if (requestId !== relatedRequest.current) return
      const products = Array.isArray(response.data?.data) ? response.data.data : []
      setRelatedProducts(products.filter((item) => item._id !== currentProductId).slice(0, 4))
    } catch (requestError) {
      if (requestId !== relatedRequest.current) return
      setRelatedProducts([])
      setRelatedError(requestError.response?.data?.message || 'Related products could not be loaded.')
    } finally {
      if (requestId === relatedRequest.current) setRelatedLoading(false)
    }
  }, [categoryId, currentProductId])

  useEffect(() => {
    const timer = window.setTimeout(() => loadRelatedProducts(), 0)
    return () => window.clearTimeout(timer)
  }, [loadRelatedProducts])

  return <div className="min-h-screen bg-[#f5f6f8] font-sans text-slate-800">
    <Navbar query={query} setQuery={setQuery} cartCount={cartCount} onSearch={() => navigate(`/products${query.trim() ? `?search=${encodeURIComponent(query.trim())}` : ''}`)} onOpenCart={() => { setPendingProduct(null); setCartOpen(true) }} />
    <main className="mx-auto min-h-[60vh] max-w-[1320px] px-4 pb-16 sm:px-7 lg:px-10">
      <div className="flex items-center gap-2 py-5 text-xs text-slate-500"><Link className="transition hover:text-[#2874f0]" to="/">Home</Link><ChevronRight size={13} className="text-slate-300" /><Link className="transition hover:text-[#2874f0]" to="/products">Shop</Link>{category && <><ChevronRight size={13} className="text-slate-300" /><Link className="transition hover:text-[#2874f0]" to={`/products?category=${encodeURIComponent(category.slug || category._id)}`}>{category.name}</Link></>}<ChevronRight size={13} className="text-slate-300" /><span className="max-w-48 truncate font-medium text-slate-700">{product?.name || 'Product details'}</span></div>

      {loading ? <div className="grid gap-8 rounded-3xl border border-slate-200 bg-white p-5 sm:p-8 lg:grid-cols-2"><div className="aspect-square animate-pulse rounded-2xl bg-slate-100" /><div className="space-y-5 py-4"><div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" /><div className="h-9 w-4/5 animate-pulse rounded bg-slate-100" /><div className="h-20 animate-pulse rounded bg-slate-100" /><div className="h-12 w-1/2 animate-pulse rounded bg-slate-100" /><div className="h-12 animate-pulse rounded bg-slate-100" /></div></div>
        : error || !product ? <section className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center"><p className="text-sm font-semibold text-rose-700">{error || 'Product not found'}</p><Link className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#2874f0]" to="/products"><ArrowLeft size={16} /> Back to all products</Link></section>
          : <div className="grid gap-8 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-12 lg:p-10">
            <section aria-label="Product images">
              <div className="relative grid aspect-square place-items-center overflow-hidden rounded-2xl bg-[#f5f6f8]">
                {images[activeImage] ? <img className="h-full w-full object-contain p-7 sm:p-12" src={images[activeImage]} alt={product.name} /> : <ShoppingBag size={56} className="text-slate-300" strokeWidth={1.2} />}
                {hasDiscount && <span className="absolute left-4 top-4 rounded-full bg-[#172337] px-3 py-1.5 text-xs font-bold text-white">Save {Math.round((1 - price / compareAtPrice) * 100)}%</span>}
              </div>
              {images.length > 1 && <div className="mt-3 flex gap-3 overflow-x-auto">{images.map((image, index) => <button className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-[#f5f6f8] p-1 transition ${activeImage === index ? 'border-[#2874f0]' : 'border-transparent hover:border-slate-300'}`} type="button" key={image} aria-label={`Show product image ${index + 1}`} aria-pressed={activeImage === index} onClick={() => setActiveImage(index)}><img className="h-full w-full object-contain" src={image} alt="" /></button>)}</div>}
            </section>

            <section className="flex flex-col py-1 lg:py-3">
              <div className="flex items-center justify-between gap-3"><span className="text-[10px] font-bold uppercase tracking-[.18em] text-[#2874f0]">{product.brand || category?.name || 'Goodthings edit'}</span><span className={`rounded-full px-3 py-1 text-[10px] font-bold ${outOfStock ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{outOfStock ? 'Out of stock' : 'In stock'}</span></div>
              <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-[#172337] sm:text-4xl">{product.name}</h1>
              {product.vendor?.storeName && <p className="mt-2 text-sm text-slate-500">Sold by <Link to={product.vendor.slug ? `/store/${product.vendor.slug}` : '/products'} className="font-semibold text-[#176c68] hover:underline">{product.vendor.storeName}</Link></p>}
              {Number(product.ratingsCount) > 0 && <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600"><span className="text-amber-400">★</span>{Number(product.ratingsAverage || 0).toFixed(1)}<span className="text-slate-400">({product.ratingsCount} reviews)</span></p>}
              <div className="mt-6 flex items-baseline gap-3"><span className="text-2xl font-bold text-[#172337]">{formatPrice(price)}</span>{hasDiscount && <><del className="text-sm text-slate-400">{formatPrice(compareAtPrice)}</del><span className="text-xs font-semibold text-emerald-700">You save {formatPrice(compareAtPrice - price)}</span></>}</div>
              <p className="mt-6 line-clamp-3 whitespace-pre-line text-sm leading-7 text-slate-600">{product.description || 'A thoughtful find, selected for everyday use.'}</p>
              <a className="mt-2 w-fit text-xs font-semibold text-[#2874f0] hover:underline" href="#product-description">Read full description</a>
              {product.variants?.length > 0 && <label className="mt-5 block max-w-sm text-xs font-semibold text-slate-700">Choose an option<select className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={selectedVariant} onChange={(event) => setSelectedVariant(event.target.value)}>{product.variants.map((variant) => <option key={variant} value={variant}>{variant}</option>)}</select><small className="mt-1 block font-normal text-slate-400">Options share the displayed price and stock.</small></label>}
              <button className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#172337] px-5 text-sm font-bold text-white transition hover:bg-[#2874f0] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 sm:w-auto sm:min-w-64" type="button" disabled={outOfStock} onClick={() => addToBag({ ...product, selectedVariant })}><ShoppingBag size={17} />{outOfStock ? 'Currently unavailable' : 'Add to bag'}</button>

              {outOfStock && <form onSubmit={requestStockAlert} className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h2 className="text-sm font-bold text-slate-800">Get a back-in-stock alert</h2><p className="mt-1 text-xs text-slate-600">We’ll email you once when this item is available again.</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row"><label className="sr-only" htmlFor="stock-alert-email">Email address</label><input id="stock-alert-email" type="email" required maxLength={254} autoComplete="email" placeholder="Email address" value={stockEmail} onChange={(event) => setStockEmail(event.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 text-xs outline-none focus:ring-2 focus:ring-amber-300" /><button disabled={stockBusy} className="rounded-lg bg-[#172337] px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{stockBusy ? 'Saving…' : 'Notify me'}</button></div>
                {stockMessage && <p className="mt-2 text-xs text-slate-700" role="status">{stockMessage}</p>}
              </form>}
              <form onSubmit={checkDelivery} className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label htmlFor="delivery-pin" className="block text-xs font-bold text-slate-800">Check delivery information</label>
                <div className="mt-2 flex gap-2"><input id="delivery-pin" inputMode="numeric" autoComplete="postal-code" maxLength={6} placeholder="6-digit India PIN code" value={postalCode} onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-[#2874f0]" /><button className="rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700">Check</button></div>
                {deliveryMessage && <p className="mt-2 text-xs text-slate-600" role="status">{deliveryMessage}</p>}
              </form>
              <div className="mt-8 grid gap-4 border-y border-slate-100 py-5 sm:grid-cols-2">
                <div className="flex items-start gap-3"><Truck size={18} className="mt-0.5 shrink-0 text-[#2874f0]" /><p className="text-xs leading-5 text-slate-600"><b className="block text-slate-800">Delivery available</b>Delivery options shown at checkout.</p></div>
                <div className="flex items-start gap-3"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#2874f0]" /><p className="text-xs leading-5 text-slate-600"><b className="block text-slate-800">Secure checkout</b>Payments are processed securely.</p></div>
                <div className="flex items-start gap-3"><PackageCheck size={18} className="mt-0.5 shrink-0 text-[#2874f0]" /><p className="text-xs leading-5 text-slate-600"><b className="block text-slate-800">Stock status</b>{outOfStock ? 'This item is currently sold out.' : `${product.stock} available to order`}</p></div>
                {product.sku && <div className="flex items-start gap-3"><Check size={18} className="mt-0.5 shrink-0 text-[#2874f0]" /><p className="text-xs leading-5 text-slate-600"><b className="block text-slate-800">Product code</b>{product.sku}</p></div>}
              </div>
              <Link className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-[#2874f0]" to={category ? `/products?category=${encodeURIComponent(category.slug || category._id)}` : '/products'}><ArrowLeft size={15} /> Continue shopping</Link>
            </section>
          </div>}

      {!loading && product && !error && <section className="mt-7 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <nav className="flex gap-6 border-b border-slate-100 px-5 sm:px-8" aria-label="Product information">
          <a className="border-b-2 border-[#2874f0] py-4 text-xs font-bold text-[#172337]" href="#product-description">Description</a>
          <a className="border-b-2 border-transparent py-4 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-[#172337]" href="#reviews">Customer reviews ({reviewTotal || product.ratingsCount || 0})</a>
        </nav>

        <section className="scroll-mt-24 px-5 py-7 sm:px-8 sm:py-9" id="product-description">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#2874f0]">A closer look</p>
          <h2 className="mt-2 text-xl font-bold text-[#172337]">Product details</h2>
          <p className="mt-4 max-w-4xl whitespace-pre-line text-sm leading-7 text-slate-600">{product.description || 'A thoughtful find, selected for everyday use.'}</p>
          <dl className="mt-6 grid gap-3 border-t border-slate-100 pt-5 text-xs sm:grid-cols-3">
            {category?.name && <div><dt className="text-slate-400">Category</dt><dd className="mt-1 font-semibold text-slate-700">{category.name}</dd></div>}
            {product.brand && <div><dt className="text-slate-400">Brand</dt><dd className="mt-1 font-semibold text-slate-700">{product.brand}</dd></div>}
              {product.vendor?.storeName && <div><dt className="text-slate-400">Seller</dt><dd className="mt-1 font-semibold text-slate-700"><Link to={product.vendor.slug ? `/store/${product.vendor.slug}` : '/products'} className="text-[#176c68] hover:underline">{product.vendor.storeName}</Link></dd></div>}
            {product.sku && <div><dt className="text-slate-400">Product code</dt><dd className="mt-1 font-semibold text-slate-700">{product.sku}</dd></div>}
          </dl>
        </section>

        <section className="scroll-mt-24 border-t border-slate-100 px-5 py-7 sm:px-8 sm:py-9" id="reviews">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#2874f0]">From the community</p><h2 className="mt-2 text-xl font-bold text-[#172337]">Customer reviews</h2><p className="mt-1 text-xs text-slate-500">Honest notes from people who picked this up.</p></div>
            <div className="flex items-center gap-3 rounded-xl bg-[#f7f8fa] px-4 py-3">
              <span className="text-3xl font-bold tracking-tight text-[#172337]">{Number(product.ratingsAverage || 0).toFixed(1)}</span>
              <span><span className="flex gap-0.5" aria-label={`${Number(product.ratingsAverage || 0).toFixed(1)} out of 5 stars`}>{Array.from({ length: 5 }, (_, index) => <Star className={`h-3.5 w-3.5 ${index < Math.round(product.ratingsAverage || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} key={index} />)}</span><small className="mt-1 block text-[10px] text-slate-500">{reviewTotal} {reviewTotal === 1 ? 'review' : 'reviews'}</small></span>
            </div>
          </div>

          <form className="mt-6 rounded-2xl border border-slate-200 bg-[#fbfcfd] p-4 sm:p-5" onSubmit={submitReview}>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div><h3 className="text-sm font-bold text-slate-800">{myReview ? 'Edit your review' : 'Share your take'}</h3><p className="mt-1 text-xs text-slate-500">Your review helps someone find their next good thing.</p></div>
              <div className="flex items-center gap-1" role="group" aria-label="Choose a rating">
                {Array.from({ length: 5 }, (_, index) => {
                  const value = index + 1
                  return <button className="rounded p-1 transition hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-300" type="button" key={value} aria-label={`${value} star${value === 1 ? '' : 's'}`} aria-pressed={reviewRating === value} onClick={() => setReviewRating(value)}><Star className={`h-5 w-5 ${value <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} /></button>
                })}
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_2fr]">
              <label className="sr-only" htmlFor="review-title">Review title</label><input className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-[#2874f0] focus:ring-4 focus:ring-blue-50" id="review-title" type="text" maxLength={100} placeholder="Give your review a title (optional)" value={reviewTitle} onChange={(event) => setReviewTitle(event.target.value)} />
              <label className="sr-only" htmlFor="review-comment">Your review</label><textarea className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs leading-5 outline-none transition placeholder:text-slate-400 focus:border-[#2874f0] focus:ring-4 focus:ring-blue-50" id="review-comment" maxLength={2000} required placeholder="What did you think?" value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} />
            </div>
            {reviewMessage && <p className="mt-3 text-xs font-medium text-slate-600" role="status">{reviewMessage}</p>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] text-slate-400">One review per account. Verified purchases are marked.</p><div className="flex gap-2"><button className="rounded-lg bg-[#172337] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#2874f0] disabled:cursor-wait disabled:opacity-60" type="submit" disabled={reviewBusy || !reviewComment.trim()}>{reviewBusy ? 'Saving…' : myReview ? 'Update review' : 'Post review'}</button>{myReview && <button className="rounded-lg border border-rose-200 px-4 py-2.5 text-xs font-semibold text-rose-700 disabled:opacity-50" type="button" disabled={reviewBusy} onClick={removeMyReview}>Delete review</button>}</div></div>
          </form>

          <div className="mt-7">
            {reviewsError && <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800" role="alert"><span>{reviewsError}</span><button className="font-semibold underline" type="button" onClick={() => loadReviews()}>Try again</button></div>}
            {reviewsLoading ? <div className="space-y-4">{Array.from({ length: 2 }, (_, index) => <div className="animate-pulse rounded-xl border border-slate-100 p-5" key={index}><div className="h-3 w-28 rounded bg-slate-100" /><div className="mt-3 h-4 w-1/2 rounded bg-slate-100" /><div className="mt-3 h-3 w-full rounded bg-slate-100" /></div>)}</div>
              : reviews.length ? <div className="divide-y divide-slate-100">{reviews.map((review) => <article className="py-5 first:pt-0 last:pb-0" key={review._id}>
                <div className="flex flex-wrap items-center gap-2"><span className="flex gap-0.5" aria-label={`${review.rating} out of 5 stars`}>{Array.from({ length: 5 }, (_, index) => <Star className={`h-3 w-3 ${index < review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} key={index} />)}</span>{review.isVerifiedPurchase && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">Verified purchase</span>}</div>
                <h3 className="mt-2 text-sm font-bold text-slate-800">{review.title || 'A customer shared their experience'}</h3>
                <p className="mt-2 whitespace-pre-line text-xs leading-6 text-slate-600">{review.comment}</p>
                <p className="mt-3 text-[10px] text-slate-400">{review.user?.name || 'Goodthings customer'} · {review.createdAt ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(review.createdAt)) : ''}</p>
              </article>)}</div>
                : !reviewsError && <p className="rounded-xl border border-dashed border-slate-200 px-5 py-9 text-center text-sm text-slate-500">No reviews yet. Be the first to share your experience.</p>}
          </div>

          {!reviewsLoading && reviewPages > 1 && <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Review pages"><button className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40" type="button" aria-label="Previous reviews" disabled={reviewPage <= 1} onClick={() => setReviewPage((current) => Math.max(1, current - 1))}><ChevronLeft size={16} /></button><span className="text-xs text-slate-500">Page {reviewPage} of {reviewPages}</span><button className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40" type="button" aria-label="Next reviews" disabled={reviewPage >= reviewPages} onClick={() => setReviewPage((current) => Math.min(reviewPages, current + 1))}><ChevronRight size={16} /></button></nav>}
        </section>
      </section>}

      {!loading && product && !error && category && (relatedLoading || relatedError || relatedProducts.length > 0) && <section className="mt-7 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#2874f0]">More to explore</p><h2 className="mt-2 text-xl font-bold text-[#172337]">You may also like</h2><p className="mt-1 text-xs text-slate-500">More finds from {category.name}.</p></div>
          <Link className="text-xs font-semibold text-[#2874f0] hover:underline" to={`/products?category=${encodeURIComponent(category.slug || category._id)}`}>Shop this category</Link>
        </div>
        {relatedError ? <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800" role="alert"><span>{relatedError}</span><button className="font-semibold underline" type="button" onClick={loadRelatedProducts}>Try again</button></div>
          : relatedLoading ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5" aria-label="Loading related products">{Array.from({ length: 4 }, (_, index) => <div className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 p-3" key={index}><div className="aspect-[4/3] rounded-xl bg-slate-100" /><div className="mt-4 h-3 w-3/4 rounded bg-slate-100" /><div className="mt-3 h-4 w-1/2 rounded bg-slate-100" /></div>)}</div>
            : <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">{relatedProducts.map((relatedProduct) => <ProductCard key={relatedProduct._id} product={relatedProduct} onAdd={addToBag} />)}</div>}
      </section>}
      {!loading && recentProducts.length > 0 && <section className="mt-7 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-6"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#2874f0]">Your browsing</p><h2 className="mt-2 text-xl font-bold text-[#172337]">Recently viewed</h2></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">{recentProducts.map((item) => <ProductCard key={item._id} product={item} onAdd={addToBag} />)}</div>
      </section>}
    </main>
    <Footer />
    <CheckoutModal open={cartOpen} onClose={() => { setCartOpen(false); setPendingProduct(null) }} pendingProduct={pendingProduct} onCartCount={setCartCount} onAdded={showNotice} />
    {notice && <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-[#172337] px-5 py-3 text-sm font-medium text-white shadow-xl" role="status" aria-live="polite">{notice}</div>}
  </div>
}
