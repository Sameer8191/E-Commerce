import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Check, Package, RefreshCw, Store } from "lucide-react";
import api from "../../api/axios.js";
import ProductManagement from "../../components/admin/ProductManagement.jsx";
import { formatMoney } from "../../components/admin/adminUtils.js";
import "./VendorPortalPage.css";

const today = new Date().toISOString().slice(0, 10);
const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

const statusLabel = (status) => status.replaceAll("_", " ");

function ApplicationForm({ application, onSubmitted }) {
  const [form, setForm] = useState({
    storeName: application?.storeName || "",
    description: application?.description || "",
    contactEmail: application?.contactEmail || "",
    phone: application?.phone || "",
    applicationNote: application?.applicationNote || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await api.post("/vendors/application", form);
      onSubmitted(response.data?.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not submit the application.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-2xl gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Sell on Goodthings</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">Apply to open your store</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Applications are reviewed by the marketplace team. Your store and products become visible after approval.</p>
      </div>
      {application?.status && (
        <div role="status" className={`rounded-xl border p-4 text-sm ${application.status === "rejected" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          <strong className="capitalize">{statusLabel(application.status)}</strong>
          {application.status === "pending" && <span> — Your application is awaiting review.</span>}
          {application.status === "rejected" && <span> — Update your details and submit again.</span>}
        </div>
      )}
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">Store name
          <input required minLength={2} maxLength={100} value={form.storeName} onChange={(event) => update("storeName", event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5" />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">Business contact email
          <input required type="email" value={form.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5" />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">Phone (optional)
          <input maxLength={30} value={form.phone} onChange={(event) => update("phone", event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5" />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">Store description
          <textarea maxLength={1000} rows={3} value={form.description} onChange={(event) => update("description", event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5" />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">Tell us about your business
          <textarea maxLength={1000} rows={4} value={form.applicationNote} onChange={(event) => update("applicationNote", event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5" />
        </label>
      </div>
      <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
        {saving ? "Submitting…" : application?.status === "rejected" ? "Resubmit application" : "Submit for review"} <ArrowRight size={16} />
      </button>
    </form>
  );
}

function Metric({ label, value, note }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>{note && <p className="mt-1 text-xs text-slate-500">{note}</p>}</div>;
}

export default function VendorPortalPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [application, setApplication] = useState(null);
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [report, setReport] = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [startDate, setStartDate] = useState(monthAgo);
  const [endDate, setEndDate] = useState(today);
  const [profileForm, setProfileForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [trackingOrderId, setTrackingOrderId] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");

  const loadVendorData = useCallback(async () => {
    const [storeResponse, productsResponse, ordersResponse, reportResponse, settlementsResponse] = await Promise.all([
      api.get("/vendors/me"),
      api.get("/vendors/me/products"),
      api.get("/vendors/me/orders"),
      api.get("/vendors/me/reports", { params: { startDate, endDate } }),
      api.get("/vendors/me/settlements"),
    ]);
    const nextStore = storeResponse.data?.data;
    setStore(nextStore);
    setProfileForm({
      storeName: nextStore.storeName,
      description: nextStore.description || "",
      contactEmail: nextStore.contactEmail,
      phone: nextStore.phone || "",
    });
    setProducts(productsResponse.data?.data || []);
    setOrders(ordersResponse.data?.data || []);
    setReport(reportResponse.data?.data || null);
    setSettlements(settlementsResponse.data?.data || []);
  }, [startDate, endDate]);

  const refresh = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const profile = await api.get("/users/me");
      const currentUser = profile.data?.user;
      setUser(currentUser);
      if (currentUser?.role === "vendor") {
        await loadVendorData();
      } else {
        const applicationResponse = await api.get("/vendors/application");
        setApplication(applicationResponse.data?.data || null);
      }
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        navigate("/vendor/login", { replace: true });
      } else {
        setError(requestError.response?.data?.message || "Could not load your seller account.");
      }
    } finally {
      setLoading(false);
    }
  }, [loadVendorData, navigate]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const updateFulfillment = async (order, status, tracking = {}) => {
    setBusyId(order._id);
    setError("");
    try {
      await api.patch(`/vendors/me/orders/${order._id}/fulfillment`, { status, ...tracking });
      setNotice(`Order ${order.orderNumber} marked ${status}.`);
      setTrackingOrderId("");
      setTrackingNumber("");
      setTrackingUrl("");
      await loadVendorData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not update fulfillment.");
    } finally {
      setBusyId("");
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setBusyId("profile");
    setError("");
    try {
      const response = await api.patch("/vendors/me", profileForm);
      setStore(response.data?.data);
      setNotice("Store profile saved.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not update store profile.");
    } finally {
      setBusyId("");
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center gap-3 text-sm text-slate-600"><RefreshCw size={18} className="animate-spin text-indigo-600" /> Loading seller portal…</div>;
  }
  if (!user) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><Store className="mx-auto text-indigo-600" size={34} /><h1 className="mt-4 text-2xl font-bold">Seller portal</h1><p className="mt-2 text-sm text-slate-600">Sign in to apply or manage your store.</p><Link to="/vendor/login" className="mt-5 inline-flex rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white">Seller sign in</Link><p className="mt-4 text-sm text-slate-500">New to selling? <Link to="/vendor/signup" className="font-semibold text-indigo-700 hover:underline">Create a seller account</Link></p></div></main>;
  }

  if (user.role !== "vendor") {
    return <main className="vendor-application min-h-screen bg-slate-50 px-4 py-10 sm:px-6"><div className="mx-auto mb-6 flex max-w-2xl justify-between"><Link to="/" className="font-semibold text-slate-700">← Back to store</Link><span className="text-sm text-slate-500">{user.name}</span></div><ApplicationForm application={application} onSubmitted={(next) => { setApplication(next); setNotice("Your application was submitted for review."); }} />{notice && <p role="status" className="mx-auto mt-4 max-w-2xl rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}{error && <p role="alert" className="mx-auto mt-4 max-w-2xl rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}</main>;
  }

  const nextStatus = { confirmed: "processing", processing: "shipped", shipped: "delivered" };
  return (
    <main className="vendor-workspace min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Seller studio <span className="vendor-live-dot" /></p><h1 className="mt-1 text-xl font-bold text-slate-950">{store?.storeName}</h1></div>
          <div className="flex items-center gap-4 text-sm"><Link to="/" className="font-medium text-slate-600 hover:text-indigo-700">View storefront ↗</Link><button onClick={refresh} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-700"><RefreshCw size={15} /> Refresh</button></div>
        </div>
        <nav className="vendor-section-nav" aria-label="Seller workspace sections"><a href="#overview">Overview</a><a href="#analytics">Analytics</a><a href="#orders">Orders</a><a href="#products">Products</a><a href="#profile">Store profile</a><a href="#settlements">Payouts</a></nav>
      </header>
      <div className="mx-auto grid max-w-7xl gap-7 px-4 py-7 sm:px-6">
        {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle size={17} className="mt-0.5 shrink-0" />{error}</p>}
        {notice && <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><Check size={16} />{notice}</p>}
        <section id="overview" className="vendor-section">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-lg font-bold text-slate-950">Sales overview</h2><p className="mt-1 text-sm text-slate-500">Sales shown in INR. Commission is snapshotted when each order is placed.</p></div><div className="flex items-end gap-2"><label className="grid gap-1 text-xs font-semibold text-slate-600">From<input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" /></label><label className="grid gap-1 text-xs font-semibold text-slate-600">To<input type="date" value={endDate} min={startDate} max={today} onChange={(event) => setEndDate(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" /></label></div></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Orders" value={report?.orders ?? 0} />
            <Metric label="Paid sales" value={formatMoney(report?.paidSales ?? 0)} />
            <Metric label="Gross sales" value={formatMoney(report?.grossSales ?? 0)} />
            <Metric label="Platform commission" value={formatMoney(report?.commission ?? 0)} note="Rate fixed per order" />
            <Metric label="Pending settlement" value={formatMoney(report?.pendingSettlement ?? 0)} note="Paid after delivery and payment confirmation" />
          </div>
        </section>

        <section id="analytics" className="vendor-section vendor-analytics">
          <div className="vendor-analytics-heading"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-indigo-600">PERFORMANCE</p><h2 className="mt-1 text-lg font-bold text-slate-950">Sales analytics</h2><p className="mt-1 text-sm text-slate-500">Daily paid sales for the last 14 days in your selected date range.</p></div><div className="vendor-analytics-total"><span>Average order value</span><b>{formatMoney(report?.orders ? report.paidSales / report.orders : 0)}</b></div></div>
          {report?.salesTrend?.some((point) => Number(point.sales) > 0) ? <div className="vendor-chart" role="img" aria-label="Daily paid sales chart for the last 14 days"><div className="vendor-chart-axis"><span>{formatMoney(Math.max(...report.salesTrend.map((point) => Number(point.sales) || 0)))}</span><span>{formatMoney(0)}</span></div><div className="vendor-chart-bars">{report.salesTrend.map((point) => { const sales = Number(point.sales) || 0; const maxSales = Math.max(1, ...report.salesTrend.map((entry) => Number(entry.sales) || 0)); const height = sales ? Math.max(5, sales / maxSales * 100) : 2; const dateLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${point.date}T00:00:00Z`)); return <div className="vendor-chart-column" key={point.date} title={`${dateLabel}: ${formatMoney(sales)} · ${point.orders} ${point.orders === 1 ? "order" : "orders"}`}><div className="vendor-chart-bar-area"><span className="vendor-chart-bar" style={{ height: `${height}%` }} /></div><small>{dateLabel}</small></div>})}</div></div> : <div className="vendor-chart-empty">No paid sales in this date range yet. Your daily trend will appear here when orders come in.</div>}
          <div className="vendor-analytics-foot"><span><i /> Paid sales</span><span>{report?.orders ?? 0} orders in this range</span></div>
        </section>

        <section id="orders" className="grid gap-4 vendor-section">
          <div><h2 className="text-lg font-bold text-slate-950">Your orders</h2><p className="mt-1 text-sm text-slate-500">You only see the products and fulfillment details assigned to your store. Returns are view-only.</p></div>
          {!orders.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No marketplace orders in this store yet.</div> : (
            <div className="grid gap-4">
              {orders.map((order) => (
                <article key={order._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-bold text-slate-950">{order.orderNumber}</p><p className="mt-1 text-xs text-slate-500">{new Date(order.placedAt).toLocaleString()} · {order.paymentMethod} · payment {order.paymentStatus}</p></div>
                    <div className="text-right"><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold capitalize text-indigo-700">{statusLabel(order.fulfillmentStatus)}</span><p className="mt-2 text-sm font-bold">{formatMoney(order.payableAmount)} payable</p></div>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    {order.items.map((item) => <p key={item.product}>{item.quantity} × {item.name} — {formatMoney(item.price * item.quantity)}</p>)}
                  </div>
                  <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600"><strong>Ship to:</strong> {order.shippingAddress?.fullName}, {order.shippingAddress?.addressLine1}, {order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.postalCode}, {order.shippingAddress?.phone}</div>
                  {order.returnRequest && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Return request: {statusLabel(order.returnRequest.status)}{order.returnRequest.reason ? ` · ${statusLabel(order.returnRequest.reason)}` : ""}. Refund decisions are managed by the platform.</p>}
                  {order.trackingNumber && <p className="mt-3 text-xs text-slate-600">Tracking number: <strong>{order.trackingNumber}</strong>{order.trackingUrl && <> · <a className="font-semibold text-indigo-700 underline" href={order.trackingUrl} target="_blank" rel="noreferrer">Track shipment</a></>}</p>}
                  {nextStatus[order.fulfillmentStatus] && nextStatus[order.fulfillmentStatus] === "shipped" && trackingOrderId === order._id ? <form className="mt-4 grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); updateFulfillment(order, "shipped", { trackingNumber, trackingUrl }); }}>
                    <label className="grid gap-1 text-xs font-semibold text-slate-600">Tracking number (optional)<input maxLength={120} value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                    <label className="grid gap-1 text-xs font-semibold text-slate-600">Tracking link (optional)<input type="url" maxLength={500} placeholder="https://" value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                    <div className="flex gap-2 sm:col-span-2"><button type="submit" disabled={busyId === order._id} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{busyId === order._id ? "Saving…" : "Confirm shipment"}</button><button type="button" onClick={() => setTrackingOrderId("")} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700">Cancel</button></div>
                  </form> : nextStatus[order.fulfillmentStatus] && <button disabled={busyId === order._id || (order.paymentMethod !== "cod" && order.paymentStatus !== "paid")} onClick={() => nextStatus[order.fulfillmentStatus] === "shipped" ? setTrackingOrderId(order._id) : updateFulfillment(order, nextStatus[order.fulfillmentStatus])} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold capitalize text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{busyId === order._id ? "Saving…" : `Mark ${nextStatus[order.fulfillmentStatus]}`}</button>}
                  <p className="mt-3 text-xs text-slate-500">Settlement: {statusLabel(order.settlementStatus)} · commission {order.commissionRate}% ({formatMoney(order.commissionAmount)})</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section id="profile" className="vendor-section rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold text-slate-950">Store profile</h2>
          <form onSubmit={saveProfile} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold text-slate-600">Store name<input required value={profileForm?.storeName || ""} onChange={(event) => setProfileForm((value) => ({ ...value, storeName: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">Contact email<input required type="email" value={profileForm?.contactEmail || ""} onChange={(event) => setProfileForm((value) => ({ ...value, contactEmail: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">Phone<input value={profileForm?.phone || ""} onChange={(event) => setProfileForm((value) => ({ ...value, phone: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600 sm:col-span-2">Description<textarea rows={3} value={profileForm?.description || ""} onChange={(event) => setProfileForm((value) => ({ ...value, description: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <button disabled={busyId === "profile"} className="w-fit rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{busyId === "profile" ? "Saving…" : "Save profile"}</button>
          </form>
        </section>

        <section id="products" className="grid gap-4 vendor-section">
          <div><div className="flex items-center gap-2"><Package size={18} className="text-indigo-600" /><h2 className="text-lg font-bold text-slate-950">Products and inventory</h2></div><p className="mt-1 text-sm text-slate-500">Create products and manage your store inventory.</p></div>
          <ProductManagement
            catalog={{ recentProducts: products }}
            isVendor
            onNotice={setNotice}
            onRefresh={loadVendorData}
          />
        </section>

        <section id="settlements" className="vendor-section rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold text-slate-950">Settlement history</h2>
          {!settlements.length ? <p className="mt-3 text-sm text-slate-500">No manual payouts recorded yet.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="pb-2">Paid</th><th className="pb-2">Reference</th><th className="pb-2">Orders</th><th className="pb-2 text-right">Amount</th></tr></thead><tbody>{settlements.map((settlement) => <tr key={settlement._id} className="border-t border-slate-100"><td className="py-3">{new Date(settlement.paidAt).toLocaleDateString()}</td><td className="py-3">{settlement.reference}</td><td className="py-3">{settlement.orders.length}</td><td className="py-3 text-right font-semibold">{formatMoney(settlement.totalAmount)}</td></tr>)}</tbody></table></div>}
        </section>
      </div>
    </main>
  );
}
