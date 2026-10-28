import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { getGuestCart, guestCartEventName } from '../../api/guestCart.js'
import './Navbar.css'

function Icon({ name }) {
  const paths = {
    search: <><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></>,
    user: <><circle cx="10" cy="6.5" r="3.2" /><path d="M3.5 17.5c.5-3 2.8-4.5 6.5-4.5s6 1.5 6.5 4.5" /></>,
    bag: <><path d="M4 7h12l1 10H3L4 7Z" /><path d="M7 7V5a3 3 0 0 1 6 0v2" /></>,
    menu: <><path d="M3 6h14M3 10h14M3 14h14" /></>,
  }
  return <svg aria-hidden="true" viewBox="0 0 20 20" className="nav-icon">{paths[name]}</svg>
}

export default function Navbar({ menuOpen, setMenuOpen, cartCount = 0, query = '', setQuery = () => {}, onSearch }) {
  const navigate = useNavigate()
  const [internalMenuOpen, setInternalMenuOpen] = useState(false)
  const isMenuOpen = menuOpen ?? internalMenuOpen
  const updateMenu = setMenuOpen || setInternalMenuOpen
  const signedIn = Boolean(window.localStorage.getItem('authToken'))
  const [guestCartCount, setGuestCartCount] = useState(() => getGuestCart().reduce((sum, item) => sum + (item.quantity || 0), 0))
  useEffect(() => {
    const updateGuestCount = () => setGuestCartCount(getGuestCart().reduce((sum, item) => sum + (item.quantity || 0), 0))
    window.addEventListener(guestCartEventName(), updateGuestCount)
    return () => window.removeEventListener(guestCartEventName(), updateGuestCount)
  }, [])
  const visibleCartCount = signedIn ? cartCount : guestCartCount
  const search = (event) => {
    event.preventDefault()
    updateMenu(false)
    if (onSearch) onSearch()
    else navigate(query.trim() ? `/products?search=${encodeURIComponent(query.trim())}` : '/products')
  }
  return (
    <header className="market-header" id="top">
      <div className="market-header-main">
        <button className="mobile-menu-toggle" type="button" aria-label={isMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={isMenuOpen} aria-controls="storefront-mobile-menu" onClick={() => updateMenu(!isMenuOpen)}><Icon name="menu" /></button>
        <Link className="wordmark" to="/" aria-label="Goodthings home">goodthings<span>.</span></Link>
        <Link className="delivery-location" to="/products"><span>Discover</span><b>⌘ All products</b></Link>
        <form className="header-search" role="search" onSubmit={search}><input aria-label="Search products" placeholder="Search products, brands and more" value={query} onChange={(event) => setQuery(event.target.value)} /><button type="submit" aria-label="Search"><Icon name="search" /></button></form>
        <Link className="header-account" to={signedIn ? '/account' : '/login'}><Icon name="user" /><span>{signedIn ? 'Welcome back' : 'Hello, sign in'}<b>Account</b></span></Link>
        <Link className="header-orders" to="/orders">Orders</Link>
        <Link className="header-orders" to={signedIn ? '/notifications' : '/login?redirect=%2Fnotifications'} aria-label="Order updates">Updates</Link>
        <Link className="header-orders" to="/wishlist" aria-label="Saved items">Saved</Link>
        <Link className="header-icon bag-link" to="/cart" aria-label={`Shopping bag, ${visibleCartCount} items`}><Icon name="bag" /><span>{visibleCartCount}</span></Link>
      </div>
      <nav className="desktop-nav" aria-label="Main navigation"><Link to="/products">☰ &nbsp;All categories</Link><Link to="/products?sort=price_asc">Today's deals</Link><Link to="/products?sort=newest">New arrivals</Link><Link to="/products?search=electronics">Electronics</Link><Link to="/products?search=home">Home & kitchen</Link><Link to="/products?search=fashion">Fashion</Link><Link to="/about">About Goodthings</Link><Link to="/vendor">Sell with us</Link></nav>
      {isMenuOpen && <nav className="mobile-menu market-mobile-menu" id="storefront-mobile-menu" aria-label="Mobile navigation">
        <Link to="/products" onClick={() => updateMenu(false)}>Shop all products</Link>
        <Link to="/products?sort=price_asc" onClick={() => updateMenu(false)}>Today’s deals</Link>
        <Link to="/products?sort=newest" onClick={() => updateMenu(false)}>New arrivals</Link>
        <Link to="/products?search=electronics" onClick={() => updateMenu(false)}>Electronics</Link>
        <Link to="/products?search=home" onClick={() => updateMenu(false)}>Home &amp; kitchen</Link>
        <Link to="/about" onClick={() => updateMenu(false)}>About Goodthings</Link>
        <Link to={signedIn ? '/account' : '/login'} onClick={() => updateMenu(false)}>{signedIn ? 'Your account' : 'Sign in'}</Link>
        <Link to="/orders" onClick={() => updateMenu(false)}>Your orders</Link>
        <Link to="/wishlist" onClick={() => updateMenu(false)}>Saved items</Link>
        <Link to="/vendor" onClick={() => updateMenu(false)}>Sell with us</Link>
      </nav>}
    </header>
  )
}
