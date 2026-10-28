import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react'
import Navbar from '../../components/layout/Navbar.jsx'
import Footer from '../../components/layout/Footer.jsx'
import CheckoutModal from '../../components/checkout/CheckoutModal.jsx'
import ProductCard from '../../components/catalog/ProductCard.jsx'
import api from '../../api/axios.js'
import { addGuestCartItem } from '../../api/guestCart.js'
import './ProductsPage.css'

const sortOptions = [
  ['newest', 'Newest arrivals'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['name_asc', 'Name: A to Z'],
]

export default function ProductsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState(searchParams.get('search') || '')
  const [categoryKey, setCategoryKey] = useState(searchParams.get('category') || '')
  const [sort, setSort] = useState(sortOptions.some(([key]) => key === searchParams.get('sort')) ? searchParams.get('sort') : 'newest')
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '')
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '')
  const [minRating, setMinRating] = useState(searchParams.get('minRating') || '')
  const [brand, setBrand] = useState(searchParams.get('brand') || '')
  const [inStock, setInStock] = useState(searchParams.get('inStock') === 'true')
  const [page, setPage] = useState(Math.max(1, Number(searchParams.get('page')) || 1))
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [error, setError] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [pendingProduct, setPendingProduct] = useState(null)
  const [cartCount, setCartCount] = useState(0)
  const [notice, setNotice] = useState('')
  const [wishlistIds, setWishlistIds] = useState([])
  const requestSequence = useRef(0)

  useEffect(() => {
    let active = true
    api.get('/category?limit=100')
      .then((response) => { if (active) setCategories(Array.isArray(response.data?.data) ? response.data.data : []) })
      .catch(() => { if (active) setCategories([]) })
      .finally(() => { if (active) setLoadingCategories(false) })
    return () => { active = false }
  }, [])

  const selectedCategory = useMemo(() => categories.find((category) =>
    category._id === categoryKey || category.slug === categoryKey || category.name.toLowerCase() === categoryKey.toLowerCase(),
  ), [categories, categoryKey])

  const fetchProducts = useCallback(async () => {
    const requestId = ++requestSequence.current
    setLoadingProducts(true)
    setError('')
    try {
      const params = { page, limit: 12, sort }
      if (query.trim()) params.search = query.trim()
      if (selectedCategory?._id) params.category = selectedCategory._id
      if (brand.trim()) params.brand = brand.trim()
      if (inStock) params.inStock = 'true'
      if (minPrice !== '') params.minPrice = minPrice
      if (maxPrice !== '') params.maxPrice = maxPrice
      if (minRating) params.minRating = minRating
      const response = await api.get('/products', { params })
      if (requestId !== requestSequence.current) return
      setProducts(Array.isArray(response.data?.data) ? response.data.data : [])
      setTotal(Number(response.data?.total) || 0)
      setTotalPages(Math.max(1, Number(response.data?.totalPages) || 1))
    } catch (requestError) {
      if (requestId !== requestSequence.current) return
      setProducts([])
      setError(requestError.response?.data?.message || 'We couldn’t load products right now. Please try again.')
    } finally {
      if (requestId === requestSequence.current) setLoadingProducts(false)
    }
  }, [page, sort, query, selectedCategory, minPrice, maxPrice, minRating, brand, inStock])

  useEffect(() => {
    const timer = window.setTimeout(fetchProducts, query.trim() ? 300 : 0)
    return () => window.clearTimeout(timer)
  }, [fetchProducts, query])

  useEffect(() => {
    const next = new URLSearchParams()
    if (query.trim()) next.set('search', query.trim())
    if (categoryKey) next.set('category', selectedCategory?.slug || selectedCategory?._id || categoryKey)
    if (brand.trim()) next.set('brand', brand.trim())
    if (inStock) next.set('inStock', 'true')
    if (sort !== 'newest') next.set('sort', sort)
    if (minPrice) next.set('minPrice', minPrice)
    if (maxPrice) next.set('maxPrice', maxPrice)
    if (minRating) next.set('minRating', minRating)
    if (page > 1) next.set('page', String(page))
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true })
  }, [query, categoryKey, selectedCategory, sort, minPrice, maxPrice, minRating, brand, inStock, page, searchParams, setSearchParams])

  useEffect(() => {
    if (!window.localStorage.getItem('authToken')) return
    api.get('/cart').then((response) => {
      const items = response.data?.data?.items || []
      setCartCount(items.reduce((count, item) => count + (item.product ? item.quantity : 0), 0))
    }).catch(() => {})
    api.get('/wishlist').then((response) => {
      const saved = response.data?.data?.products || []
      setWishlistIds(saved.filter(Boolean).map((product) => product._id))
    }).catch(() => {})
  }, [])

  const chooseCategory = (key) => { setCategoryKey(key); setPage(1) }
  const changeSearch = (value) => { setQuery(value); setPage(1) }
  const changePrice = (setter, value) => { setter(value); setPage(1) }

  const addToBag = (product) => {
    if (product.variants?.length) return navigate(`/products/${product._id}`)
    if (!window.localStorage.getItem('authToken')) {
      try {
        addGuestCartItem(product)
        showNotice(`${product.name} added to your bag.`)
      } catch (requestError) {
        showNotice(requestError.message || 'Could not add this item to your bag.')
      }
      return
    }
    setPendingProduct(product)
    setCartOpen(true)
  }

  const toggleWishlist = async (product) => {
    if (!window.localStorage.getItem('authToken')) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      return
    }
    const isSaved = wishlistIds.includes(product._id)
    try {
      if (isSaved) await api.delete(`/wishlist/${product._id}`)
      else await api.post(`/wishlist/${product._id}`)
      setWishlistIds((current) => isSaved ? current.filter((id) => id !== product._id) : [...current, product._id])
      showNotice(isSaved ? 'Removed from your saved items.' : 'Added to your saved items.')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update your saved items.')
    }
  }

  const clearFilters = () => {
    setQuery('')
    setCategoryKey('')
    setMinPrice('')
    setMaxPrice('')
    setMinRating('')
    setBrand('')
    setInStock(false)
    setSort('newest')
    setPage(1)
  }

  const showNotice = (message) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3000)
  }

  return <div className="g-home g-products-page min-h-screen font-sans">
    <Navbar query={query} setQuery={changeSearch} cartCount={cartCount} onOpenCart={() => { setPendingProduct(null); setCartOpen(true) }} onSearch={() => document.getElementById('catalog-results')?.scrollIntoView({ behavior: 'smooth' })} />

    <main className="g-catalog-main">
      <div className="g-catalog-breadcrumb"><Link to="/">Home</Link><span>/</span><span>Shop</span>{selectedCategory && <><span>/</span><span>{selectedCategory.name}</span></>}</div>

      {!query.trim() && <section className="g-catalog-intro">
        <div className="g-catalog-intro-copy">
          <span className="g-catalog-eyebrow"><span /> THE GOOD THINGS SHOP</span>
          <h1>Little joys.<br /><em>Lovely finds.</em></h1>
          <p>Thoughtful picks for your home, your everyday, and all the moments in between.</p>
          <a href="#catalog-results">Browse the collection <ArrowRight size={16} /></a>
        </div>
        <div className="g-catalog-intro-art" aria-hidden="true">
          <span className="g-catalog-orbit g-catalog-orbit-one" />
          <span className="g-catalog-orbit g-catalog-orbit-two" />
          <span className="g-catalog-sun">GOOD<br />THINGS</span>
          <span className="g-catalog-art-caption">A LITTLE SOMETHING FOR EVERY DAY</span>
        </div>
      </section>}

      <section id="catalog-results" className={`g-catalog-layout ${query.trim() ? 'g-catalog-searching' : ''}`}>
        <aside className="g-catalog-sidebar" aria-label="Product filters">
          <div className="g-catalog-filter-heading"><h2>Refine your finds</h2>{(categoryKey || minPrice || maxPrice || minRating || brand || inStock || query) && <button type="button" onClick={clearFilters}>Reset</button>}</div>
          <fieldset className="g-catalog-filter-group">
            <legend>Categories</legend>
            <div className="g-catalog-category-list">
              <button className={!categoryKey ? 'active' : ''} type="button" aria-pressed={!categoryKey} onClick={() => chooseCategory('')}>All products{!categoryKey && <span aria-hidden="true">✓</span>}</button>
              {categories.map((category) => {
                const active = selectedCategory?._id === category._id
                return <button className={active ? 'active' : ''} type="button" key={category._id} aria-pressed={active} onClick={() => chooseCategory(category.slug || category._id)}><span>{category.name}</span>{active && <span aria-hidden="true">✓</span>}</button>
              })}
              {loadingCategories && <p>Loading categories…</p>}
              {!loadingCategories && !categories.length && <p>No categories available.</p>}
            </div>
          </fieldset>
          <fieldset className="g-catalog-filter-group">
            <legend>Price range</legend>
            <div className="g-catalog-price-range">
              <label>₹<span className="sr-only">Minimum price</span><input type="number" min="0" inputMode="decimal" placeholder="Min" value={minPrice} onChange={(event) => changePrice(setMinPrice, event.target.value)} /></label>
              <span>–</span>
              <label>₹<span className="sr-only">Maximum price</span><input type="number" min="0" inputMode="decimal" placeholder="Max" value={maxPrice} onChange={(event) => changePrice(setMaxPrice, event.target.value)} /></label>
            </div>
          </fieldset>
          <fieldset className="g-catalog-filter-group">
            <legend>Customer rating</legend>
            {[['4', '4 stars & up'], ['3', '3 stars & up']].map(([value, label]) => <label className="g-catalog-rating" key={value}><input type="radio" name="minimum-rating" checked={minRating === value} onChange={() => { setMinRating(minRating === value ? '' : value); setPage(1) }} /><span>{label}</span></label>)}
          </fieldset>
          <fieldset className="g-catalog-filter-group">
            <legend>Brand</legend>
            <label className="block text-xs text-slate-600" htmlFor="catalog-brand">Filter by brand</label>
            <input className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#2874f0] focus:ring-4 focus:ring-blue-50" id="catalog-brand" type="search" placeholder="Enter a brand" value={brand} onChange={(event) => { setBrand(event.target.value); setPage(1) }} />
          </fieldset>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input className="h-4 w-4 accent-[#2874f0]" type="checkbox" checked={inStock} onChange={(event) => { setInStock(event.target.checked); setPage(1) }} />In stock only</label>
          <div className="g-catalog-sidebar-note"><span>THE GOOD EDIT</span><p>Good things, chosen to make the everyday a little brighter.</p><Link to="/">A little about us <ArrowRight size={13} /></Link></div>
        </aside>

        <div className="g-catalog-results">
          <div className="g-catalog-heading">
            <div><span className="g-catalog-eyebrow">{selectedCategory?.name || (query.trim() ? 'SEARCH RESULTS' : 'A LITTLE BIT OF EVERYTHING')}</span><h2>{query.trim() ? `Results for “${query.trim()}”` : selectedCategory?.name || 'Shop all products'}</h2><p>{loadingProducts ? 'Finding the good things…' : `${total} ${total === 1 ? 'find' : 'finds'} to explore`}</p></div>
            <div className="g-catalog-tools">
              <label className="g-catalog-search">
                <Search size={16} /><span className="sr-only">Search products</span><input type="search" placeholder="Search the shop" value={query} onChange={(event) => changeSearch(event.target.value)} />{query && <button type="button" aria-label="Clear search" onClick={() => changeSearch('')}><X size={15} /></button>}
              </label>
              <label className="g-catalog-sort"><SlidersHorizontal size={15} /><span className="sr-only">Sort products</span><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1) }}>{sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
          </div>

          {error && <div className="g-catalog-error" role="alert"><span>{error}</span><button type="button" onClick={fetchProducts}>Try again</button></div>}
          {loadingProducts ? <div className="g-catalog-grid">{Array.from({ length: 8 }, (_, index) => <div className="g-catalog-skeleton" key={index}><div /><span /><span /><span /></div>)}</div>
            : products.length ? <div className="g-catalog-grid">{products.map((product) => <div className="g-catalog-product" key={product._id}><ProductCard product={product} onAdd={addToBag} onWishlist={toggleWishlist} wishlisted={wishlistIds.includes(product._id)} /></div>)}</div>
              : !error && <div className="g-catalog-empty"><span>NOTHING HERE JUST YET</span><h3>No finds this time.</h3><p>Try another search or loosen up your filters.</p><button type="button" onClick={clearFilters}>Clear filters <ArrowRight size={15} /></button></div>}

          {!loadingProducts && totalPages > 1 && <nav className="g-catalog-pagination" aria-label="Product pages">
            <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => { setPage((current) => Math.max(1, current - 1)); document.getElementById('catalog-results')?.scrollIntoView({ behavior: 'smooth' }) }}><ChevronLeft size={17} /></button>
            <span>Page <b>{page}</b> of {totalPages}</span>
            <button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => { setPage((current) => Math.min(totalPages, current + 1)); document.getElementById('catalog-results')?.scrollIntoView({ behavior: 'smooth' }) }}><ChevronRight size={17} /></button>
          </nav>}
        </div>
      </section>
    </main>

    <Footer />
    <CheckoutModal open={cartOpen} onClose={() => { setCartOpen(false); setPendingProduct(null) }} pendingProduct={pendingProduct} onCartCount={setCartCount} onAdded={showNotice} />
    {notice && <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-[#172337] px-5 py-3 text-sm font-medium text-white shadow-xl" role="status" aria-live="polite">{notice}</div>}
  </div>
}
