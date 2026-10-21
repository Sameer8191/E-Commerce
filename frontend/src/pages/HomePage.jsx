import { useMemo, useState } from 'react'
import { ArrowRight, ArrowUpRight, Heart, Search, ShieldCheck, Sparkles, Truck, Headphones, House, Shirt, Watch, Gamepad2, Gift } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import './HomePage.css'

const categories = [
  {
    name: 'Tech & gadgets',
    label: '01 / TECH',
    image: 'photo-1498049794561-7780e7231661',
    description: 'Clever things, beautifully made.',
  },
  {
    name: 'Home & living',
    label: '02 / HOME',
    image: 'photo-1616486338812-3dadae4b4ace',
    description: 'Make room for the good stuff.',
  },
  {
    name: 'Style & more',
    label: '03 / STYLE',
    image: 'photo-1490481651871-ab68de25d43d',
    description: 'Everyday pieces, extra special.',
  },
]

const products = [
  {
    name: 'Studio wireless headphones',
    category: 'Tech & gadgets',
    type: 'AUDIO',
    price: '$179',
    was: '$229',
    badge: 'BESTSELLER',
    rating: '4.9',
    image: 'photo-1505740420928-5e560c06d30e',
    color: '#e9e4d9',
  },
  {
    name: 'The everyday timepiece',
    category: 'Style & more',
    type: 'ACCESSORIES',
    price: '$89',
    was: '$119',
    badge: 'JUST DROPPED',
    rating: '4.8',
    image: 'photo-1523275335684-37898b6baf30',
    color: '#e3e7e4',
  },
  {
    name: 'Weekend camera, mini',
    category: 'Tech & gadgets',
    type: 'CAMERAS',
    price: '$249',
    was: '$299',
    badge: 'GOOD FIND',
    rating: '4.9',
    image: 'photo-1516035069371-29a1b244cc32',
    color: '#e3e1dd',
  },
  {
    name: 'Cloud-soft lounge chair',
    category: 'Home & living',
    type: 'LIVING',
    price: '$320',
    was: '$395',
    badge: 'CUSTOMER LOVE',
    rating: '5.0',
    image: 'photo-1503602642458-232111445657',
    color: '#e9e5dc',
  },
]

const imageUrl = (id, width = 700) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=82`

function ArrowLink({ children, href }) {
  return (
    <a className="market-text-link" href={href}>
      {children} <ArrowRight size={14} aria-hidden="true" />
    </a>
  )
}

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All good things')
  const [query, setQuery] = useState('')
  const [favorites, setFavorites] = useState([])
  const [cartCount, setCartCount] = useState(0)
  const [notice, setNotice] = useState('')

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return products.filter((product) => {
      const matchesCategory =
        activeCategory === 'All good things' || product.category === activeCategory
      const matchesSearch =
        !normalizedQuery ||
        `${product.name} ${product.category} ${product.type}`.toLowerCase().includes(normalizedQuery)
      return matchesCategory && matchesSearch
    })
  }, [activeCategory, query])

  const addToBag = (productName) => {
    setCartCount((count) => count + 1)
    setNotice(`${productName} added to your bag`)
    window.setTimeout(() => setNotice(''), 2600)
  }

  const toggleFavorite = (productName) => {
    setFavorites((current) =>
      current.includes(productName)
        ? current.filter((name) => name !== productName)
        : [...current, productName],
    )
  }

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="storefront market-storefront">
      <Navbar menuOpen={menuOpen} setMenuOpen={setMenuOpen} cartCount={cartCount} query={query} setQuery={setQuery} />
      {menuOpen && (
        <nav className="mobile-menu market-mobile-menu" aria-label="Mobile navigation">
          <a href="#featured" onClick={closeMenu}>Shop all</a>
          <a href="#categories" onClick={closeMenu}>The categories</a>
          <a href="#story" onClick={closeMenu}>Our story</a>
          <a href="#featured" onClick={closeMenu}>The good edit</a>
        </nav>
      )}

      <main>
        <section className="market-shortcuts" aria-label="Shop by category">
          {[
            ["Top deals", Sparkles], ["Electronics", Headphones], ["Home", House],
            ["Fashion", Shirt], ["Watches", Watch], ["Gaming", Gamepad2], ["Gift ideas", Gift],
          ].map(([label, CategoryIcon], index) => <a href="#categories" key={label} onClick={() => { if (index > 0 && index < 4) setActiveCategory(categories[index - 1].name) }}>
            <span className="shortcut-icon"><CategoryIcon size={21} strokeWidth={1.7} /></span><b>{label}</b>
          </a>)}
        </section>

        <section className="market-promo" aria-label="Featured offer">
          <img src={imageUrl('photo-1490481651871-ab68de25d43d', 1500)} alt="New season styles on offer" />
          <div className="promo-shade" />
          <div className="promo-copy"><span className="promo-kicker">THE SEASON STARTS HERE</span><h1>Big picks.<br /><em>Better prices.</em></h1><p>Fresh finds across style, tech and home. Make today a good day to shop.</p><a className="market-button promo-button" href="#featured">Shop the latest <ArrowRight size={15} /></a></div>
          <div className="promo-pagination"><i /><i className="selected" /><i /><i /><i /></div>
          <span className="promo-offer">UP TO <b>40%</b><small>OFF SELECT FINDS</small></span>
        </section>

        <section className="market-benefits" aria-label="Shopping benefits">
          <div><Truck size={19} aria-hidden="true" /><span><b>Good things, delivered</b><small>Free shipping over $50</small></span></div>
          <div><ShieldCheck size={19} aria-hidden="true" /><span><b>Only the good stuff</b><small>Thoughtfully picked for you</small></span></div>
          <div><Heart size={19} aria-hidden="true" /><span><b>Love it or send it back</b><small>Easy 30-day returns</small></span></div>
          <div><Sparkles size={19} aria-hidden="true" /><span><b>A little something extra</b><small>Good surprises in every order</small></span></div>
        </section>

        <section className="market-section market-categories" id="categories">
          <div className="market-section-heading">
            <div>
              <span className="market-kicker">A WORLD OF GOOD</span>
              <h2>Find your <em>kind</em> of good.</h2>
            </div>
            <ArrowLink href="#featured">Explore all categories</ArrowLink>
          </div>
          <div className="market-category-grid">
            {categories.map((category, index) => (
              <a
                className="market-category-card"
                href="#featured"
                key={category.name}
                onClick={() => setActiveCategory(category.name)}
              >
                <img src={imageUrl(category.image, 900)} alt="" loading="lazy" />
                <span className="market-category-shade" />
                <span className="market-category-index">{category.label}</span>
                <span className="market-category-info">
                  <span><b>{category.name}</b><small>{category.description}</small></span>
                  <span className="market-round-arrow"><ArrowUpRight size={17} aria-hidden="true" /></span>
                </span>
                <span className="market-category-count">0{index + 1}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="market-featured" id="featured">
          <div className="market-section market-featured-inner">
            <div className="market-section-heading">
              <div>
                <span className="market-kicker">A FEW VERY GOOD THINGS</span>
                <h2>The good <em>edit.</em></h2>
              </div>
              <ArrowLink href="/products">Shop everything</ArrowLink>
            </div>
            <div className="market-product-toolbar">
              <div className="market-filter-list" aria-label="Filter products">
                {['All good things', ...categories.map((category) => category.name)].map((category) => (
                  <button
                    className={activeCategory === category ? 'market-filter active' : 'market-filter'}
                    type="button"
                    key={category}
                    aria-pressed={activeCategory === category}
                    onClick={() => setActiveCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <label className="market-search">
                <Search size={15} aria-hidden="true" />
                <span className="sr-only">Search the good edit</span>
                <input
                  type="search"
                  placeholder="Find something good"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>
            {visibleProducts.length > 0 ? (
              <div className="market-product-grid">
                {visibleProducts.map((product, index) => {
                  const isFavorite = favorites.includes(product.name)
                  return (
                    <article className="market-product-card" key={product.name}>
                      <div className="market-product-image" style={{ backgroundColor: product.color }}>
                        <a href="/products" aria-label={`View ${product.name}`}>
                          <img
                            src={imageUrl(product.image, 720)}
                            alt={product.name}
                            loading="lazy"
                          />
                        </a>
                        <span className="market-product-badge">{product.badge}</span>
                        <button
                          className={isFavorite ? 'market-favorite is-favorite' : 'market-favorite'}
                          type="button"
                          aria-label={`${isFavorite ? 'Remove' : 'Add'} ${product.name} ${isFavorite ? 'from' : 'to'} wishlist`}
                          aria-pressed={isFavorite}
                          onClick={() => toggleFavorite(product.name)}
                        >
                          <Heart size={16} aria-hidden="true" />
                        </button>
                        <button
                          className="market-add-button"
                          type="button"
                          onClick={() => addToBag(product.name)}
                        >
                          Add to bag <span>+</span>
                        </button>
                      </div>
                      <div className="market-product-meta"><span>{product.type}</span><span>★ {product.rating}</span></div>
                      <a className="market-product-name" href="/products">{product.name}</a>
                      <div className="market-product-price"><b>{product.price}</b><del>{product.was}</del></div>
                      <span className="market-product-number">GOOD THING № 0{index + 1}</span>
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="market-empty-search">Nothing in the edit just yet. Try another search or category.</p>
            )}
            <a className="market-button market-button-outline" href="/products">
              See everything good <ArrowRight size={15} aria-hidden="true" />
            </a>
          </div>
        </section>

        <section className="market-story" id="story">
          <div className="market-story-image">
            <img
              src={imageUrl('photo-1494438639946-1ebd1d20bf85', 1100)}
              alt="A sunlit, thoughtfully arranged home"
              loading="lazy"
            />
            <span className="market-story-stamp">LESS, BUT<br />LOVELIER</span>
          </div>
          <div className="market-story-copy">
            <span className="market-kicker">A NOTE FROM US</span>
            <h2>Good things<br />should <em>feel</em> good.</h2>
            <p>
              We believe the best finds aren’t just things you buy. They’re the
              pieces you keep close, use every day, and love a little more with
              time. So we look for the thoughtful ones.
            </p>
            <a className="market-button market-button-dark" href="#categories">
              Get to know us <ArrowRight size={15} aria-hidden="true" />
            </a>
            <span className="market-story-mark" aria-hidden="true">g.</span>
          </div>
        </section>

        <section className="market-newsletter">
          <span className="market-kicker">A VERY GOOD EMAIL, OCCASIONALLY</span>
          <h2>A little good in your <em>inbox.</em></h2>
          <p>New finds, thoughtful notes, and a nice surprise on your first order.</p>
          <form onSubmit={(event) => { event.preventDefault(); setNotice('You’re on the list. Look out for a little good.') }}>
            <label className="sr-only" htmlFor="newsletter-email">Email address</label>
            <input id="newsletter-email" type="email" placeholder="Your email address" required />
            <button type="submit" aria-label="Join the mailing list"><ArrowRight size={17} aria-hidden="true" /></button>
          </form>
          <small>By subscribing, you agree to our very occasional emails. Unsubscribe any time.</small>
        </section>
      </main>

      <footer className="market-footer">
        <a className="wordmark" href="/" aria-label="Goodthings home">goodthings<span>.</span></a>
        <span>Good things, for the everyday.</span>
        <nav aria-label="Footer navigation">
          <a href="/products">Shop</a>
          <a href="#story">Our story</a>
          <a href="mailto:hello@goodthings.shop">Say hello</a>
        </nav>
        <small>© 2025 Goodthings. Made for the good days.</small>
      </footer>
      {notice && <div className="market-toast" role="status" aria-live="polite">{notice}</div>}
    </div>
  )
}
