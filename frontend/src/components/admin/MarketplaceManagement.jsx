import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, Store } from "lucide-react";
import api from "../../api/axios.js";
import { formatMoney } from "./adminUtils.js";

export default function MarketplaceManagement({ section, canManage, canSettle, onNotice }) {
  const [vendors, setVendors] = useState([]);
  const [defaultCommission, setDefaultCommission] = useState("10");
  const [available, setAvailable] = useState([]);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState([]);
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const requests = [];
      if (section === "vendors" && canManage) {
        requests.push(api.get("/admin/marketplace/vendors"));
        requests.push(api.get("/admin/marketplace/settings"));
      }
      if (section === "payouts" && canSettle) requests.push(api.get("/admin/marketplace/settlements"));
      const responses = await Promise.all(requests);
      let index = 0;
      if (section === "vendors" && canManage) {
        setVendors(responses[index++].data?.data || []);
        const settings = responses[index++].data?.data;
        if (settings?.marketplaceCommissionRate !== undefined) {
          setDefaultCommission(String(settings.marketplaceCommissionRate));
        }
      }
      if (section === "payouts" && canSettle) {
        const data = responses[index].data?.data || {};
        setAvailable(data.available || []);
        setHistory(data.history || []);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not load marketplace management data.");
    } finally {
      setLoading(false);
    }
  }, [section, canManage, canSettle]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selectedRows = useMemo(() => available.filter((row) => selected.includes(row.vendorOrderId)), [available, selected]);
  const selectedVendorId = selectedRows[0]?.vendorId;
  const eligibleSelection = selectedRows.filter((row) => row.vendorId === selectedVendorId);
  const settlementTotal = eligibleSelection.reduce((sum, row) => sum + row.payableAmount, 0);

  const performVendorAction = async (vendor, action, extra = {}) => {
    setBusy(vendor._id);
    setError("");
    try {
      await api.patch(`/admin/marketplace/vendors/${vendor._id}`, { action, ...extra });
      onNotice(`Vendor ${action} completed.`);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Could not ${action} vendor.`);
    } finally {
      setBusy("");
    }
  };

  const setupPlatformStore = async () => {
    setBusy("platform");
    setError("");
    try {
      const response = await api.post("/admin/marketplace/platform-store");
      const count = response.data?.data?.migratedCount ?? 0;
      onNotice(`Platform store is ready. ${count} existing product${count === 1 ? "" : "s"} assigned.`);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not set up the platform store.");
    } finally {
      setBusy("");
    }
  };

  const saveDefaultCommission = async (event) => {
    event.preventDefault();
    const commissionRate = Number(defaultCommission);
    setBusy("commission");
    setError("");
    try {
      await api.patch("/admin/marketplace/settings/commission", { commissionRate });
      onNotice("Default commission updated. Existing orders keep their original rate.");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not update default commission.");
    } finally {
      setBusy("");
    }
  };

  const recordSettlement = async (event) => {
    event.preventDefault();
    if (!selectedVendorId || !eligibleSelection.length) return;
    if (!window.confirm("Confirm that this bank payout has already been completed. This action records it as paid and cannot be reversed here.")) return;
    setBusy("settlement");
    setError("");
    try {
      await api.post("/admin/marketplace/settlements", {
        vendorId: selectedVendorId,
        vendorOrders: eligibleSelection.map(({ orderId, vendorOrderId }) => ({ orderId, vendorOrderId })),
        reference,
      });
      setSelected([]);
      setReference("");
      onNotice(`Recorded payout of ${formatMoney(settlementTotal)}.`);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not record the payout.");
    } finally {
      setBusy("");
    }
  };

  if (loading) return <div className="flex min-h-56 items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500"><RefreshCw size={16} className="animate-spin text-indigo-600" /> Loading marketplace…</div>;

  return (
    <div className="grid gap-6">
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {section === "vendors" && canManage && (
        <>
          <section className="grid gap-4 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="flex items-start gap-3"><Store size={20} className="mt-1 shrink-0 text-indigo-700" /><div><h3 className="font-bold text-slate-950">Platform-owned products</h3><p className="mt-1 text-sm leading-6 text-slate-600">Create the platform store and assign existing products that do not yet have a seller. This action is safe to repeat.</p></div></div>
            <button disabled={busy === "platform"} onClick={setupPlatformStore} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === "platform" ? "Setting up…" : "Set up / migrate products"}</button>
          </section>
          <form onSubmit={saveDefaultCommission} className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div><h3 className="font-bold text-slate-950">Default platform commission</h3><p className="mt-1 text-sm text-slate-500">Applies to new orders unless a vendor has a custom rate. Rates are snapshotted at checkout.</p></div>
            <div className="flex items-end gap-2"><label className="grid gap-1 text-xs font-semibold text-slate-600">Commission %<input type="number" min="0" max="100" step="0.01" required value={defaultCommission} onChange={(event) => setDefaultCommission(event.target.value)} className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label><button disabled={busy === "commission"} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{busy === "commission" ? "Saving…" : "Save rate"}</button></div>
          </form>
          <section className="grid gap-3">
            <div><h3 className="text-lg font-bold text-slate-950">Vendor applications and stores</h3><p className="mt-1 text-sm text-slate-500">Approve sellers before they can publish products or access customer orders.</p></div>
            {!vendors.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-7 text-sm text-slate-500">No vendor applications or stores yet.</div> : vendors.map((vendor) => (
              <article key={vendor._id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><div className="flex flex-wrap items-center gap-2"><h4 className="font-bold text-slate-950">{vendor.storeName}</h4><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${vendor.status === "approved" ? "bg-emerald-50 text-emerald-700" : vendor.status === "pending" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{vendor.status}</span></div><p className="mt-1 text-sm text-slate-500">{vendor.owner?.name} · {vendor.owner?.email} · {vendor.productCount} products</p><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{vendor.applicationNote || vendor.description || "No application note supplied."}</p><p className="mt-1 text-xs text-slate-500">Business contact: {vendor.contactEmail}{vendor.phone ? ` · ${vendor.phone}` : ""}</p></div>
                  <div className="flex flex-wrap gap-2">
                    {vendor.status === "pending" && <><button disabled={busy === vendor._id} onClick={() => performVendorAction(vendor, "approve")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve</button><button disabled={busy === vendor._id} onClick={() => performVendorAction(vendor, "reject")} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50">Reject</button></>}
                    {vendor.status === "approved" && <button disabled={busy === vendor._id} onClick={() => performVendorAction(vendor, "suspend")} className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50">Suspend</button>}
                    {vendor.status === "suspended" && <button disabled={busy === vendor._id} onClick={() => performVendorAction(vendor, "reinstate")} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-50">Reinstate</button>}
                  </div>
                </div>
                {vendor.status === "approved" && <form onSubmit={(event) => { event.preventDefault(); const rate = event.currentTarget.elements.commission.value; performVendorAction(vendor, "commission", { commissionRate: rate === "" ? null : Number(rate) }); }} className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4"><label className="grid gap-1 text-xs font-semibold text-slate-600">Vendor commission % (blank uses default)<input name="commission" type="number" min="0" max="100" step="0.01" defaultValue={vendor.commissionRate ?? ""} className="w-52 rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label><button disabled={busy === vendor._id} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">Save rate</button></form>}
              </article>
            ))}
          </section>
        </>
      )}
      {section === "payouts" && canSettle && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div><h3 className="text-lg font-bold text-slate-950">Manual vendor payouts</h3><p className="mt-1 text-sm leading-6 text-slate-500">Orders become eligible after the 30-day return window closes, no return is open, and payment is confirmed. Record a real transfer reference; this does not initiate a bank payment.</p></div>
            {available.length ? <form onSubmit={recordSettlement} className="mt-4 grid gap-4">
              <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="pb-2">Select</th><th className="pb-2">Vendor</th><th className="pb-2">Order</th><th className="pb-2">Delivered order items</th><th className="pb-2 text-right">Payable</th></tr></thead><tbody>{available.map((row) => <tr key={row.vendorOrderId} className="border-t border-slate-100"><td className="py-3"><input aria-label={`Select ${row.orderNumber}`} type="checkbox" checked={selected.includes(row.vendorOrderId)} disabled={selectedVendorId && selectedVendorId !== row.vendorId} onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.vendorOrderId] : current.filter((id) => id !== row.vendorOrderId))} /></td><td className="py-3">{row.storeName}</td><td className="py-3">{row.orderNumber}</td><td className="py-3">{row.items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}</td><td className="py-3 text-right font-semibold">{formatMoney(row.payableAmount)}</td></tr>)}</tbody></table></div>
              {eligibleSelection.length > 0 && <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"><label className="grid gap-1 text-xs font-semibold text-slate-600">Payout / bank reference<input required minLength={3} maxLength={200} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="e.g. bank transfer reference" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label><p className="text-sm font-bold text-slate-900">{eligibleSelection.length} orders · {formatMoney(settlementTotal)}</p><button disabled={busy === "settlement"} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Check size={15} />{busy === "settlement" ? "Recording…" : "Record completed payout"}</button></div>}
            </form> : <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No delivered, paid orders are awaiting settlement.</p>}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-bold text-slate-950">Recent payout records</h3>{!history.length ? <p className="mt-3 text-sm text-slate-500">No payouts recorded yet.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="pb-2">Paid</th><th className="pb-2">Vendor</th><th className="pb-2">Reference</th><th className="pb-2 text-right">Amount</th></tr></thead><tbody>{history.map((entry) => <tr key={entry._id} className="border-t border-slate-100"><td className="py-3">{new Date(entry.paidAt).toLocaleDateString()}</td><td className="py-3">{entry.vendor?.storeName}</td><td className="py-3">{entry.reference}</td><td className="py-3 text-right font-semibold">{formatMoney(entry.totalAmount)}</td></tr>)}</tbody></table></div>}</section>
        </>
      )}
      <button onClick={load} className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-700"><RefreshCw size={14} /> Refresh marketplace data</button>
    </div>
  );
}
