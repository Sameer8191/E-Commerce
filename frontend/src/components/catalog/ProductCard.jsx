import { Link } from 'react-router-dom'
import { ArrowUpRight, Heart, PackageOpen, Plus, Star } from 'lucide-react'

const formatPrice = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(Number(value) || 0)

export default function ProductCard({ product, onAdd, onWishlist, wishlisted = false }) {
  const image = product.images?.[0]?.url || ''
  const categoryName = typeof product.category === 'object' ? product.category?.name : ''
  const oldPrice = Number(product.compareAtPrice)
  const price = Number(product.price)
  const discount = oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0
  const outOfStock = Number(product.stock) < 1

  return <article className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-900/5">
    <div className="relative aspect-[4/3] overflow-hidden bg-[#f5f6f8]">
      <Link className="absolute inset-0 block" to={`/products/${product._id}`} aria-label={`View ${product.name}`}>
        {image ? <img className="h-full w-full object-contain p-5 transition duration-300 group-hover:scale-[1.04]" src={image} alt={product.name} loading="lazy" /> : <span className="grid h-full place-items-center text-slate-300"><PackageOpen size={42} strokeWidth={1.3} /></span>}
        {discount > 0 && <span className="absolute left-3 top-3 rounded-full bg-[#172337] px-2.5 py-1 text-[10px] font-bold tracking-wide text-white">-{discount}%</span>}
        {outOfStock && <span className="absolute inset-0 grid place-items-center bg-white/65"><span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">Out of stock</span></span>}
        <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-slate-500 opacity-0 shadow-sm transition group-hover:opacity-100"><ArrowUpRight size={15} /></span>
      </Link>
      {onWishlist && <button className={`absolute left-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/95 shadow-sm transition hover:text-rose-600 ${wishlisted ? 'text-rose-600' : 'text-slate-500'}`} type="button" onClick={() => onWishlist(product)} aria-label={`${wishlisted ? 'Remove' : 'Save'} ${product.name} ${wishlisted ? 'from' : 'to'} wishlist`} aria-pressed={wishlisted}><Heart size={16} className={wishlisted ? 'fill-current' : ''} /></button>}
    </div>

    <div className="flex flex-1 flex-col p-4 sm:p-5">
      <div className="mb-2 flex min-h-4 items-center justify-between gap-2">
        <span className="truncate text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">{product.brand || categoryName || 'Goodthings edit'}</span>
        {Number(product.ratingsCount) > 0 && <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-600"><Star size={12} className="fill-amber-400 text-amber-400" />{Number(product.ratingsAverage || 0).toFixed(1)}</span>}
      </div>
      <Link className="line-clamp-2 min-h-11 text-sm font-semibold leading-5 text-[#172337] transition hover:text-[#2874f0]" to={`/products/${product._id}`}>{product.name}</Link>
      {product.vendor?.storeName && <p className="mt-1 truncate text-[11px] text-slate-500">Sold by <Link className="font-medium text-[#176c68] hover:underline" to={product.vendor.slug ? `/store/${product.vendor.slug}` : '/products'}>{product.vendor.storeName}</Link></p>}
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-base font-bold text-[#172337]">{formatPrice(price)}</span>
        {discount > 0 && <del className="text-xs text-slate-400">{formatPrice(oldPrice)}</del>}
      </div>
      {product.variants?.length ? <Link className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#172337] px-4 text-xs font-bold text-white transition hover:bg-[#2874f0]" to={`/products/${product._id}`}>Choose option <ArrowUpRight size={14} /></Link> : <button className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#172337] px-4 text-xs font-bold text-white transition hover:bg-[#2874f0] focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500" type="button" onClick={() => onAdd(product)} disabled={outOfStock}>
        <Plus size={15} /> {outOfStock ? 'Unavailable' : 'Add to bag'}
      </button>}
    </div>
  </article>
}
