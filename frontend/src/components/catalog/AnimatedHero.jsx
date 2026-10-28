import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ArrowUpRight, Sparkles } from 'lucide-react'

const floatTransition = {
  duration: 7,
  ease: 'easeInOut',
  repeat: Infinity,
}

export default function AnimatedHero() {
  const reduceMotion = useReducedMotion()

  return (
    <section className="market-hero" aria-labelledby="hero-title">
      <div className="market-hero-copy">
        <motion.div
          className="market-eyebrow"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="market-eyebrow-dot" />
          GOOD FINDS. BETTER EVERYDAY.
        </motion.div>
        <motion.h1
          id="hero-title"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.08 }}
        >
          A little more
          <br />
          <em>good</em> in your
          <br />
          every day.
        </motion.h1>
        <motion.p
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.16 }}
        >
          The things you love, thoughtfully picked and ready to make life feel
          that little bit better.
        </motion.p>
        <motion.div
          className="market-hero-actions"
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.24 }}
        >
          <a className="market-button market-button-dark" href="#featured">
            Shop the good stuff <ArrowRight size={15} aria-hidden="true" />
          </a>
          <a className="market-quiet-link" href="#categories">
            Explore collections <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </motion.div>
        <motion.div
          className="market-hero-proof"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
        >
          <div className="market-proof-avatars" aria-hidden="true">
            <span>J</span>
            <span>M</span>
            <span>A</span>
          </div>
          <div>
            <span className="market-proof-stars" aria-label="Rated 4.9 out of 5">
              ★★★★★
            </span>
            <small>Loved by 12,000+ happy homes</small>
          </div>
        </motion.div>
      </div>

      <div className="market-hero-stage" role="group" aria-label="Featured headphones">
        <div className="market-stage-glow" />
        <div className="market-stage-orbit market-stage-orbit-one" />
        <div className="market-stage-orbit market-stage-orbit-two" />
        <motion.div
          className="market-stage-main"
          animate={reduceMotion ? undefined : { y: [0, -12, 0], rotateY: [-5, 4, -5], rotateZ: [1, -1, 1] }}
          transition={floatTransition}
        >
          <img
            src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1100&q=85"
            alt="Premium wireless headphones in warm studio light"
          />
          <span className="market-stage-index">THE GOOD EDIT · 01</span>
          <span className="market-stage-product-name">Sound, reimagined.</span>
        </motion.div>
        <motion.div
          className="market-float-card market-float-card-top"
          animate={reduceMotion ? undefined : { y: [0, -9, 0], rotate: [-4, -2, -4] }}
          transition={{ ...floatTransition, duration: 5.5, delay: 0.2 }}
        >
          <span className="market-float-icon"><Sparkles size={15} aria-hidden="true" /></span>
          <span><b>Just dropped</b><small>Meet your new favourite</small></span>
          <ArrowUpRight size={15} aria-hidden="true" />
        </motion.div>
        <motion.div
          className="market-float-card market-float-card-bottom"
          animate={reduceMotion ? undefined : { y: [0, 8, 0], rotate: [3, 1, 3] }}
          transition={{ ...floatTransition, duration: 6, delay: 0.45 }}
        >
          <img
            src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=180&q=80"
            alt=""
          />
          <span><b>The everyday watch</b><small>Good things, $89</small></span>
          <span className="market-float-heart" aria-hidden="true">✳</span>
        </motion.div>
        <div className="market-stage-sticker">
          <span>GOOD</span>
          <span>THINGS</span>
          <small>BETTER DAYS AHEAD</small>
        </div>
      </div>
      <a className="market-scroll-cue" href="#categories">
        <span /> SCROLL TO FEEL GOOD
      </a>
    </section>
  )
}