import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  CreditCard,
  Heart,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tag,
  Truck,
} from "lucide-react";
import Navbar from "../../components/layout/Navbar.jsx";
import Footer from "../../components/layout/Footer.jsx";
import CheckoutModal from "../../components/checkout/CheckoutModal.jsx";
import api from "../../api/axios.js";
import { addGuestCartItem } from "../../api/guestCart.js";
import "./HomePage.css";

const fallbackCategories = [
  {
    name: "Tech & gadgets",
    image: "photo-1498049794561-7780e7231661",
    description: "Clever upgrades for every day.",
  },
  {
    name: "Home & living",
    image: "photo-1616486338812-3dadae4b4ace",
    description: "Make your space feel like you.",
  },
  {
    name: "Style & more",
    image: "photo-1490481651871-ab68de25d43d",
    description: "Wear what feels like you.",
  },
];

const heroSlides = [
  {
    image: "photo-1490481651871-ab68de25d43d",
    alt: "Colorful new season styles",
    kicker: "YOUR NEXT HAPPY PLACE",
    title: (
      <>
        Good mood.
        <br />
        Great finds.
      </>
    ),
    caption: "A little something for every day",
  },
  {
    image: "photo-1616486338812-3dadae4b4ace",
    alt: "A warm, thoughtfully styled home",
    kicker: "MAKE YOURSELF AT HOME",
    title: (
      <>
        Room to feel
        <br />
        more you.
      </>
    ),
    caption: "Thoughtful finds for your favorite space",
  },
  {
    image: "photo-1498049794561-7780e7231661",
    alt: "Useful technology and everyday gadgets",
    kicker: "CLEVER LITTLE UPGRADES",
    title: (
      <>
        Everyday, but
        <br />a bit better.
      </>
    ),
    caption: "Smart finds for everyday life",
  },
];

const imageUrl = (id, width = 800) =>
  id?.startsWith("http")
    ? id
    : `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;
const HOME_PRODUCT_PAGE_SIZE = 50;
const HOME_INITIAL_VISIBLE_PRODUCTS = 8;
const HOME_PRODUCT_RENDER_BATCH = 8;
const formatPrice = (price) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(price) || 0);

function mapProduct(product) {
  const category =
    typeof product.category === "object"
      ? product.category?.name
      : product.category || "Everyday";
  return {
    ...product,
    category,
    price: formatPrice(product.price),
    was: product.compareAtPrice ? formatPrice(product.compareAtPrice) : "",
    badge: product.compareAtPrice ? "GOOD DEAL" : "POPULAR",
    rating: Number(product.ratingsAverage || 0).toFixed(1),
    image: product.images?.[0]?.url || product.image || "",
  };
}

export default function HomePage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState(fallbackCategories);
  const [products, setProducts] = useState([]);
  const [visibleProductCount, setVisibleProductCount] = useState(
    HOME_INITIAL_VISIBLE_PRODUCTS,
  );
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsPageLoading, setProductsPageLoading] = useState(false);
  const [productsPageError, setProductsPageError] = useState("");
  const [productsPage, setProductsPage] = useState(1);
  const [productsTotalPages, setProductsTotalPages] = useState(1);
  const [productsError, setProductsError] = useState("");
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All finds");
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState(null);
  const [notice, setNotice] = useState("");
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [newsletterMessage, setNewsletterMessage] = useState("");
  const [newsletterBusy, setNewsletterBusy] = useState(false);
  const [unsubscribeBusy, setUnsubscribeBusy] = useState(false);
  const [unsubscribeMessage, setUnsubscribeMessage] = useState("");
  const [heroSlide, setHeroSlide] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const productLoadMoreRef = useRef(null);
  const productsPageLoadingRef = useRef(false);

  useEffect(() => {
    if (
      heroPaused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return undefined;
    const timer = window.setInterval(
      () => setHeroSlide((current) => (current + 1) % heroSlides.length),
      4500,
    );
    return () => window.clearInterval(timer);
  }, [heroPaused]);

  const loadHomeCatalog = useCallback(async (isActive) => {
    setProductsLoading(true);
    setProductsError("");
    const results = await Promise.allSettled([
      api.get(`/products?page=1&limit=${HOME_PRODUCT_PAGE_SIZE}&sort=newest`),
      api.get("/category?limit=20"),
      window.localStorage.getItem("authToken")
        ? api.get("/wishlist")
        : Promise.resolve(null),
      window.localStorage.getItem("authToken")
        ? api.get("/cart")
        : Promise.resolve(null),
    ]);
    const [productResult, categoryResult, wishlistResult, cartResult] = results;
    if (!isActive()) return;
    const rows =
      productResult.status === "fulfilled"
        ? productResult.value.data?.data
        : null;
    if (Array.isArray(rows)) {
      setProducts(rows.map(mapProduct));
      setVisibleProductCount(HOME_INITIAL_VISIBLE_PRODUCTS);
      setProductsPage(1);
      setProductsTotalPages(
        Number(productResult.value.data?.totalPages) || 1,
      );
      setProductsPageError("");
      if (!rows.length) setProductsError("No products are available right now.");
    } else {
      setProducts([]);
      setVisibleProductCount(HOME_INITIAL_VISIBLE_PRODUCTS);
      setProductsPage(1);
      setProductsTotalPages(1);
      setProductsError(productResult.status === "rejected"
        ? productResult.reason?.response?.data?.message || "We couldn’t load products right now."
        : "The product catalog response was invalid.");
    }
    const groups =
      categoryResult.status === "fulfilled"
        ? categoryResult.value.data?.data
        : null;
    if (Array.isArray(groups) && groups.length)
      setCategories(
        groups.map((item, index) => ({
          ...item,
          image:
            item.image ||
            fallbackCategories[index % fallbackCategories.length].image,
          description:
            item.description || `Explore ${item.name.toLowerCase()} finds.`,
        })),
      );
    if (wishlistResult?.status === "fulfilled")
      setFavorites(
        (wishlistResult.value?.data?.data?.products || [])
          .filter(Boolean)
          .map((item) => item._id),
      );
    if (cartResult?.status === "fulfilled")
      setCartCount(
        (cartResult.value?.data?.data?.items || []).reduce(
          (sum, item) => sum + (item.product ? item.quantity : 0),
          0,
        ),
      );
    setProductsLoading(false);
  }, []);

  const loadNextProductPage = useCallback(async () => {
    if (
      productsLoading ||
      productsPageLoadingRef.current ||
      (visibleProductCount >= products.length &&
        productsPage >= productsTotalPages)
    )
      return;

    if (visibleProductCount < products.length) {
      setVisibleProductCount((current) =>
        Math.min(current + HOME_PRODUCT_RENDER_BATCH, products.length),
      );
      return;
    }

    const nextPage = productsPage + 1;
    productsPageLoadingRef.current = true;
    setProductsPageLoading(true);
    setProductsPageError("");
    try {
      const response = await api.get(
        `/products?page=${nextPage}&limit=${HOME_PRODUCT_PAGE_SIZE}&sort=newest`,
      );
      const rows = response.data?.data;
      if (!Array.isArray(rows)) {
        throw new Error("The product catalog response was invalid.");
      }
      setProducts((current) => [
        ...current,
        ...rows.map(mapProduct).filter(
          (product) => !current.some((item) => item._id === product._id),
        ),
      ]);
      setProductsPage(nextPage);
      setProductsTotalPages(
        Number(response.data?.totalPages) || nextPage,
      );
    } catch (error) {
      setProductsPageError(
        error.response?.data?.message ||
          error.message ||
          "Could not load more products.",
      );
    } finally {
      productsPageLoadingRef.current = false;
      setProductsPageLoading(false);
    }
  }, [
    products,
    productsLoading,
    productsPage,
    productsTotalPages,
    visibleProductCount,
  ]);

  useEffect(() => {
    const target = productLoadMoreRef.current;
    if (
      !target ||
      productsLoading ||
      productsPageLoading ||
      productsPageError ||
      (visibleProductCount >= products.length &&
        productsPage >= productsTotalPages)
    )
      return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadNextProductPage();
        }
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [
    loadNextProductPage,
    productsPage,
    productsPageError,
    productsPageLoading,
    productsLoading,
    products.length,
    productsTotalPages,
    visibleProductCount,
  ]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void loadHomeCatalog(() => active);
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [catalogAttempt, loadHomeCatalog]);

  const visibleProducts = useMemo(
    () =>
      products.filter((product) => {
        const category =
          typeof product.category === "object"
            ? product.category?.name
            : product.category;
        return (
          (activeCategory === "All finds" || category === activeCategory) &&
          (!query.trim() ||
            `${product.name} ${category} ${product.brand || ""}`
              .toLowerCase()
              .includes(query.trim().toLowerCase()))
        );
      }),
    [activeCategory, products, query],
  );
  const brands = useMemo(
    () =>
      [
        ...new Map(
          products
            .map((product) => {
              const brand =
                typeof product.brand === "string" ? product.brand.trim() : "";
              return [
                brand.toLowerCase(),
                { name: brand, image: product.image },
              ];
            })
            .filter(([key]) => key),
        ).values(),
      ].slice(0, 8),
    [products],
  );
  const bestDiscount = useMemo(
    () =>
      products.reduce((best, product) => {
        const price = Number(String(product.price).replace(/[^\d.]/g, ""));
        const compareAtPrice = Number(product.compareAtPrice);
        if (
          !Number.isFinite(price) ||
          !Number.isFinite(compareAtPrice) ||
          compareAtPrice <= price
        )
          return best;
        return Math.max(
          best,
          Math.round(((compareAtPrice - price) / compareAtPrice) * 100),
        );
      }, 0),
    [products],
  );
  const currentHeroSlide = heroSlides[heroSlide];

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };
  const subscribeNewsletter = async (event) => {
    event.preventDefault();
    setNewsletterBusy(true);
    setNewsletterMessage("");
    try {
      const response = await api.post("/storefront/newsletter", { email: newsletterEmail, consent: newsletterConsent });
      setNewsletterMessage(response.data?.message || "Thanks for subscribing!");
      setNewsletterEmail("");
    } catch (error) {
      setNewsletterMessage(error.response?.data?.message || "Could not subscribe right now. Please try again.");
    } finally { setNewsletterBusy(false); }
  };
  const unsubscribeNewsletter = async (event) => {
    event.preventDefault();
    setUnsubscribeBusy(true);
    setUnsubscribeMessage("");
    try {
      const response = await api.post("/storefront/newsletter/unsubscribe", { email: newsletterEmail });
      setUnsubscribeMessage(response.data?.message || "You’ve been unsubscribed.");
    } catch (error) {
      setUnsubscribeMessage(error.response?.data?.message || "Could not update your subscription.");
    } finally { setUnsubscribeBusy(false); }
  };
  const addToBag = (product) => {
    if (!product?._id)
      return showNotice("This sample item is not available for checkout yet.");
    if (product.variants?.length) return navigate(`/products/${product._id}`);
    if (!window.localStorage.getItem("authToken")) {
      try {
        addGuestCartItem(product);
        showNotice(`${product.name} added to your bag.`);
      } catch (error) {
        showNotice(error.message || "Could not add this item to your bag.");
      }
      return;
    }
    api
      .post("/cart/items", { productId: product._id, quantity: 1 })
      .then(async (response) => {
        const cart = await api.get("/cart");
        setCartCount(
          (cart.data?.data?.items || []).reduce(
            (sum, item) => sum + (item.product ? item.quantity : 0),
            0,
          ),
        );
        showNotice(
          response.data?.message || `${product.name} added to your bag.`,
        );
      })
      .catch((error) => {
        if (error.response?.status === 401) {
          window.localStorage.removeItem("authToken");
          setPendingProduct(product);
          setCheckoutOpen(true);
        } else
          showNotice(
            error.response?.data?.message ||
              "Could not add this item to your bag.",
          );
      });
  };

  const toggleFavorite = async (product) => {
    if (!product?._id)
      return showNotice("This sample item cannot be saved yet.");
    if (!window.localStorage.getItem("authToken"))
      return navigate(
        `/login?redirect=${encodeURIComponent(window.location.pathname)}`,
      );
    const saved = favorites.includes(product._id);
    try {
      if (saved) await api.delete(`/wishlist/${product._id}`);
      else await api.post(`/wishlist/${product._id}`);
      setFavorites((current) =>
        saved
          ? current.filter((id) => id !== product._id)
          : [...current, product._id],
      );
      showNotice(saved ? "Removed from saved items." : "Added to saved items.");
    } catch (error) {
      showNotice(
        error.response?.data?.message || "Could not update saved items.",
      );
    }
  };

  return (
    <div className="storefront g-home">
      <div className="g-announcement">
        <Sparkles size={14} />
        <span>HELLO, GOOD THINGS!</span>
        <span className="g-announcement-divider">|</span>
        <b>Find a little joy in every scroll</b>
      </div>
      <Navbar
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        cartCount={cartCount}
        query={query}
        setQuery={setQuery}
      />

      <main>
        <section className="g-hero">
          <div className="g-hero-copy">
            <div className="g-eyebrow">
              <span /> A CURATED LITTLE CORNER OF THE INTERNET
            </div>
            <h1>
              Lovely things
              <br />
              for <em>real life.</em>
            </h1>
            <p>
              Everyday essentials, unexpected favourites, and delightful finds
              you didn't know you needed.
            </p>
            <Link className="g-primary-button" to="/products">
              Come have a look <ArrowRight size={17} />
            </Link>
            <div className="g-hero-foot">
              <div className="g-avatar-stack">
                <i>★</i>
                <i>♡</i>
                <i>+</i>
              </div>
              <span>
                <b>Picked for the joy of it.</b>
                <small>Meet the little things you'll love.</small>
              </span>
            </div>
            <span className="g-hero-scribble" aria-hidden="true">
              oh, hi!
              <br />
              ♡
            </span>
          </div>
          <div
            className="g-hero-art"
            onMouseEnter={() => setHeroPaused(true)}
            onMouseLeave={() => setHeroPaused(false)}
            onFocusCapture={() => setHeroPaused(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                setHeroPaused(false);
            }}
          >
            <img
              key={currentHeroSlide.image}
              src={imageUrl(currentHeroSlide.image, 1400)}
              alt={currentHeroSlide.alt}
            />
            <div className="g-hero-art-wash" />
            <div className="g-hero-note">
              <span>{currentHeroSlide.kicker}</span>
              <b>{currentHeroSlide.title}</b>
              <Link to="/products">
                Find your thing <ArrowUpRight size={15} />
              </Link>
            </div>
            <div className="g-hero-sticker">
              <span>
                MADE
                <br />
                FOR YOU
              </span>
              <ArrowDownRight size={17} />
            </div>
            <span className="g-hero-image-caption">
              {currentHeroSlide.caption} <span>✳ GOOD THINGS</span>
            </span>
            <div className="g-hero-pagination" aria-label="Choose hero image">
              {heroSlides.map((slide, index) => (
                <button
                  key={slide.image}
                  type="button"
                  aria-label={`Show image ${index + 1}: ${slide.alt}`}
                  aria-current={index === heroSlide ? "true" : undefined}
                  className={index === heroSlide ? "active" : ""}
                  onClick={() => setHeroSlide(index)}
                />
              ))}
            </div>
          </div>
          <div className="g-hero-side-note">
            MORE OF WHAT YOU LOVE <span>✳</span> JUST AROUND THE CORNER
          </div>
        </section>

        <section className="g-deal-banner" aria-label="Shop discounts">
          <div className="g-deal-spark" aria-hidden="true">
            ✳
          </div>
          <div className="g-deal-copy">
            <span>
              {bestDiscount ? "A LITTLE EXTRA OFF" : "GOOD FINDS, GOOD PRICES"}
            </span>
            <h2>
              {bestDiscount ? (
                <>
                  Save up to <em>{bestDiscount}%</em> on selected finds.
                </>
              ) : (
                <>
                  Lovely finds. <em>Lovely prices.</em>
                </>
              )}
            </h2>
            <p>
              {bestDiscount
                ? "A few favorites are marked down right now. Catch them while they last."
                : "Browse the collection and find something special at a feel-good price."}
            </p>
          </div>
          <Link to="/products?sort=price_asc" className="g-deal-button">
            Explore the deals <ArrowRight size={16} />
          </Link>
          <span className="g-deal-doodle" aria-hidden="true">
            GOOD
            <br />
            STUFF
          </span>
        </section>

        <section className="g-perks" aria-label="Shopping benefits">
          <div>
            <Truck />
            <span>
              <b>Delivery that feels easy</b>
              <small>Free on your first order</small>
            </span>
          </div>
          <div>
            <ShieldCheck />
            <span>
              <b>Thoughtfully picked</b>
              <small>Quality you can feel</small>
            </span>
          </div>
          <div>
            <Heart />
            <span>
              <b>Love it or return it</b>
              <small>30-day easy returns</small>
            </span>
          </div>
          <div>
            <Check />
            <span>
              <b>Checkout, made secure</b>
              <small>Shop with confidence</small>
            </span>
          </div>
        </section>

        <section className="g-trending" aria-label="Trending product searches">
          <span>
            <Sparkles size={14} /> Trending searches
          </span>
          {[
            "Wireless earbuds",
            "Home dÃ©cor",
            "Watches",
            "Gaming",
            "Gifts under INR 999",
          ].map((term) => (
            <Link
              key={term}
              to={`/products?search=${encodeURIComponent(term)}`}
            >
              {term}
              <ArrowUpRight size={12} />
            </Link>
          ))}
        </section>

        <section className="g-section g-category-section" id="g-categories">
          <div className="g-section-heading">
            <div>
              <span className="g-label">A LITTLE BIT OF EVERYTHING</span>
              <h2>
                Good things, <em>by nature.</em>
              </h2>
            </div>
            <Link className="g-underlined-link" to="/products">
              Explore all categories <ArrowRight size={15} />
            </Link>
          </div>
          <div className="g-category-grid">
            {categories.slice(0, 3).map((category, index) => (
              <button
                type="button"
                className={`g-category-card g-category-${index + 1}`}
                key={category._id || category.name}
                onClick={() => {
                  setActiveCategory(category.name);
                  document
                    .getElementById("g-products")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <img
                  src={imageUrl(category.image, 800)}
                  alt=""
                  loading="lazy"
                />
                <span className="g-category-overlay" />
                <span className="g-category-number">
                  0{index + 1} / CATEGORY
                </span>
                <span className="g-category-info">
                  <b>{category.name}</b>
                  <small>{category.description}</small>
                </span>
                <span className="g-category-arrow">
                  <ArrowUpRight size={19} />
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="g-products-section" id="g-products">
          <div className="g-section g-products-inner">
            <div className="g-section-heading">
              <div>
                <span className="g-label">CURRENTLY ON OUR RADAR</span>
                <h2>
                  The good <em>edit.</em>
                </h2>
                <p>A few things we think you'll love having around.</p>
              </div>
              <Link className="g-underlined-link" to="/products">
                Shop everything <ArrowRight size={15} />
              </Link>
            </div>
            <div className="g-product-tools">
              <div
                className="g-product-filters"
                aria-label="Filter by category"
              >
                {[
                  "All finds",
                  ...categories.map((category) => category.name),
                ].map((name) => (
                  <button
                    type="button"
                    key={name}
                    className={activeCategory === name ? "active" : ""}
                    aria-pressed={activeCategory === name}
                    onClick={() => setActiveCategory(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <label className="g-inline-search">
                <Search size={16} />
                <span className="sr-only">Search products</span>
                <input
                  placeholder="Find something good"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>
            {productsLoading ? (
              <div className="g-no-results" role="status">Loading the latest finds…</div>
            ) : productsError ? (
              <div className="g-no-results" role="alert">
                <p>{productsError}</p>
                <button type="button" className="mt-3 font-semibold underline" onClick={() => setCatalogAttempt((current) => current + 1)}>Try again</button>
              </div>
            ) : visibleProducts.length ||
              visibleProductCount < products.length ||
              productsPage < productsTotalPages ? (
              <>
                {visibleProducts.length ? (
                  <div className="g-product-grid">
                    {visibleProducts
                      .slice(0, visibleProductCount)
                      .map((product, index) => {
                      const favorite = favorites.includes(product._id);
                      return (
                        <article
                          className="g-product-card"
                          key={product._id || product.name}
                        >
                      <div className="g-product-image">
                        <Link
                          to={
                            product._id
                              ? `/products/${product._id}`
                              : "/products"
                          }
                          aria-label={`View ${product.name}`}
                        >
                          <img
                            src={imageUrl(product.image, 760)}
                            alt={product.name}
                            loading="lazy"
                          />
                        </Link>
                        <span className="g-product-tag">{product.badge}</span>
                        <button
                          className={`g-favorite ${favorite ? "saved" : ""}`}
                          type="button"
                          aria-label={`${favorite ? "Remove" : "Add"} ${product.name} ${favorite ? "from" : "to"} wishlist`}
                          aria-pressed={favorite}
                          onClick={() => toggleFavorite(product)}
                        >
                          <Heart size={17} />
                        </button>
                        <button
                          className="g-add"
                          type="button"
                          onClick={() => addToBag(product)}
                        >
                          <ShoppingBag size={15} /> Add to bag
                        </button>
                      </div>
                      <div className="g-product-meta">
                        <span>{product.category}</span>
                        <span>★ {product.rating}</span>
                      </div>
                      <Link
                        className="g-product-name"
                        to={
                          product._id ? `/products/${product._id}` : "/products"
                        }
                      >
                        {product.name}
                      </Link>
                      <div className="g-product-price">
                        <b>{product.price}</b>
                        {product.was && <del>{product.was}</del>}
                      </div>
                          <span className="g-product-index">
                            GOOD FIND — {String(index + 1).padStart(2, "0")}
                          </span>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="g-no-results">
                    No finds in this category yet. Scroll for more products or
                    try another category.
                  </div>
                )}
                {(visibleProductCount < products.length ||
                  productsPage < productsTotalPages) && (
                  <div
                    ref={productLoadMoreRef}
                    className="mt-6 min-h-8 text-center text-xs text-slate-500"
                    role="status"
                    aria-live="polite"
                  >
                    {productsPageLoading
                      ? "Loading more finds…"
                      : productsPageError
                        ? (
                          <>
                            <span>{productsPageError} </span>
                            <button
                              type="button"
                              className="font-semibold underline"
                              onClick={() => void loadNextProductPage()}
                            >
                              Try again
                            </button>
                          </>
                        )
                        : "Scroll for more finds"}
                  </div>
                )}
              </>
            ) : (
              <div className="g-no-results">
                No finds here yet. Try another category or search.
              </div>
            )}
            <Link className="g-all-products" to="/products">
              See everything good <ArrowRight size={16} />
            </Link>
          </div>
        </section>
        <section className="g-brand-trust" aria-labelledby="g-brand-title">
          <div className="g-section">
            <div className="g-brand-heading">
              <div>
                <span className="g-label">GOOD NAMES, GREAT FINDS</span>
                <h2 id="g-brand-title">
                  Shop by <em>brand.</em>
                </h2>
              </div>
              <Link className="g-underlined-link" to="/products">
                Explore all products <ArrowRight size={15} />
              </Link>
            </div>
            {brands.length ? (
              <div className="g-brand-marquee" aria-label="Browse brands">
                <div className="g-brand-track">
                  {[0, 1].map((loop) => (
                    <div
                      className="g-brand-set"
                      key={loop}
                      aria-hidden={loop === 1 ? "true" : undefined}
                    >
                      {brands.map((brand, index) => (
                        <Link
                          className={`g-brand-tile g-brand-${index % 4}`}
                          to={`/products?search=${encodeURIComponent(brand.name)}`}
                          key={`${loop}-${brand.name}`}
                          tabIndex={loop === 1 ? -1 : undefined}
                        >
                          <img
                            className="g-brand-image"
                            src={imageUrl(
                              brand.image ||
                                fallbackCategories[
                                  index % fallbackCategories.length
                                ].image,
                              220,
                            )}
                            alt=""
                            loading="lazy"
                          />
                          <b>{brand.name}</b>
                          <small>
                            Shop brand <ArrowUpRight size={12} />
                          </small>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Link className="g-brand-empty" to="/products">
                <span className="g-brand-mark">g.</span>
                <span>
                  <b>Discover the full collection</b>
                  <small>Explore all the good things in store.</small>
                </span>
                <ArrowRight size={16} />
              </Link>
            )}
            <div className="g-trust-grid">
              <div>
                <span className="g-trust-icon">
                  <CreditCard />
                </span>
                <span>
                  <b>100% safe &amp; secure payments</b>
                  <small>Protected payment options</small>
                </span>
              </div>
              <div>
                <span className="g-trust-icon">
                  <Truck />
                </span>
                <span>
                  <b>Free shipping</b>
                  <small>Delivery to your doorstep</small>
                </span>
              </div>
              <div>
                <span className="g-trust-icon">
                  <BadgeCheck />
                </span>
                <span>
                  <b>Authenticity guaranteed</b>
                  <small>Genuine products, always</small>
                </span>
              </div>
              <div>
                <span className="g-trust-icon">
                  <Tag />
                </span>
                <span>
                  <b>Deals worth finding</b>
                  <small>Lovely picks at lovely prices</small>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="g-moments" aria-labelledby="g-moments-title">
          <div className="g-section">
            <div className="g-section-heading">
              <div>
                <span className="g-label">A GOOD PLACE TO START</span>
                <h2 id="g-moments-title">
                  What are you in the mood <em>for?</em>
                </h2>
              </div>
              <span className="g-moments-note">
                Pick a lane. Find a favourite. Repeat.
              </span>
            </div>
            <div className="g-moments-grid">
              <Link
                className="g-moment-card g-moment-large"
                to="/products?search=home"
              >
                <img
                  src={imageUrl("photo-1616486338812-3dadae4b4ace", 1000)}
                  alt="Warm, inviting home details"
                  loading="lazy"
                />
                <span className="g-moment-tint" />
                <span className="g-moment-copy">
                  <small>MAKE YOUR SPACE YOURS</small>
                  <b>
                    Home, but
                    <br />
                    happier.
                  </b>
                  <span>
                    Browse home finds <ArrowRight size={15} />
                  </span>
                </span>
              </Link>
              <Link
                className="g-moment-card g-moment-top"
                to="/products?search=tech"
              >
                <img
                  src={imageUrl("photo-1498049794561-7780e7231661", 800)}
                  alt="Everyday technology and useful gadgets"
                  loading="lazy"
                />
                <span className="g-moment-tint" />
                <span className="g-moment-copy">
                  <small>SMART LITTLE UPGRADES</small>
                  <b>
                    Tech that
                    <br />
                    just gets it.
                  </b>
                  <span>
                    Explore gadgets <ArrowRight size={15} />
                  </span>
                </span>
              </Link>
              <Link
                className="g-moment-card g-moment-bottom"
                to="/products?search=style"
              >
                <img
                  src={imageUrl("photo-1490481651871-ab68de25d43d", 800)}
                  alt="Fresh personal style"
                  loading="lazy"
                />
                <span className="g-moment-tint" />
                <span className="g-moment-copy">
                  <small>YOUR EVERYDAY, ELEVATED</small>
                  <b>
                    A little more
                    <br />
                    you.
                  </b>
                  <span>
                    Find your style <ArrowRight size={15} />
                  </span>
                </span>
              </Link>
            </div>
          </div>
        </section>

        <section className="g-story" id="g-story">
          <div className="g-story-photo">
            <img
              src={imageUrl("photo-1494438639946-1ebd1d20bf85", 1100)}
              alt="A warm, sunlit home full of everyday details"
              loading="lazy"
            />
            <span className="g-story-stamp">
              LESS, BUT
              <br />
              LOVELIER
            </span>
          </div>
          <div className="g-story-copy">
            <span className="g-label">A NOTE FROM US</span>
            <h2>
              Good things
              <br />
              should <em>feel</em> good.
            </h2>
            <p>
              The best finds aren't just things you buy. They're pieces you
              keep close, use every day, and love a little more with time. We
              look for the thoughtful ones, so you can make them yours.
            </p>
            <Link className="g-dark-button" to="/products">
              Get to know the edit <ArrowRight size={16} />
            </Link>
            <span className="g-story-mark">g.</span>
          </div>
        </section>

        <section className="g-newsletter">
          <div className="g-newsletter-mark" aria-hidden="true">✳</div>
          <span className="g-label">THE LATEST FINDS</span>
          <h2>
            New things worth <em>a look.</em>
          </h2>
          <p>Get occasional notes about new finds and store updates.</p>
          <form className="mx-auto flex w-full max-w-md flex-col gap-2 sm:flex-row" onSubmit={subscribeNewsletter}>
            <label className="sr-only" htmlFor="newsletter-email">Email address</label>
            <input id="newsletter-email" className="min-h-12 min-w-0 flex-1 rounded-full border border-white/20 bg-white px-5 text-sm text-slate-900 outline-none focus:ring-4 focus:ring-white/20" type="email" autoComplete="email" required maxLength={254} placeholder="Your email address" value={newsletterEmail} onChange={(event) => setNewsletterEmail(event.target.value)} />
            <button className="g-primary-button" type="submit" disabled={newsletterBusy || !newsletterConsent}>{newsletterBusy ? "Joining…" : "Sign me up"} <ArrowRight size={16} /></button>
          </form>
          <label className="mx-auto mt-3 flex max-w-md items-start gap-2 text-left text-[10px] text-slate-200"><input className="mt-0.5" type="checkbox" checked={newsletterConsent} onChange={(event) => setNewsletterConsent(event.target.checked)} />I agree to receive occasional Goodthings news by email.</label>
          {newsletterMessage && <p className="mt-3 text-xs" role="status" aria-live="polite">{newsletterMessage}</p>}
          <small>By subscribing, you agree to receive occasional store updates.</small>
          <details className="mx-auto mt-4 max-w-md text-left text-xs text-slate-200">
            <summary className="cursor-pointer text-center underline underline-offset-4">Already subscribed? Unsubscribe</summary>
            <form className="mt-3 flex gap-2" onSubmit={unsubscribeNewsletter}>
              <label className="sr-only" htmlFor="newsletter-unsubscribe-email">Subscribed email address</label>
              <input id="newsletter-unsubscribe-email" className="min-w-0 flex-1 rounded-full bg-white px-4 py-2 text-slate-900" type="email" required placeholder="Email address" value={newsletterEmail} onChange={(event) => setNewsletterEmail(event.target.value)} />
              <button disabled={unsubscribeBusy} className="rounded-full border border-white/40 px-4 py-2 font-semibold disabled:opacity-50">{unsubscribeBusy ? "Please wait…" : "Unsubscribe"}</button>
            </form>
            {unsubscribeMessage && <p className="mt-2 text-center" role="status">{unsubscribeMessage}</p>}
          </details>
        </section>
      </main>
      <Footer />
      <CheckoutModal
        open={checkoutOpen}
        onClose={() => {
          setCheckoutOpen(false);
          setPendingProduct(null);
        }}
        pendingProduct={pendingProduct}
        onCartCount={setCartCount}
        onAdded={(message) => {
          setPendingProduct(null);
          showNotice(message);
        }}
      />
      {notice && (
        <div className="market-toast" role="status" aria-live="polite">
          {notice}
        </div>
      )}
    </div>
  );
}
