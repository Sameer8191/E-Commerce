import { ArrowRight, Heart, Leaf, PackageCheck, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import Footer from '../../components/layout/Footer.jsx'
import Navbar from '../../components/layout/Navbar.jsx'
import './AboutPage.css'

const values = [
  {
    icon: Heart,
    title: 'Chosen with care',
    description:
      'We make room for useful, considered finds that feel right at home in everyday life.',
  },
  {
    icon: Store,
    title: 'A place for good finds',
    description:
      'Independent sellers can bring their products to a marketplace made for discovery.',
  },
  {
    icon: PackageCheck,
    title: 'Shopping made clearer',
    description:
      'Product details, orders, and support are all part of one straightforward shopping experience.',
  },
]

export default function AboutPage() {
  return (
    <div className="storefront g-about">
      <Navbar />
      <main>
        <section className="about-hero">
          <div className="about-hero-copy">
            <span className="about-eyebrow"><span /> A LITTLE ABOUT US</span>
            <h1>
              Good things
              <br />
              make <em>everyday.</em>
            </h1>
            <p>
              We believe the things around us should earn their place. Goodthings
              brings together thoughtful finds for your home, your style, and all
              the little moments in between.
            </p>
            <Link className="about-button" to="/products">
              Find your good thing <ArrowRight size={16} />
            </Link>
          </div>
          <div className="about-hero-art">
            <img
              src="https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1200&q=85"
              alt="A bright, welcoming home with thoughtfully arranged everyday objects"
            />
            <span className="about-image-note">MADE FOR THE EVERYDAY</span>
            <span className="about-image-stamp" aria-hidden="true">g.</span>
          </div>
        </section>

        <section className="about-intro" aria-labelledby="about-intro-title">
          <span className="about-eyebrow">OUR LITTLE IDEA</span>
          <h2 id="about-intro-title">
            Less scrolling for more <em>“that’s just right.”</em>
          </h2>
          <p>
            Shopping should feel inspiring, not overwhelming. We bring useful
            discoveries and independent sellers together, so it’s easier to find
            something you’ll enjoy making part of your day.
          </p>
        </section>

        <section className="about-values" aria-labelledby="about-values-title">
          <div className="about-section-heading">
            <span className="about-eyebrow">WHAT MATTERS TO US</span>
            <h2 id="about-values-title">Good by the little things.</h2>
          </div>
          <div className="about-values-grid">
            {values.map(({ icon: Icon, title, description }, index) => (
              <article className="about-value-card" key={title}>
                <span className="about-value-number">0{index + 1}</span>
                <span className="about-value-icon"><Icon size={21} strokeWidth={1.7} /></span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-sourcing">
          <div className="about-sourcing-mark" aria-hidden="true"><Leaf size={27} /></div>
          <div>
            <span className="about-eyebrow">A THOUGHTFUL MARKETPLACE</span>
            <h2>Good finds come from good people.</h2>
            <p>
              Every seller has something of their own to bring. We’re here to
              make room for those discoveries and help you shop them in one
              welcoming place.
            </p>
          </div>
          <Link to="/vendor" className="about-seller-link">
            Sell with us <ArrowRight size={16} />
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  )
}
