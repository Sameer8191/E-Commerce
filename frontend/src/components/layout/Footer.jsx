import { Link } from 'react-router-dom'

const footerGroups = [
  {
    title: 'Get to know us',
    links: [
      ['About Goodthings', '/about'],
      ['Careers', 'mailto:careers@goodthings.shop'],
      ['Our sourcing promise', '/about'],
      ['Newsroom', 'mailto:press@goodthings.shop'],
    ],
  },
  {
    title: 'Let us help',
    links: [
      ['Your account', '/account'],
      ['Your orders', '/orders'],
      ['Saved items', '/wishlist'],
      ['Returns & refunds', '/policies/returns'],
      ['Help & FAQs', '/help'],
      ['Contact customer care', '/contact'],
    ],
  },
  {
    title: 'Shop with us',
    links: [
      ['Shop all products', '/products'],
      ['Today’s deals', '/products?sort=price_asc'],
      ['Popular categories', '/#g-categories'],
      ['Gift ideas', '/products?search=gift'],
      ['New arrivals', '/products?sort=newest'],
    ],
  },
  {
    title: 'Our policies',
    links: [
      ['Account security', '/password-reset'],
      ['Shipping policy', '/policies/shipping'],
      ['Privacy notice', '/policies/privacy'],
      ['Terms of service', '/policies/terms'],
      ['Seller portal', '/vendor'],
      ['Admin workspace', '/admin'],
      ['Contact', '/contact'],
    ],
  },
]

export default function Footer() {
  return (
    <footer className="market-footer">
      <a className="footer-backtop" href="#top" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
        Back to top <span aria-hidden="true">↑</span>
      </a>

      <div className="footer-main">
        <div className="footer-brand-column">
          <a className="wordmark" href="/" aria-label="Goodthings home">goodthings<span>.</span></a>
          <p>Good things for the everyday. Thoughtful finds, fair prices, and a little more joy in every delivery.</p>
          <a className="footer-help-card" href="mailto:help@goodthings.shop">
            <span className="footer-help-icon" aria-hidden="true">?</span>
            <span><b>Need a hand?</b><small>Our friendly team is here to help.</small></span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>

        {footerGroups.map((group) => (
          <nav className="footer-link-column" aria-label={group.title} key={group.title}>
            <h2>{group.title}</h2>
            <ul>{group.links.map(([label, href]) => <li key={label}>{href.startsWith('mailto:') ? <a href={href}>{label}</a> : <Link to={href}>{label}</Link>}</li>)}</ul>
          </nav>
        ))}
      </div>

      <div className="footer-trust-row">
        <div><span aria-hidden="true">✓</span><p><b>Safe & secure checkout</b><small>Your information stays protected.</small></p></div>
        <div><span aria-hidden="true">↺</span><p><b>Easy 30-day returns</b><small>Changed your mind? We can help.</small></p></div>
        <div><span aria-hidden="true">♧</span><p><b>Here for the long run</b><small>Good products, better support.</small></p></div>
      </div>

      <div className="footer-bottom">
        <a className="wordmark" href="/" aria-label="Goodthings home">goodthings<span>.</span></a>
        <span className="footer-tagline">Good things, for the everyday.</span>
        <div className="footer-legal"><a href="/account">Account</a><a href="/orders">Orders</a><a href="mailto:hello@goodthings.shop">Contact</a></div>
        <small>© {new Date().getFullYear()} Goodthings Supply Co. All rights reserved.</small>
      </div>
    </footer>
  )
}
