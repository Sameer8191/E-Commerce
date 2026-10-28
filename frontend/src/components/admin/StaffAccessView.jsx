import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Users } from "lucide-react";
import api from "../../api/axios.js";
import { Avatar, Badge, EmptyState } from "./AdminComponents.jsx";
import { formatDate } from "./adminUtils.js";

const roleLabels = {
  admin: "Owner / full admin",
  support: "Customer support",
  fulfillment: "Fulfillment",
  inventory_manager: "Inventory manager",
  finance_manager: "Finance manager",
  customer: "Customer",
};
const roleSummaries = {
  admin: "All store and staff-management permissions.",
  support: "Customer and order lookup; return declines, but no refunds or account deactivation.",
  fulfillment: "Read orders, update fulfillment, and view inventory.",
  inventory_manager: "View and adjust stock; read catalog insights.",
  finance_manager: "Read sales and orders, approve refunds, retry payments, and export reports.",
  customer: "Storefront access only; no staff-console permissions.",
};

export default function StaffAccessView({ adminId }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/admin/users/staff?page=${page}&limit=50`);
      setUsers(Array.isArray(response.data?.data) ? response.data.data : []);
      setRoles(Array.isArray(response.data?.roles) ? response.data.roles : []);
      setPagination(response.data?.pagination || { total: 0, totalPages: 0 });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not load staff access.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadUsers(), 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const changeRole = async (user, role) => {
    if (role === user.role) return;
    if (role === "admin" && !window.confirm(`Grant full owner access to ${user.name}? They will be able to manage refunds, customers, catalog, targets, and staff.`)) return;
    setBusyId(user._id);
    setError("");
    setNotice("");
    try {
      await api.patch(`/admin/users/${user._id}/role`, { role });
      setUsers((current) => current.map((item) => item._id === user._id
        ? { ...item, role }
        : item));
      setNotice(`${user.name}'s access is now ${roleLabels[role] || role}.`);
    } catch (requestError) {
      const message = requestError.response?.data?.message || "Could not update staff access.";
      await loadUsers();
      setError(message);
    } finally {
      setBusyId("");
    }
  };

  return <div className="grid gap-4">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Object.entries(roleSummaries).filter(([role]) => role !== "customer").map(([role, description]) => <article key={role} className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="text-xs font-bold text-slate-800">{roleLabels[role]}</h3><p className="mt-1.5 text-[11px] leading-4 text-slate-500">{description}</p></article>)}</section>
    <section className="flex gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 sm:p-5">
      <ShieldCheck size={18} className="mt-0.5 shrink-0 text-indigo-600" />
      <div>
        <h2 className="text-sm font-bold text-slate-900">Least-privilege team access</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">Choose a staff role for each account. Access is enforced by the server, and changing a role revokes that account’s existing sessions. Keep owner access limited to trusted store owners.</p>
      </div>
    </section>
    {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">{notice}</p>}
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-bold text-slate-900">People and assigned roles</h2>
        <p className="mt-1 text-xs text-slate-500">Role changes take effect on the next sign-in because active tokens are revoked.</p>
      </div>
      {loading ? <p className="p-8 text-center text-xs text-slate-500">Loading team access…</p> : users.length ? <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead><tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-400"><th className="px-5 py-3">Account</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Status</th><th className="px-5 py-3">Role</th></tr></thead>
          <tbody>{users.map((user) => <tr key={user._id} className="border-t border-slate-100">
            <td className="px-5 py-3"><span className="flex items-center gap-3"><Avatar name={user.name} size="sm" /><span className="min-w-0"><b className="block truncate text-xs text-slate-800">{user.name}{user._id === adminId ? " (you)" : ""}</b><small className="block truncate text-[11px] text-slate-500">{user.email}</small></span></span></td>
            <td className="px-4 py-3 text-xs text-slate-500">{formatDate(user.createdAt)}</td>
            <td className="px-4 py-3"><Badge className={user.isActive ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"}>{user.isActive ? "Active" : "Inactive"}</Badge></td>
            <td className="px-5 py-3"><select aria-label={`Role for ${user.name}`} value={user.role} disabled={user._id === adminId || !user.isActive || busyId === user._id} onChange={(event) => changeRole(user, event.target.value)} className="h-9 max-w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 disabled:bg-slate-50 disabled:text-slate-400">{roles.map((role) => <option key={role} value={role}>{roleLabels[role] || role}</option>)}</select></td>
          </tr>)}</tbody>
        </table>
      </div> : <EmptyState icon={Users} title="No accounts found" detail="Registered accounts will appear here when available." />}
      {!loading && <div className="border-t border-slate-100 px-5 py-3 text-[10px] text-slate-400">Changing the last active owner’s role is prevented by the server.</div>}
      {!loading && pagination.totalPages > 1 && <div className="flex items-center justify-between px-5 py-3 text-xs text-slate-500"><span>{pagination.total} accounts</span><div className="flex items-center gap-3"><button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="font-semibold disabled:opacity-40">Previous</button><span>Page {page} of {pagination.totalPages}</span><button disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="font-semibold disabled:opacity-40">Next</button></div></div>}
    </section>
  </div>;
}
