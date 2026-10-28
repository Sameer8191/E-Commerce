import { useState } from 'react'
import { Activity, AlertTriangle, ArrowRight, ArrowUpRight, Box, Check, ChevronLeft, ChevronRight, Clock3, Download, FileText, Layers3, Package, Plus, RefreshCw, RotateCcw, Search, ShoppingBag, ShoppingCart, SlidersHorizontal, Star, Users } from 'lucide-react'
import { PAGE_SIZE, ORDER_STATUSES, formatDate, formatMoney, orderTone, paymentTone, shortId } from './adminUtils.js'
import InvoiceButton from './InvoiceButton.jsx'
import OrderDetailsButton from './OrderDetailsButton.jsx'

export function Badge({ children, className = '' }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset ${className}`}>{children}</span>
}

export function Avatar({ name = 'Customer', size = 'md' }) {
  const palettes = ['bg-violet-100 text-violet-700', 'bg-orange-100 text-orange-700', 'bg-emerald-100 text-emerald-700', 'bg-sky-100 text-sky-700', 'bg-rose-100 text-rose-700']
  const color = palettes[[...name].reduce((sum, character) => sum + character.charCodeAt(0), 0) % palettes.length]
  const dimensions = size === 'sm' ? 'size-8 text-[10px]' : 'size-10 text-xs'
  return <span className={`inline-grid shrink-0 place-items-center rounded-full font-bold ${dimensions} ${color}`} aria-hidden="true">{name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'C'}</span>
}

export function SectionTitle({ eyebrow, title, description, actions }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div><p className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-indigo-600">{eyebrow}</p><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">{title}</h1><p className="mt-1.5 text-sm text-slate-500">{description}</p></div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
}

export function MetricCard({ label, value, detail, icon: Icon, color, trend }) {
  const iconColors = { indigo: 'bg-indigo-50 text-indigo-600', sky: 'bg-sky-50 text-sky-600', amber: 'bg-amber-50 text-amber-600', emerald: 'bg-emerald-50 text-emerald-600' }
  return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[.02] sm:p-5">
    <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-slate-500">{label}</p><span className={`grid size-10 place-items-center rounded-xl ${iconColors[color]}`}><Icon size={18} /></span></div>
    <p className="mt-3 text-[27px] font-bold tracking-tight text-slate-900">{value}</p>
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">{trend && <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-700"><ArrowUpRight size={14} />{trend}</span>}<span>{detail}</span></div>
  </article>
}

export function EmptyState({ icon: Icon, title, detail }) {
  return <div className="flex min-h-52 flex-col items-center justify-center px-5 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Icon size={22} /></span><h3 className="mt-4 text-sm font-semibold text-slate-800">{title}</h3><p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{detail}</p></div>
}

export function Pagination({ page, totalPages, total, onPage }) {
  const start = total ? (page - 1) * PAGE_SIZE + 1 : 0
  const end = Math.min(page * PAGE_SIZE, total)
  return <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
    <span>Showing <b className="font-semibold text-slate-700">{start}–{end}</b> of <b className="font-semibold text-slate-700">{total}</b></span>
    <div className="flex items-center gap-2"><button className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={16} /></button><span className="min-w-20 text-center">Page {page} of {Math.max(totalPages, 1)}</span><button className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => onPage(page + 1)} disabled={page >= totalPages} aria-label="Next page"><ChevronRight size={16} /></button></div>
  </div>
}

export function OperationalAlerts({ stats = {}, onView, canViewAnalytics = false, canViewInventory = false, canViewOrders = false }) {
  const alerts = stats.operationalAlerts || {}
  const rows = [
    ['Low-stock products', alerts.lowStockProducts || 0, 'inventory'],
    ['Online payments pending', alerts.pendingPaymentOrders || 0, 'orders'],
    ['Failed payments', alerts.failedPayments || 0, 'orders'],
    ['Fulfillment delayed over 3 days', alerts.delayedFulfillment || 0, 'orders'],
    ['Reservations expiring soon', alerts.expiringReservations || 0, 'orders'],
  ]
  const visibleRows = rows.filter(([, , destination]) => destination === 'inventory' ? canViewInventory : canViewOrders)
  const total = visibleRows.reduce((sum, [, count]) => sum + Number(count || 0), 0)

  return <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${total ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}><AlertTriangle size={17}/></span>
        <div><h2 className="text-sm font-bold text-slate-900">Operational alerts</h2><p className="mt-1 text-xs text-slate-500">{total ? `${total} item${total === 1 ? '' : 's'} may need attention.` : 'No operational issues need attention right now.'}</p></div>
      </div>
      {canViewAnalytics && <button onClick={() => onView('analytics')} className="shrink-0 text-xs font-semibold text-indigo-700 hover:text-indigo-800">Alert details <ArrowRight size={13} className="inline"/></button>}
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      {visibleRows.map(([label, count, destination]) => <button key={label} onClick={() => onView(destination)} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5 text-left hover:border-indigo-100 hover:bg-slate-50">
        <span className="text-[11px] text-slate-600">{label}</span>
        <b className={`rounded-full px-2 py-0.5 text-[10px] ${count ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{Number(count || 0).toLocaleString('en-IN')}</b>
      </button>)}
    </div>
    {canViewInventory && stats.lowStockProducts?.length > 0 && <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
      <span className="mr-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Stock to watch</span>
      {stats.lowStockProducts.slice(0, 5).map((product) => <span key={product._id} className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] text-amber-800">{product.name} · {product.stock} left</span>)}
    </div>}
  </section>
}


export function Overview({ stats = {}, orders, customers, busyId, onUpdateOrder, onUpdateCustomer, onView, onSaveTarget, onRefresh, canUpdateOrder = false, canCancelOrders = false, canDeactivateCustomers = false, canUpdateTarget = false, canViewCustomers = false, canViewOrders = false, canViewInventory = false, canViewAnalytics = false, canViewInvoices = false }) {
  const monthlyTarget = Number(stats.monthToDate?.target || 100000)
  const [targetDraft, setTargetDraft] = useState(String(monthlyTarget))
  const monthRevenue = Number(stats.monthToDate?.revenue || 0)
  const targetProgress = Math.min(100, monthlyTarget ? monthRevenue / monthlyTarget * 100 : 0)
  const recentProcessing = orders.filter((order) => ['pending', 'confirmed', 'processing'].includes(order.orderStatus)).length
  const recentShipped = orders.filter((order) => order.orderStatus === 'shipped').length
  const recentDelivered = orders.filter((order) => order.orderStatus === 'delivered').length
  const orderValue = orders.reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0)
  const salesDays = stats.salesByDay || []
  const salesMax = Math.max(1, ...salesDays.map((day) => Number(day.revenue) || 0))
  const salesPoints = salesDays.map((day, index) => ({
    ...day,
    x: salesDays.length > 1 ? 8 + index * 584 / (salesDays.length - 1) : 300,
    y: 156 - (Number(day.revenue) || 0) / salesMax * 140,
  }))
  const salesLine = salesPoints.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  const salesArea = salesPoints.length ? `${salesLine} L ${salesPoints[salesPoints.length - 1].x} 164 L ${salesPoints[0].x} 164 Z` : ''
  const metrics = [
    { label: 'Total sales', value: formatMoney(monthRevenue), detail: 'Paid revenue · this month', icon: ShoppingCart, color: 'emerald' },
    { label: 'Total orders', value: stats.totalOrders, detail: `${stats.monthToDate?.orders || 0} paid this month`, icon: ShoppingBag, color: 'indigo' },
    { label: 'Customers', value: stats.totalUsers, detail: 'Registered accounts', icon: Users, color: 'sky' },
    { label: 'Visitors', value: Number(stats.visitors || 0), detail: `Unique sessions · last ${stats.period?.days || 30} days`, icon: Users, color: 'amber' },
    { label: 'Active products', value: stats.activeProducts, detail: `${stats.inactiveProducts || 0} inactive · ${stats.totalProducts || 0} total`, icon: Package, color: 'indigo' },
  ]
  return <>
    <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">{metrics.map((metric) => <MetricCard key={metric.label} {...metric} value={typeof metric.value === 'number' ? metric.value.toLocaleString('en-IN') : metric.value} />)}</section>
    <OperationalAlerts stats={stats} onView={onView} canViewAnalytics={canViewAnalytics} canViewInventory={canViewInventory} canViewOrders={canViewOrders} />
    <section className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,.8fr)]">
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between"><div><h2 className="text-sm font-bold text-slate-900">Sales performance</h2><p className="mt-1 text-xs text-slate-500">Paid sales over the last {stats.period?.days || 30} days</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">{stats.period?.revenue > stats.period?.previousRevenue ? '↑' : '↓'} {stats.period?.previousRevenue ? Math.abs(Math.round((stats.period.revenue - stats.period.previousRevenue) / stats.period.previousRevenue * 100)) : 0}% vs prior period</span></div>
        <div className="mt-5 h-40 w-full" role="img" aria-label="Daily paid sales line graph">
          {salesPoints.length ? <svg viewBox="0 0 600 170" preserveAspectRatio="none" className="h-full w-full overflow-visible">
            {[16, 51, 86, 121, 164].map((y) => <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="3 5" />)}
            {salesPoints.length > 1 && <path d={salesArea} fill="url(#salesFill)" />}
            <defs><linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity=".2"/><stop offset="100%" stopColor="#6366f1" stopOpacity="0"/></linearGradient></defs>
            {salesPoints.length > 1 && <path d={salesLine} fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
            {salesPoints.map((point) => <circle key={point._id} cx={point.x} cy={point.y} r={salesPoints.length === 1 ? 5 : 3.5} fill="#fff" stroke="#4f46e5" strokeWidth="2.5" vectorEffect="non-scaling-stroke"><title>{`${point._id}: ${formatMoney(point.revenue)}`}</title></circle>)}
          </svg> : <div className="grid h-full place-items-center text-xs text-slate-400">No paid sales in this period</div>}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>{salesDays[0]?._id || 'No sales yet'}</span><span>{salesDays[salesDays.length - 1]?._id || ''}</span></div>
      </article>
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between"><div><h2 className="text-sm font-bold text-slate-900">Monthly sales target</h2><p className="mt-1 text-xs text-slate-500">Month-to-date paid revenue</p></div><span className="text-xs font-bold text-indigo-700">{Math.round(targetProgress)}%</span></div><p className="mt-5 text-2xl font-bold text-slate-900">{formatMoney(monthRevenue)} <span className="text-sm font-medium text-slate-400">/ {formatMoney(monthlyTarget)}</span></p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${targetProgress}%` }} /></div>{canUpdateTarget && <form className="mt-5 flex gap-2" onSubmit={async (event) => { event.preventDefault(); const next = Number(targetDraft); if (Number.isFinite(next) && next > 0) await onSaveTarget(next) }}><label className="sr-only" htmlFor="monthly-sales-target">Monthly sales target</label><input id="monthly-sales-target" type="number" min="1" value={targetDraft} onChange={(event) => setTargetDraft(event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-xs"/><button className="rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white">Set target</button></form>}<p className="mt-2 text-[10px] text-slate-400">Shared with authorized store administrators.</p></article>
    </section>
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div><h2 className="text-sm font-bold text-slate-900">Top categories by revenue</h2><p className="mt-1 text-xs text-slate-500">Paid product revenue this month</p></div>{stats.categoryRevenue?.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2">{stats.categoryRevenue.map((category, index) => { const max = stats.categoryRevenue[0]?.revenue || 1; return <div key={category._id}><div className="mb-1.5 flex justify-between text-xs"><span className="font-medium text-slate-700">{index + 1}. {category._id}</span><b className="text-slate-900">{formatMoney(category.revenue)}</b></div><div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(3, category.revenue / max * 100)}%` }} /></div></div> })}</div> : <p className="mt-4 text-xs text-slate-500">Category sales will appear after paid orders are placed.</p>}</section>
    <section className={`mb-6 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.85fr)] ${canViewOrders ? "" : "hidden"}`}>
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[.02] sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-bold text-slate-900">Recent order activity</h2><p className="mt-1 text-xs text-slate-500">Fulfilment status across the latest orders</p></div><button onClick={() => onView('orders')} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-800">All orders <ArrowRight size={14} /></button></div>
        <div className="mt-6 grid gap-5 sm:grid-cols-[150px_1fr] sm:items-center">
          <div className="relative mx-auto grid size-36 place-items-center rounded-full" style={{ background: orders.length ? `conic-gradient(#6366f1 0 ${recentProcessing / orders.length * 100}%, #38bdf8 ${recentProcessing / orders.length * 100}% ${(recentProcessing + recentShipped) / orders.length * 100}%, #34d399 ${(recentProcessing + recentShipped) / orders.length * 100}% ${(recentProcessing + recentShipped + recentDelivered) / orders.length * 100}%, #e2e8f0 ${(recentProcessing + recentShipped + recentDelivered) / orders.length * 100}% 100%)` : '#e2e8f0' }}><span className="absolute inset-[13px] grid place-content-center rounded-full bg-white text-center"><b className="text-2xl text-slate-900">{orders.length}</b><small className="mt-0.5 text-[10px] text-slate-500">latest orders</small></span></div>
          <div className="grid gap-4">{[['Processing', recentProcessing, 'bg-indigo-500'], ['Shipped', recentShipped, 'bg-sky-400'], ['Delivered', recentDelivered, 'bg-emerald-400']].map(([label, count, color]) => <div key={label}><div className="mb-1.5 flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-slate-600"><i className={`size-2 rounded-sm ${color}`} />{label}</span><b className="text-slate-800">{count}</b></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${orders.length ? count / orders.length * 100 : 0}%` }} /></div></div>)}</div>
        </div>
      </article>
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[.02] sm:p-6">
        <div><h2 className="text-sm font-bold text-slate-900">Recent order value</h2><p className="mt-1 text-xs text-slate-500">Combined value of the latest {orders.length} orders</p></div>
        <p className="mt-5 text-3xl font-bold tracking-tight text-slate-900">{formatMoney(orderValue)}</p>
        <p className="mt-1 text-xs text-slate-500">Order totals include shipping and discounts.</p>
        <div className="mt-6 border-t border-slate-100 pt-4"><div className="flex items-center justify-between text-xs"><span className="text-slate-500">Catalog availability</span><b className="text-slate-800">{stats.totalProducts ? Math.round((stats.activeProducts / stats.totalProducts) * 100) : 0}%</b></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${stats.totalProducts ? Math.round((stats.activeProducts / stats.totalProducts) * 100) : 0}%` }} /></div><p className="mt-2 text-[11px] text-slate-500">{stats.activeProducts || 0} active of {stats.totalProducts || 0} products</p></div>
      </article>
    </section>
    {canViewOrders && <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[.02]"><div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6"><div><h2 className="text-sm font-bold text-slate-900">Latest orders</h2><p className="mt-1 text-xs text-slate-500">Newest activity from your store</p></div><button onClick={() => onView('orders')} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-800">View all <ArrowRight size={14} /></button></div><OrderTable orders={orders.slice(0, 5)} busyId={busyId} onUpdate={onUpdateOrder} onRefresh={onRefresh} compact canUpdate={canUpdateOrder} canCancel={canCancelOrders} canInvoice={canViewInvoices} /></section>}
    {canViewCustomers && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[.02]"><div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6"><div><h2 className="text-sm font-bold text-slate-900">New customers</h2><p className="mt-1 text-xs text-slate-500">Recently registered accounts</p></div><button onClick={() => onView('customers')} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-800">View customers <ArrowRight size={14} /></button></div><CustomerTable customers={customers} busyId={busyId} onUpdate={onUpdateCustomer} canDeactivate={canDeactivateCustomers} /></section>}
  </>
}

export function AnalyticsView({ stats = {}, days = 30, onDays, onView, canViewInventory = false, canViewOrders = false }) {
  const period = stats.period || {}
  const points = (stats.salesByDay || []).map((item, index, all) => ({
    ...item,
    x: all.length > 1 ? 8 + index * 584 / (all.length - 1) : 300,
    y: 156 - (Number(item.revenue) || 0) / Math.max(1, ...all.map((day) => Number(day.revenue) || 0)) * 140,
  }))
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  const metrics = [
    { label: 'Paid revenue', value: formatMoney(period.revenue), detail: `Last ${days} days`, icon: ShoppingCart, color: 'emerald' },
    { label: 'Orders placed', value: Number(period.orders || 0).toLocaleString('en-IN'), detail: `${period.paidOrders || 0} paid orders`, icon: ShoppingBag, color: 'indigo' },
    { label: 'Average order value', value: formatMoney(period.averageOrderValue), detail: 'Paid orders only', icon: ArrowUpRight, color: 'sky' },
    { label: 'New customers', value: Number(period.newCustomers || 0).toLocaleString('en-IN'), detail: `Last ${days} days`, icon: Users, color: 'amber' },
    { label: 'Visitors', value: Number(stats.visitors || 0).toLocaleString('en-IN'), detail: 'Anonymous sessions', icon: Activity, color: 'sky' },
  ]
  const statuses = Object.entries(stats.orderStatusBreakdown || {}).sort((a, b) => b[1] - a[1])
  const maxCategory = Math.max(1, ...(stats.categoryRevenue || []).map((item) => Number(item.revenue) || 0))
  const downloadCsv = () => {
    const records = [
      ['Type', 'Name', 'Date', 'Count', 'Revenue', 'Average rating'],
      ['Visitors', 'Anonymous sessions', `${days} day range`, stats.visitors || 0, '', ''],
      ...(stats.salesByDay || []).map((item) => ['Daily sales', '', item._id, item.orders || 0, item.revenue || 0, '']),
      ...(stats.topProducts || []).map((item) => ['Top product', item.name, '', item.units || 0, item.revenue || 0, '']),
      ...(stats.categoryRevenue || []).map((item) => ['Category MTD', item._id, '', item.units || 0, item.revenue || 0, '']),
      ...(stats.mostReviewedProducts || []).map((item) => ['Most reviewed', item.name, '', item.reviewCount || 0, '', item.averageRating || 0]),
    ]
    const csv = records.map((record) => record.map((value) => {
      const text = String(value).replace(/^[=+\-@\t\r]/, (match) => `'${match}`)
      return `"${text.replaceAll('"', '""')}"`
    }).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `goodthings-analytics-${days}-days.csv`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const alerts = stats.operationalAlerts || {}
  const alertRows = [
    ['Low stock products', alerts.lowStockProducts || 0, 'inventory'],
    ['Payments awaiting completion', alerts.pendingPaymentOrders || 0, 'orders'],
    ['Reservations expiring in 15 min', alerts.expiringReservations || 0, 'orders'],
    ['Failed payments', alerts.failedPayments || 0, 'orders'],
    ['Fulfillment delayed over 3 days', alerts.delayedFulfillment || 0, 'orders'],
  ].filter(([, , destination]) => destination === 'inventory' ? canViewInventory : canViewOrders)
  return <>
    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-600">Store performance</p><h2 className="mt-1 text-xl font-bold text-slate-900">Detailed analytics</h2><p className="mt-1 text-sm text-slate-500">Sales, order health, and customer growth. Visitor counts are anonymous sessions retained for up to 180 days.</p></div><div className="flex items-end gap-2"><label className="grid gap-1 text-[11px] font-semibold text-slate-500">Reporting period<select value={days} onChange={(event) => onDays(Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700"><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label><button type="button" onClick={downloadCsv} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Download size={14}/>Export CSV</button></div></div>
    <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metrics.map((metric) => <MetricCard key={metric.label} {...metric}/>)}</section>
    <section className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,.8fr)]">
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><h3 className="text-sm font-bold text-slate-900">Operational alerts</h3><p className="mt-1 text-xs text-slate-500">Items that may need attention</p></div>{canViewInventory && <button onClick={() => onView('inventory')} className="text-xs font-semibold text-indigo-700">Open inventory</button>}</div><div className="mt-4 divide-y divide-slate-100">{alertRows.map(([label, count, destination]) => <button key={label} onClick={() => onView(destination)} className="flex w-full items-center justify-between py-2.5 text-left"><span className="text-xs text-slate-600">{label}</span><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${count ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{count}</span></button>)}</div>{canViewInventory && stats.lowStockProducts?.length > 0 && <div className="mt-3 rounded-lg bg-amber-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Lowest stock</p>{stats.lowStockProducts.slice(0, 4).map((product) => <div key={product._id} className="mt-2 flex justify-between gap-3 text-[11px] text-amber-900"><span className="truncate">{product.name}</span><b>{product.stock} left</b></div>)}</div>}</article>
    </section>
    <section className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,.8fr)]">
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><h3 className="text-sm font-bold text-slate-900">Revenue trend</h3><p className="mt-1 text-xs text-slate-500">Daily paid revenue · {days} days</p></div><span className="text-xs font-semibold text-slate-500">{formatMoney(period.revenue)}</span></div>
        <div className="mt-5 h-52 w-full" role="img" aria-label={`Daily paid revenue over the last ${days} days`}>
          {points.length ? <svg viewBox="0 0 600 170" preserveAspectRatio="none" className="h-full w-full overflow-visible">{[16,51,86,121,164].map((y) => <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="3 5"/>)}{points.length > 1 && <path d={line} fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>}{points.map((point) => <circle key={point._id} cx={point.x} cy={point.y} r="3.5" fill="white" stroke="#4f46e5" strokeWidth="2.5" vectorEffect="non-scaling-stroke"><title>{`${point._id}: ${formatMoney(point.revenue)}`}</title></circle>)}</svg> : <div className="grid h-full place-items-center text-sm text-slate-400">No paid sales in this period</div>}
        </div><div className="flex justify-between text-[10px] text-slate-400"><span>{stats.salesByDay?.[0]?._id || ''}</span><span>{stats.salesByDay?.[stats.salesByDay.length - 1]?._id || ''}</span></div>
      </article>
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h3 className="text-sm font-bold text-slate-900">Orders by status</h3><p className="mt-1 text-xs text-slate-500">Orders placed during the selected period</p>{statuses.length ? <div className="mt-5 grid gap-4">{statuses.map(([status, count]) => { const total = statuses.reduce((sum, entry) => sum + entry[1], 0); return <div key={status}><div className="mb-1.5 flex justify-between text-xs"><span className="capitalize text-slate-600">{status}</span><b className="text-slate-800">{count}</b></div><div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${count / total * 100}%` }}/></div></div>})}</div> : <p className="mt-5 text-xs text-slate-500">No orders in this period.</p>}</article>
    </section>
    <section className="grid gap-5 xl:grid-cols-3">
      <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold text-slate-900">Top products</h3><p className="mt-1 text-xs text-slate-500">By paid revenue in selected period</p></div>{stats.topProducts?.length ? <div className="divide-y divide-slate-100">{stats.topProducts.map((product, index) => <div key={product._id || product.name} className="flex items-center gap-3 px-5 py-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-700">{index + 1}</span><div className="min-w-0 flex-1"><b className="block truncate text-xs text-slate-800">{product.name}</b><small className="text-[11px] text-slate-500">{product.units} units sold</small></div><b className="text-xs text-slate-900">{formatMoney(product.revenue)}</b></div>)}</div> : <EmptyState icon={Package} title="No product sales yet" detail="Paid product sales will appear here."/>}</article>
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h3 className="text-sm font-bold text-slate-900">Top categories</h3><p className="mt-1 text-xs text-slate-500">Paid product revenue this month</p>{stats.categoryRevenue?.length ? <div className="mt-5 grid gap-4">{stats.categoryRevenue.map((category, index) => <div key={category._id}><div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="truncate font-medium text-slate-700">{index + 1}. {category._id}</span><b className="shrink-0">{formatMoney(category.revenue)}</b></div><div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(3, category.revenue / maxCategory * 100)}%` }}/></div></div>)}</div> : <p className="mt-5 text-xs text-slate-500">Category sales will appear after paid orders are placed.</p>}</article>
      <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold text-slate-900">Most reviewed products</h3><p className="mt-1 text-xs text-slate-500">Ranked by total customer reviews</p></div>{stats.mostReviewedProducts?.length ? <div className="divide-y divide-slate-100">{stats.mostReviewedProducts.map((product, index) => <div key={product._id} className="flex items-center gap-3 px-5 py-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-xs font-bold text-amber-700">{index + 1}</span><div className="min-w-0 flex-1"><b className="block truncate text-xs text-slate-800">{product.name}</b><small className="text-[11px] text-slate-500">{product.reviewCount} {product.reviewCount === 1 ? 'review' : 'reviews'}</small></div><span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-700"><Star size={13} className="fill-amber-400 text-amber-400"/>{Number(product.averageRating).toFixed(1)}</span></div>)}</div> : <EmptyState icon={Star} title="No reviews yet" detail="Products with customer reviews will be ranked here."/>}</article>
    </section>
  </>
}

export function OrdersView({ orders, pagination, page, status, search, busyId, onStatus, onSearch, onPage, onUpdate, onRefresh, canUpdate = false, canCancel = false, canInvoice = false }) {
  const pageStats = [
    { label: 'Orders on this page', count: orders.length, tone: 'text-slate-900' },
    { label: 'Awaiting action', count: orders.filter((order) => ['pending', 'confirmed', 'processing'].includes(order.orderStatus)).length, tone: 'text-amber-700' },
    { label: 'In transit', count: orders.filter((order) => order.orderStatus === 'shipped').length, tone: 'text-sky-700' },
    { label: 'Completed', count: orders.filter((order) => order.orderStatus === 'delivered').length, tone: 'text-emerald-700' },
  ]
  return <div className="grid gap-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{pageStats.map((item) => <article key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[.02]"><p className="text-xs font-medium text-slate-500">{item.label}</p><p className={`mt-2 text-2xl font-bold tracking-tight ${item.tone}`}>{item.count}</p><p className="mt-1 text-[10px] text-slate-400">Current result page</p></article>)}</div>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[.02]"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:px-5"><div className="min-w-0 flex-1"><h2 className="text-sm font-bold text-slate-900">Order management</h2><p className="mt-1 text-xs text-slate-500">Review orders, payment, and fulfilment status</p></div><label className="flex h-9 w-full items-center gap-2 rounded-lg border border-slate-200 px-3 text-slate-400 sm:max-w-xs"><Search size={15} /><input className="min-w-0 flex-1 text-xs text-slate-700 outline-none placeholder:text-slate-400" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search orders or customers" /></label><label className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 text-slate-500"><SlidersHorizontal size={14} /><select aria-label="Filter orders by fulfilment status" value={status} onChange={(event) => onStatus(event.target.value)} className="bg-transparent text-xs font-medium text-slate-700 outline-none"><option value="all">All statuses</option>{ORDER_STATUSES.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label></div>{orders.length ? <OrderTable orders={orders} busyId={busyId} onUpdate={onUpdate} onRefresh={onRefresh} canUpdate={canUpdate} canCancel={canCancel} canInvoice={canInvoice} /> : <EmptyState icon={ShoppingBag} title={search ? 'No matching orders' : 'No orders found'} detail={search ? 'Try another order number, customer, or product.' : status === 'all' ? 'When customers place orders, they’ll appear here.' : `There are no ${status} orders right now.`} />}<Pagination page={page} totalPages={pagination.totalPages} total={pagination.total} onPage={onPage} /></section>
  </div>
}

export function RefundsView({ orders, pagination, page, busyId, onPage, onAction, permissions = [] }) {
  const can = (permission) => permissions.includes(permission)
  const refundStatusTone = {
    pending: 'bg-amber-50 text-amber-700 ring-amber-200',
    processing: 'bg-sky-50 text-sky-700 ring-sky-200',
    processed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    failed: 'bg-rose-50 text-rose-700 ring-rose-200',
  }
  const requestStatusTone = {
    requested: 'bg-amber-50 text-amber-700 ring-amber-200',
    approved: 'bg-sky-50 text-sky-700 ring-sky-200',
    rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
    refunded: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
  }
  const refunds = orders
  const totals = [
    ['Requests on this page', refunds.length],
    ['Awaiting review', refunds.filter((order) => order.returnRequest?.status === 'requested').length],
    ['Refunds in progress', refunds.filter((order) => ['pending', 'processing'].includes(order.refundStatus)).length],
    ['Refunds completed', refunds.filter((order) => order.refundStatus === 'processed').length],
    ['Refunds needing attention', refunds.filter((order) => order.refundStatus === 'failed').length],
  ]

  return <div className="grid gap-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{totals.map(([label, value]) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500">{label}</p><b className="mt-2 block text-2xl text-slate-900">{value}</b></article>)}</div>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-bold text-slate-900">Returns &amp; refund progress</h2><p className="mt-1 text-xs text-slate-500">Customer requests are accepted within 30 days of delivery. Razorpay refunds are processed automatically after approval; COD refunds require recording the manual refund reference.</p></div>
      {refunds.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-left"><thead><tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-400"><th className="px-5 py-3">Order / customer</th><th className="px-4 py-3">Reason / details</th><th className="px-4 py-3">Request status</th><th className="px-4 py-3">Refund status / amount</th><th className="px-4 py-3">Request date</th><th className="px-4 py-3">Review note / issue</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody>{refunds.map((order) => {
        const request = order.returnRequest || {}
        const refundAmount = Number(request.refundAmount) > 0 ? Number(request.refundAmount) : Number(order.totalAmount) || 0
        const refundComplete = order.refundStatus === 'processed' || ['refunded', 'partially_refunded'].includes(order.paymentStatus)
        const requestStatus = request.status && request.status !== 'none' ? request.status : 'cancelled'
        const reason = request.status && request.status !== 'none'
          ? { defective: 'Defective or damaged', wrong_item: 'Wrong item received', not_as_described: 'Not as described', changed_mind: 'Changed my mind', other: 'Other' }[request.reason] || '—'
          : 'Order cancellation'
        return <tr key={order._id} className="border-t border-slate-100">
          <td className="px-5 py-3"><b className="block text-xs text-slate-800">#{order.orderNumber || shortId(order._id)}</b><small className="mt-1 block text-[10px] text-slate-500">{order.user?.name || order.shippingAddress?.fullName || 'Customer'}</small><small className="block text-[10px] text-slate-400">{order.user?.email || ''}</small></td>
          <td className="max-w-56 px-4 py-3"><b className="block text-xs text-slate-700">{reason}</b>{request.items?.length > 0 && <ul className="mt-1 list-inside list-disc text-[11px] text-slate-600">{request.items.map((item) => <li key={`${item.product}-${item.name}`}>{item.quantity} × {item.name}</li>)}</ul>}<small className="mt-1 block whitespace-pre-wrap text-[11px] leading-4 text-slate-500">{request.details || 'No additional details'}</small></td>
          <td className="px-4 py-3"><Badge className={requestStatusTone[requestStatus] || 'bg-slate-100 text-slate-600 ring-slate-200'}>{requestStatus}</Badge><small className="mt-1 block text-[10px] text-slate-400">{order.paymentMethod?.toUpperCase()}</small></td>
          <td className="px-4 py-3"><Badge className={refundStatusTone[order.refundStatus] || 'bg-slate-100 text-slate-600 ring-slate-200'}>{order.refundStatus || 'not required'}</Badge><b className="mt-1 block text-xs text-slate-800">{refundComplete ? formatMoney(refundAmount) : `${formatMoney(0)} completed`}</b>{!refundComplete && <small className="block text-[10px] text-slate-400">{formatMoney(refundAmount)} expected</small>}<small className="text-[10px] text-slate-400">{order.refundAttempts || 0} gateway attempts</small></td>
          <td className="px-4 py-3 text-xs text-slate-500">{formatDate(request.requestedAt || order.placedAt, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
          <td className="max-w-56 px-4 py-3 text-[11px] text-slate-500">{order.refundError || request.reviewNote || order.manualRefundReference || '—'}{order.refundNextAttemptAt && <small className="mt-1 block text-slate-400">Retry {formatDate(order.refundNextAttemptAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>}</td>
          <td className="px-5 py-3"><div className="flex justify-end gap-1.5">
            {request.status === 'requested' && can('refunds.approve') && <button disabled={busyId === order._id} onClick={() => onAction(order, 'approve')} className="h-8 rounded-lg bg-indigo-600 px-2.5 text-[10px] font-semibold text-white disabled:opacity-50">Approve</button>}
            {request.status === 'requested' && can('returns.reject') && <button disabled={busyId === order._id} onClick={() => onAction(order, 'reject')} className="h-8 rounded-lg border border-slate-200 px-2.5 text-[10px] font-semibold text-slate-700 disabled:opacity-50">Decline</button>}
            {request.status === 'approved' && order.paymentMethod === 'cod' && ['pending', 'failed'].includes(order.refundStatus) && can('refunds.record_manual') && <button disabled={busyId === order._id} onClick={() => onAction(order, 'mark_refunded')} className="h-8 rounded-lg bg-emerald-600 px-2.5 text-[10px] font-semibold text-white disabled:opacity-50">Record COD refund</button>}
            {request.status === 'approved' && order.paymentMethod === 'razorpay' && order.refundStatus === 'failed' && can('refunds.retry') && <button disabled={busyId === order._id} onClick={() => onAction(order, 'retry_refund')} className="h-8 rounded-lg border border-indigo-200 px-2.5 text-[10px] font-semibold text-indigo-700 disabled:opacity-50">Retry refund</button>}
          </div></td>
        </tr>
      })}</tbody></table></div> : <EmptyState icon={RotateCcw} title="No returns or refunds yet" detail="Customer return requests and cancellation-linked refunds will appear here."/>}
      <Pagination page={page} totalPages={pagination.totalPages} total={pagination.total} onPage={onPage}/>
    </section>
    <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><Clock3 size={15} className="mt-0.5 shrink-0"/>Gateway refunds are marked complete only after confirmation from Razorpay. COD refunds must be issued outside the gateway and recorded here with their reference.</p>
  </div>
}

export function ReportsView({ onExport }) {
  const today = new Date()
  const todayText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const monthStartText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const [startDate, setStartDate] = useState(monthStartText)
  const [endDate, setEndDate] = useState(todayText)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const exportReport = async (event) => {
    event.preventDefault()
    if (!startDate || !endDate || startDate > endDate) {
      setError('Choose a valid date range. The start date must not be after the end date.')
      return
    }
    setExporting(true)
    setError('')
    try {
      await onExport(startDate, endDate)
    } catch (exportError) {
      setError(exportError.response?.data?.message || exportError.message || 'Could not export the selected report.')
    } finally {
      setExporting(false)
    }
  }

  return <section className="max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-bold text-slate-900">Orders &amp; sales export</h2><p className="mt-1 text-xs leading-5 text-slate-500">Download a CSV for a chosen date range, including order subtotals, shipping, discounts, paid sales, and completed or in-progress refunds.</p></div>
    <form onSubmit={exportReport} className="grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="grid gap-1.5 text-xs font-semibold text-slate-700">From<input required type="date" value={startDate} max={endDate || todayText} onChange={(event) => setStartDate(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-normal"/></label>
      <label className="grid gap-1.5 text-xs font-semibold text-slate-700">To<input required type="date" value={endDate} min={startDate} max={todayText} onChange={(event) => setEndDate(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-normal"/></label>
      <button disabled={exporting} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-50"><Download size={14}/>{exporting ? 'Preparing…' : 'Download CSV'}</button>
    </form>
    {error && <p role="alert" className="mx-5 mb-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
    <div className="grid gap-3 border-t border-slate-100 bg-slate-50/70 p-5 sm:grid-cols-3"><div><b className="text-xs text-slate-800">Order-level detail</b><p className="mt-1 text-[11px] leading-4 text-slate-500">One row per order, with payment and fulfillment status.</p></div><div><b className="text-xs text-slate-800">Clear refund accounting</b><p className="mt-1 text-[11px] leading-4 text-slate-500">Completed refunds and amounts still in progress have separate columns.</p></div><div><b className="text-xs text-slate-800">Date-range totals</b><p className="mt-1 text-[11px] leading-4 text-slate-500">CSV summary includes subtotals, paid sales, and refunds.</p></div></div>
  </section>
}
export function InvoicesView({ orders, pagination, page, search, onSearch, onPage }) {
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><h2 className="text-sm font-bold text-slate-900">Invoice center</h2><p className="mt-1 text-xs text-slate-500">Find an order and print or save its detailed invoice as PDF.</p></div><label className="flex h-9 w-full items-center gap-2 rounded-lg border border-slate-200 px-3 text-slate-400 sm:max-w-xs"><Search size={15}/><input className="min-w-0 flex-1 text-xs text-slate-700 outline-none placeholder:text-slate-400" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search order or customer"/></label></div>
    {orders.length ? <div className="w-full overflow-x-auto"><table className="w-full min-w-[780px] border-collapse text-left"><thead><tr className="border-y border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-[.08em] text-slate-400"><th className="px-5 py-3">Order</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Total</th><th className="px-5 py-3 text-right">Invoice</th></tr></thead><tbody>{orders.map((order) => <tr key={order._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"><td className="px-5 py-3.5"><b className="text-xs text-slate-800">#{order.orderNumber || shortId(order._id)}</b><small className="mt-1 block text-[10px] text-slate-400">{order.items?.length || 0} line item{order.items?.length === 1 ? '' : 's'}</small></td><td className="px-4 py-3.5 text-xs text-slate-600">{order.shippingAddress?.fullName || 'Customer'}</td><td className="px-4 py-3.5 text-xs text-slate-500">{formatDate(order.placedAt || order.createdAt, { day: '2-digit', month: 'short', year: 'numeric' })}</td><td className="px-4 py-3.5"><Badge className={paymentTone[order.paymentStatus] || paymentTone.pending}>{order.paymentStatus || 'pending'}</Badge></td><td className="px-4 py-3.5 text-xs font-semibold text-slate-800">{formatMoney(order.totalAmount)}</td><td className="px-5 py-3.5 text-right"><span className="inline-flex"><InvoiceButton order={order}/></span></td></tr>)}</tbody></table></div> : <EmptyState icon={FileText} title={search ? 'No matching invoices' : 'No invoices yet'} detail={search ? 'Try another order number or customer name.' : 'Invoices become available when orders are placed.'}/>}
    <Pagination page={page} totalPages={pagination.totalPages} total={pagination.total} onPage={onPage}/>
  </section>
}

export function AdminActivityView({ entries = [] }) {
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-bold text-slate-900">Admin activity log</h2><p className="mt-1 text-xs text-slate-500">Recent order, return, customer, inventory, and sales target changes.</p></div>{entries.length ? <div className="divide-y divide-slate-100">{entries.map((entry) => <article key={entry._id} className="flex gap-3 px-5 py-4"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><Activity size={15}/></span><div className="min-w-0 flex-1"><p className="text-xs font-medium text-slate-800">{entry.summary}</p><p className="mt-1 text-[11px] text-slate-500">{entry.actor?.name || entry.actor?.email || 'Admin'} · {entry.entityType.replaceAll('_', ' ')}</p></div><time className="shrink-0 text-[10px] text-slate-400">{formatDate(entry.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></article>)}</div> : <EmptyState icon={Activity} title="No admin changes recorded" detail="Order status, returns, inventory, account status, and target changes will appear here."/>}</section>
}

export function OrderTable({ orders, busyId, onUpdate, onRefresh, compact = false, canUpdate = false, canCancel = false, canInvoice = false }) {
  if (!orders.length) return <EmptyState icon={ShoppingBag} title="No orders yet" detail="Customer orders will appear here once they start coming in." />
  return <div className="w-full max-w-full overflow-x-auto">
    <table className="w-full min-w-[900px] border-collapse text-left text-[11px]">
      <thead><tr className="border-y border-slate-100 bg-slate-50/70 text-[9px] font-bold uppercase tracking-[.07em] text-slate-400"><th className="whitespace-nowrap px-4 py-2.5">Order</th><th className="whitespace-nowrap px-3 py-2.5">Customer</th><th className="whitespace-nowrap px-3 py-2.5">Date</th><th className="whitespace-nowrap px-3 py-2.5">Total</th><th className="whitespace-nowrap px-3 py-2.5">Fulfilment</th><th className="whitespace-nowrap px-3 py-2.5">Payment</th><th className="whitespace-nowrap px-3 py-2.5 text-right">Actions</th></tr></thead>
      <tbody>{orders.map((order) => {
        const nextStatus = { confirmed: 'processing', processing: 'shipped', shipped: 'delivered' }[order.orderStatus]
        const customer = order.shippingAddress?.fullName || 'Customer'
        return <tr key={order._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
          <td className="max-w-36 px-4 py-3"><span className="block truncate font-semibold text-slate-800" title={`#${order.orderNumber || shortId(order._id)}`}>#{order.orderNumber || shortId(order._id)}</span><small className="mt-0.5 block text-[9px] text-slate-400">{order.items?.length || 0} item{order.items?.length === 1 ? '' : 's'}</small></td>
          <td className="max-w-44 px-3 py-3"><span className="flex min-w-0 items-center gap-2"><Avatar name={customer} size="sm" /><span className="min-w-0 truncate text-[11px] font-medium text-slate-700" title={customer}>{customer}</span></span></td>
          <td className="whitespace-nowrap px-3 py-3 text-[10px] text-slate-500">{formatDate(order.placedAt || order.createdAt, { day: '2-digit', month: 'short', year: '2-digit' })}</td>
          <td className="whitespace-nowrap px-3 py-3 text-[11px] font-semibold text-slate-800">{formatMoney(order.totalAmount)}</td>
          <td className="px-3 py-3"><Badge className={`px-2 py-0.5 text-[9px] ${orderTone[order.orderStatus] || orderTone.pending}`}><i className="size-1.5 rounded-full bg-current" />{order.orderStatus || 'pending'}</Badge></td>
          <td className="px-3 py-3"><Badge className={`px-2 py-0.5 text-[9px] ${paymentTone[order.paymentStatus] || paymentTone.pending}`}>{order.paymentStatus || 'pending'}</Badge></td>
          <td className="px-3 py-3"><div className="flex flex-wrap items-center justify-end gap-1.5"><OrderDetailsButton orderId={order._id} onRefresh={onRefresh} canCancel={canCancel}/>{canInvoice && <InvoiceButton order={order} />}{canUpdate && nextStatus ? <button disabled={busyId === order._id} onClick={() => onUpdate(order, nextStatus)} className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-700 hover:border-indigo-200 hover:text-indigo-700 disabled:cursor-wait disabled:opacity-50">{busyId === order._id ? <RefreshCw size={11} className="animate-spin" /> : null}{compact ? 'Update' : `Mark ${nextStatus}`}<ArrowRight size={11} /></button> : null}</div></td>
        </tr>
      })}</tbody>
    </table>
  </div>
}
export function CustomersView({ customers, pagination, page, search, adminId, busyId, onSearch, onPage, onUpdate, canDeactivate = false }) {
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[.02]"><div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><h2 className="text-sm font-bold text-slate-900">Customer directory</h2><p className="mt-1 text-xs text-slate-500">Search and manage registered accounts</p></div><label className="flex h-9 w-full items-center gap-2 rounded-lg border border-slate-200 px-3 text-slate-400 sm:max-w-xs"><Search size={15} /><input className="min-w-0 flex-1 text-xs text-slate-700 outline-none placeholder:text-slate-400" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search name or email" /></label></div>{customers.length ? <CustomerTable customers={customers} busyId={busyId} adminId={adminId} onUpdate={onUpdate} canDeactivate={canDeactivate} /> : <EmptyState icon={Users} title={search ? 'No matching customers' : 'No customers yet'} detail={search ? 'Try another name or email address.' : 'New customer accounts will appear here.'} />}<Pagination page={page} totalPages={pagination.totalPages} total={pagination.total} onPage={onPage} /></section>
}

export function CustomerTable({ customers, busyId, adminId, onUpdate, canDeactivate = false }) {
  if (!customers.length) return <EmptyState icon={Users} title="No customers yet" detail="New customer accounts will appear here." />
  return <div className="w-full overflow-x-auto"><table className="w-full min-w-[790px] border-collapse text-left"><thead><tr className="border-y border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-[.08em] text-slate-400"><th className="px-5 py-3">Customer</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Verification</th><th className="px-4 py-3">Account status</th><th className="px-4 py-3">Role</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"><td className="px-5 py-3"><span className="flex items-center gap-3"><Avatar name={customer.name} size="sm" /><span className="min-w-0"><b className="block max-w-52 truncate text-xs font-semibold text-slate-800">{customer.name}</b><small className="mt-1 block max-w-52 truncate text-[11px] text-slate-500">{customer.email}</small></span></span></td><td className="px-4 py-3 text-xs text-slate-500">{formatDate(customer.createdAt)}</td><td className="px-4 py-3">{customer.isVerified ? <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200"><Check size={12} />Verified</Badge> : <Badge className="bg-slate-100 text-slate-600 ring-slate-200">Unverified</Badge>}</td><td className="px-4 py-3"><Badge className={customer.isActive ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}><i className="size-1.5 rounded-full bg-current" />{customer.isActive ? 'Active' : 'Inactive'}</Badge></td><td className="px-4 py-3"><Badge className="bg-slate-100 text-slate-600 ring-slate-200">{customer.role}</Badge></td><td className="px-4 py-3 text-right">{canDeactivate && (customer._id === adminId ? <span className="text-xs text-slate-400">You</span> : <button disabled={busyId === customer._id} onClick={() => onUpdate(customer)} className={`h-8 rounded-lg border px-2.5 text-[11px] font-semibold disabled:opacity-50 ${customer.isActive ? 'border-rose-200 text-rose-700 hover:bg-rose-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>{busyId === customer._id ? 'Updating…' : customer.isActive ? 'Deactivate' : 'Activate'}</button>)}</td></tr>)}</tbody></table></div>
}

export function CatalogInsights({ catalog, categoryForm, onCategoryForm, onCreateCategory, canManage = false }) {
  const metrics = [
    ['Products', catalog.total || 0, Layers3], ['Live products', catalog.active || 0, Package],
    ['Units in stock', catalog.stockUnits || 0, Box], ['Inventory value', formatMoney(catalog.inventoryValue), ShoppingCart],
  ]
  return <div className="grid gap-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, Icon]) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-xs font-medium text-slate-500"><span>{label}</span><Icon size={16} className="text-indigo-600" /></div><b className="mt-3 block text-2xl text-slate-900">{value}</b></article>)}</div>
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-bold text-slate-900">Category performance</h2><p className="mt-1 text-xs text-slate-500">Product count, available units, and stock value by category</p></div>{catalog.byCategory?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left"><thead><tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-400"><th className="px-5 py-3">Category</th><th className="px-4 py-3">Products</th><th className="px-4 py-3">Units</th><th className="px-4 py-3 text-right">Stock value</th></tr></thead><tbody>{catalog.byCategory.map((item) => <tr key={item._id} className="border-t border-slate-100"><td className="px-5 py-3 text-xs font-semibold text-slate-800">{item.name || 'Uncategorized'}</td><td className="px-4 py-3 text-xs text-slate-600">{item.products}</td><td className="px-4 py-3 text-xs text-slate-600">{item.units}</td><td className="px-4 py-3 text-right text-xs text-slate-600">{formatMoney(item.value)}</td></tr>)}</tbody></table></div> : <EmptyState icon={Layers3} title="No catalog data yet" detail="Add products to see category performance here." />}</section>
      {canManage && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-bold text-slate-900">Create category</h2><p className="mt-1 text-xs text-slate-500">New categories are immediately available in the catalog.</p><form className="mt-4 grid gap-3" onSubmit={onCreateCategory}><label className="text-xs font-semibold text-slate-700">Name<input required maxLength={100} value={categoryForm.name} onChange={(event) => { const name = event.target.value; onCategoryForm((current) => ({ ...current, name, slug: name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })) }} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-indigo-400" /></label><label className="text-xs font-semibold text-slate-700">Slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={categoryForm.slug} onChange={(event) => onCategoryForm((current) => ({ ...current, slug: event.target.value.toLowerCase() }))} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-indigo-400" /></label><label className="text-xs font-semibold text-slate-700">Description<textarea rows="3" value={categoryForm.description} onChange={(event) => onCategoryForm((current) => ({ ...current, description: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none focus:border-indigo-400" /></label><button className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700"><Plus size={14} />Create category</button></form></section>}
    </div>
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-bold text-slate-900">Inventory watch</h2><p className="mt-1 text-xs text-slate-500">{catalog.lowStock || 0} products are at or below their configured low stock threshold; {catalog.outOfStock || 0} are out of stock.</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-400" style={{ width: `${catalog.total ? Math.min(100, (catalog.lowStock / catalog.total) * 100) : 0}%` }} /></div></section>
  </div>
}

export function InventoryView({ inventory, status, search, busyId, onStatus, onSearch, onPage, onUpdate, canAdjust = false }) {
  const exportCurrentPage = () => {
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const rows = [['name', 'sku', 'category', 'stock', 'lowStockThreshold', 'price', 'status'], ...inventory.items.map((item) => [item.name, item.sku, item.category?.name, item.stock, item.lowStockThreshold ?? 5, item.price, item.stock === 0 ? 'out_of_stock' : item.stock <= (item.lowStockThreshold ?? 5) ? 'low_stock' : 'in_stock'])]
    const blob = new Blob([rows.map((row) => row.map(escape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = 'inventory.csv'; link.click(); URL.revokeObjectURL(url)
  }
  const statuses = [['all', 'All stock'], ['in_stock', 'In stock'], ['low_stock', 'Low stock'], ['out_of_stock', 'Out of stock']]
  return <div className="grid gap-4">
    <div className="grid gap-3 sm:grid-cols-3">{[['In stock', inventory.items.filter((item) => item.stock > (item.lowStockThreshold ?? 5)).length, 'text-emerald-700'], ['Low stock', inventory.items.filter((item) => item.stock > 0 && item.stock <= (item.lowStockThreshold ?? 5)).length, 'text-amber-700'], ['Out of stock', inventory.items.filter((item) => item.stock === 0).length, 'text-rose-700']].map(([label, value, tone]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><span className="text-xs text-slate-500">{label} on this page</span><b className={`mt-1 block text-2xl ${tone}`}>{value}</b></div>)}</div>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center"><label className="flex h-9 min-w-48 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 text-slate-400"><Search size={15} /><input className="min-w-0 flex-1 text-xs text-slate-700 outline-none" placeholder="Search product or SKU" value={search} onChange={(event) => onSearch(event.target.value)} /></label><label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-slate-500"><SlidersHorizontal size={14} /><select aria-label="Filter inventory" className="bg-transparent text-xs outline-none" value={status} onChange={(event) => onStatus(event.target.value)}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button onClick={exportCurrentPage} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Export current page</button></div>
      {inventory.items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left"><thead><tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-400"><th className="px-5 py-3">Product</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Available</th><th className="px-4 py-3">Stock state</th>{canAdjust && <><th className="px-4 py-3">Adjust stock</th><th className="px-4 py-3">Low stock at</th><th className="px-4 py-3">Action</th></>}</tr></thead><tbody>{inventory.items.map((item) => <InventoryRow key={item._id} item={item} busy={busyId === item._id} onUpdate={onUpdate} canAdjust={canAdjust} />)}</tbody></table></div> : <EmptyState icon={Box} title="No matching inventory" detail="Try a different search or stock status." />}
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500"><span>{inventory.total} products</span><div className="flex items-center gap-3"><button disabled={inventory.page <= 1} onClick={() => onPage(inventory.page - 1)} className="font-semibold disabled:opacity-40">Previous</button><span>Page {inventory.page} of {Math.max(inventory.totalPages, 1)}</span><button disabled={inventory.page >= inventory.totalPages} onClick={() => onPage(inventory.page + 1)} className="font-semibold disabled:opacity-40">Next</button></div></div>
    </section>
  </div>
}

export function InventoryRow({ item, busy, onUpdate, canAdjust = false }) {
  const [adjustment, setAdjustment] = useState('')
  const [threshold, setThreshold] = useState(item.lowStockThreshold ?? 5)
  const originalThreshold = item.lowStockThreshold ?? 5
  const low = item.stock > 0 && item.stock <= (item.lowStockThreshold ?? 5)
  const state = item.stock === 0 ? 'Out of stock' : low ? 'Low stock' : 'In stock'
  const tone = item.stock === 0 ? 'bg-rose-50 text-rose-700 ring-rose-200' : low ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  const save = () => { const delta = adjustment === '' ? 0 : Number(adjustment); if (!Number.isSafeInteger(delta) || (delta === 0 && Number(threshold) === originalThreshold)) return; onUpdate(item, delta, Number(threshold)); setAdjustment('') }
  return <tr className="border-t border-slate-100"><td className="px-5 py-3"><b className="block text-xs text-slate-800">{item.name}</b><small className="text-[11px] text-slate-500">{item.sku}</small></td><td className="px-4 py-3 text-xs text-slate-600">{item.category?.name || '—'}</td><td className="px-4 py-3 text-sm font-bold text-slate-800">{item.stock}</td><td className="px-4 py-3"><Badge className={tone}>{state}</Badge></td>{canAdjust && <><td className="px-4 py-3"><input aria-label={`Stock adjustment for ${item.name}`} type="number" step="1" value={adjustment} onChange={(event) => setAdjustment(event.target.value)} placeholder="+/- units" className="h-8 w-24 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-indigo-400" /></td><td className="px-4 py-3"><input aria-label={`Low stock threshold for ${item.name}`} type="number" min="0" step="1" value={threshold} onChange={(event) => setThreshold(event.target.value)} className="h-8 w-20 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-indigo-400" /></td><td className="px-4 py-3"><button disabled={busy || (!adjustment && Number(threshold) === originalThreshold) || (adjustment !== '' && (!Number.isSafeInteger(Number(adjustment)) || Number(adjustment) === 0)) || !Number.isSafeInteger(Number(threshold)) || Number(threshold) < 0} onClick={save} className="h-8 rounded-lg bg-indigo-600 px-3 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-40">{busy ? 'Saving…' : 'Apply'}</button></td></>}</tr>
}
