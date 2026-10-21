function Icon({ name }) {
  const paths = {
    search: <><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></>,
    user: <><circle cx="10" cy="6.5" r="3.2" /><path d="M3.5 17.5c.5-3 2.8-4.5 6.5-4.5s6 1.5 6.5 4.5" /></>,
    bag: <><path d="M4 7h12l1 10H3L4 7Z" /><path d="M7 7V5a3 3 0 0 1 6 0v2" /></>,
    menu: <><path d="M3 6h14M3 10h14M3 14h14" /></>,
  }
  return <svg aria-hidden="true" viewBox="0 0 20 20" className="nav-icon">{paths[name]}</svg>
}

export default function Navbar({ menuOpen, setMenuOpen, cartCount = 0, query = '', setQuery = () => {} }) {
  return (
    <header className="market-header">
      <div className="market-header-main">
        <button className="mobile-menu-toggle" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu" /></button>
        <a className="wordmark" href="/" aria-label="Goodthings home">goodthings<span>.</span></a>
        <a className="delivery-location" href="#categories"><span>Deliver to</span><b>⌖ Your location</b></a>
        <label className="header-search"><input aria-label="Search products" placeholder="Search for products, brands and more" value={query} onChange={(event) => setQuery(event.target.value)} /><button type="button" aria-label="Search" onClick={() => document.getElementById('featured')?.scrollIntoView({ behavior: 'smooth' })}><Icon name="search" /></button></label>
        <a className="header-account" href="/login"><Icon name="user" /><span>Hello, sign in<b>Account</b></span></a>
        <a className="header-orders" href="/orders">Orders</a>
        <a className="header-icon bag-link" href="/cart" aria-label={`Shopping bag, ${cartCount} items`}><Icon name="bag" /><span>{cartCount}</span></a>
      </div>
      <nav className="desktop-nav" aria-label="Main navigation"><a href="#categories">☰ &nbsp;All categories</a><a href="#featured">Today's deals</a><a href="#featured">Best sellers</a><a href="#categories">Electronics</a><a href="#categories">Home & kitchen</a><a href="#categories">Fashion</a><a href="#story">About Goodthings</a></nav>
    </header>
  )
}
