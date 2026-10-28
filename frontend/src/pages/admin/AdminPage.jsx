import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BadgePercent,
  Bell,
  Box,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  RefreshCw,
  RotateCcw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,
  Wallet,
  X,
} from "lucide-react";
import api from "../../api/axios.js";
import ProductManagement from "../../components/admin/ProductManagement.jsx";
import StaffAccessView from "../../components/admin/StaffAccessView.jsx";
import MarketplaceManagement from "../../components/admin/MarketplaceManagement.jsx";
import CouponManagement from "../../components/admin/CouponManagement.jsx";
import {
  Avatar,
  AnalyticsView,
  AdminActivityView,
  CatalogInsights,
  CustomersView,
  InventoryView,
  InvoicesView,
  OrdersView,
  Overview,
  RefundsView,
  ReportsView,
  SectionTitle,
} from "../../components/admin/AdminComponents.jsx";
import { PAGE_SIZE, shortId } from "../../components/admin/adminUtils.js";

const VIEW_PERMISSIONS = {
  overview: "dashboard.read",
  analytics: "analytics.read",
  refunds: "returns.read",
  reports: "reports.export",
  invoices: "invoices.read",
  activity: "activity.read",
  orders: "orders.read",
  customers: "customers.read",
  products: "catalog.manage",
  catalog: "catalog.read",
  inventory: "inventory.read",
  team: "staff.manage",
  marketplace: "vendors.manage",
  settlements: "vendors.settle",
  coupons: "coupons.manage",
};

const DEFAULT_VIEWS = Object.keys(VIEW_PERMISSIONS);

export default function AdminPage() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const can = useCallback((permission) => admin?.permissions?.includes(permission) || false, [admin]);
  const canAny = useCallback((permissions) => permissions.some(can), [can]);
  const [authorized, setAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [overview, setOverview] = useState({
    stats: null,
    orders: [],
    customers: [],
  });
  const [analyticsStats, setAnalyticsStats] = useState(null);
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [invoiceOrders, setInvoiceOrders] = useState([]);
  const [invoicePagination, setInvoicePagination] = useState({ total: 0, page: 1, totalPages: 0 });
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [activityEntries, setActivityEntries] = useState([]);
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [notificationError, setNotificationError] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [orderPagination, setOrderPagination] = useState({
    total: 0,
    page: 1,
    totalPages: 0,
  });
  const [orderStatus, setOrderStatus] = useState("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderQuery, setOrderQuery] = useState("");
  const [refundOrders, setRefundOrders] = useState([]);
  const [refundPagination, setRefundPagination] = useState({ total: 0, page: 1, totalPages: 0 });
  const [customers, setCustomers] = useState([]);
  const [customerPagination, setCustomerPagination] = useState({
    total: 0,
    page: 1,
    totalPages: 0,
  });
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [catalog, setCatalog] = useState(null);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    slug: "",
    description: "",
  });
  const [inventory, setInventory] = useState({
    items: [],
    total: 0,
    page: 1,
    totalPages: 0,
  });
  const [inventoryStatus, setInventoryStatus] = useState("all");
  const [inventorySearch, setInventorySearch] = useState("");

  useEffect(() => {
    let live = true;
    const verifyAdmin = async () => {
      if (!window.localStorage.getItem("authToken")) {
        navigate("/login?redirect=%2Fadmin", { replace: true });
        return;
      }
      try {
        const response = await api.get("/users/me");
        if (!live) return;
        const user = response.data?.user;
        setAdmin(user || null);
        const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
        const firstView = DEFAULT_VIEWS.find((candidate) => permissions.includes(VIEW_PERMISSIONS[candidate]));
        if (!firstView) {
          setError("Your account does not have access to the staff console.");
        } else {
          setView(firstView);
          setAuthorized(true);
        }
      } catch (requestError) {
        if (!live) return;
        if (requestError.response?.status === 401) {
          window.localStorage.removeItem("authToken");
          navigate("/login?redirect=%2Fadmin", { replace: true });
        } else
          setError(
            requestError.response?.data?.message ||
              "We could not verify your admin account.",
          );
      } finally {
        if (live) setAuthLoading(false);
      }
    };
    verifyAdmin();
    return () => {
      live = false;
    };
  }, [navigate]);

  const loadNotifications = useCallback(async () => {
    if (!authorized || !canAny(["dashboard.read", "inventory.read", "returns.read"])) return;
    try {
      const response = await api.get("/admin/notifications");
      setAdminNotifications(Array.isArray(response.data?.data) ? response.data.data : []);
      setUnreadNotificationCount(Number(response.data?.unreadCount) || 0);
      setNotificationError("");
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        window.localStorage.removeItem("authToken");
        navigate("/login?redirect=%2Fadmin", { replace: true });
      } else {
        setNotificationError(requestError.response?.data?.message || "Admin notifications could not be loaded.");
      }
    }
  }, [authorized, canAny, navigate]);

  useEffect(() => {
    if (!authorized) return undefined;
    const timer = window.setTimeout(() => loadNotifications(), 0);
    const interval = window.setInterval(() => loadNotifications(), 60_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [authorized, loadNotifications]);

  const loadViewData = useCallback(
    async (quiet = false) => {
      if (!authorized) return;
      if (quiet) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        if (view === "overview") {
          const [dashboard, orderResult, customerResult] = await Promise.all([
            api.get("/admin/dashboard"),
            can("orders.read") ? api.get("/admin/orders?page=1&limit=6") : Promise.resolve(null),
            can("customers.read") ? api.get("/admin/users?page=1&limit=5&sort=newest") : Promise.resolve(null),
          ]);
          setOverview({
            stats: dashboard.data?.data || {},
            orders: Array.isArray(orderResult?.data?.data)
              ? orderResult.data.data
              : [],
            customers: Array.isArray(customerResult?.data?.users)
              ? customerResult.data.users
              : [],
          });
        } else if (view === "analytics") {
          const response = await api.get(`/admin/dashboard?days=${analyticsDays}`);
          setAnalyticsStats(response.data?.data || {});
        } else if (view === "invoices") {
          const params = new URLSearchParams({ page: String(invoicePage), limit: String(PAGE_SIZE) });
          if (invoiceQuery) params.set("search", invoiceQuery);
          const response = await api.get(`/admin/orders?${params.toString()}`);
          setInvoiceOrders(Array.isArray(response.data?.data) ? response.data.data : []);
          setInvoicePagination(response.data?.pagination || { total: 0, page: 1, totalPages: 0 });
        } else if (view === "activity") {
          const response = await api.get("/admin/activity");
          setActivityEntries(Array.isArray(response.data?.data) ? response.data.data : []);
        } else if (view === "orders") {
          const params = new URLSearchParams({
            page: String(orderPagination.page),
            limit: String(PAGE_SIZE),
          });
          if (orderStatus !== "all") params.set("status", orderStatus);
          if (orderQuery) params.set("search", orderQuery);
          const response = await api.get(`/admin/orders?${params.toString()}`);
          setOrders(
            Array.isArray(response.data?.data) ? response.data.data : [],
          );
          setOrderPagination(
            response.data?.pagination || { total: 0, page: 1, totalPages: 0 },
          );
        } else if (view === "refunds") {
          const response = await api.get(
            `/admin/returns?page=${refundPagination.page}&limit=${PAGE_SIZE}&status=all`,
          );
          setRefundOrders(Array.isArray(response.data?.data) ? response.data.data : []);
          setRefundPagination(response.data?.pagination || { total: 0, page: 1, totalPages: 0 });
        } else if (view === "customers") {
          const params = new URLSearchParams({
            page: String(customerPagination.page),
            limit: String(PAGE_SIZE),
            sort: "newest",
          });
          if (customerQuery) params.set("search", customerQuery);
          const response = await api.get(`/admin/users?${params.toString()}`);
          setCustomers(
            Array.isArray(response.data?.users) ? response.data.users : [],
          );
          setCustomerPagination({
            total: response.data?.pagination?.totalUsers || 0,
            page: response.data?.pagination?.currentPage || 1,
            totalPages: response.data?.pagination?.totalPages || 0,
          });
        } else if (view === "catalog") {
          const response = await api.get("/admin/catalog/insights");
          setCatalog(response.data?.data || {});
        } else if (view === "products") {
          const response = await api.get("/admin/catalog/insights");
          setCatalog(response.data?.data || {});
        } else if (view === "inventory") {
          const params = new URLSearchParams({
            page: String(inventory.page),
            limit: "30",
            status: inventoryStatus,
            search: inventorySearch.trim(),
          });
          const response = await api.get(
            `/admin/inventory?${params.toString()}`,
          );
          setInventory((current) => ({
            ...current,
            items: response.data?.data || [],
            ...response.data?.pagination,
          }));
        }
      } catch (requestError) {
        if (requestError.response?.status === 401) {
          window.localStorage.removeItem("authToken");
          navigate("/login?redirect=%2Fadmin", { replace: true });
        } else
          setError(
            requestError.response?.data?.message ||
              "Dashboard data could not be loaded. Please try again.",
          );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      authorized,
      can,
      view,
      analyticsDays,
      invoicePage,
      invoiceQuery,
      orderPagination.page,
      orderStatus,
      orderQuery,
      refundPagination.page,
      customerPagination.page,
      customerQuery,
      inventory.page,
      inventoryStatus,
      inventorySearch,
      navigate,
    ],
  );

  useEffect(() => {
    if (!authorized) return undefined;
    const timer = window.setTimeout(() => loadViewData(), 0);
    return () => window.clearTimeout(timer);
  }, [authorized, loadViewData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCustomerQuery(customerSearch.trim());
      setCustomerPagination((current) => ({ ...current, page: 1 }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [customerSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setInvoiceQuery(invoiceSearch.trim());
      setInvoicePage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [invoiceSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOrderQuery(orderSearch.trim());
      setOrderPagination((current) => ({ ...current, page: 1 }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [orderSearch]);

  const updateOrder = async (order, status) => {
    setBusyId(order._id);
    setNotice("");
    try {
      const response = await api.patch(`/admin/orders/${order._id}/status`, {
        status,
      });
      setOrders((current) =>
        current.map((item) =>
          item._id === order._id ? response.data.data : item,
        ),
      );
      setOverview((current) => ({
        ...current,
        orders: current.orders.map((item) =>
          item._id === order._id ? response.data.data : item,
        ),
      }));
      setNotice(
        `Order ${order.orderNumber || shortId(order._id)} marked ${status}.`,
      );
    } catch (requestError) {
      setNotice(
        requestError.response?.data?.message ||
          "Could not update order status.",
      );
    } finally {
      setBusyId("");
    }
  };

  const updateCustomer = async (customer) => {
    setBusyId(customer._id);
    setNotice("");
    try {
      await api.patch(`/admin/users/${customer._id}/status`, {
        isActive: !customer.isActive,
      });
      setCustomers((current) =>
        current.map((item) =>
          item._id === customer._id
            ? { ...item, isActive: !item.isActive }
            : item,
        ),
      );
      setOverview((current) => ({
        ...current,
        customers: current.customers.map((item) =>
          item._id === customer._id
            ? { ...item, isActive: !item.isActive }
            : item,
        ),
      }));
      setNotice(
        `${customer.name} ${customer.isActive ? "deactivated" : "activated"}.`,
      );
    } catch (requestError) {
      setNotice(
        requestError.response?.data?.message ||
          "Could not update customer status.",
      );
    } finally {
      setBusyId("");
    }
  };

  const signOut = () => {
    window.localStorage.removeItem("authToken");
    navigate("/login", { replace: true });
  };
  const createCategory = async (event) => {
    event.preventDefault();
    try {
      await api.post("/admin/catalog/categories", categoryForm);
      setCategoryForm({ name: "", slug: "", description: "" });
      setNotice("Category created successfully.");
      await loadViewData(true);
    } catch (requestError) {
      setNotice(
        requestError.response?.data?.message || "Could not create category.",
      );
    }
  };
  const updateInventory = async (product, adjustment, lowStockThreshold) => {
    setBusyId(product._id);
    try {
      const response = await api.patch(`/admin/inventory/${product._id}`, {
        adjustment,
        lowStockThreshold,
      });
      setInventory((current) => ({
        ...current,
        items: current.items.map((item) =>
          item._id === product._id ? { ...item, ...response.data.data } : item,
        ),
      }));
      setNotice(`${product.name} inventory updated.`);
      loadViewData(true);
    } catch (requestError) {
      setNotice(
        requestError.response?.data?.message || "Could not update inventory.",
      );
    } finally {
      setBusyId("");
    }
  };
  const saveMonthlyTarget = async (monthlySalesTarget) => {
    try {
      await api.patch("/admin/settings/monthly-target", { monthlySalesTarget });
      setNotice("Monthly sales target saved for the store.");
      await loadViewData(true);
    } catch (requestError) {
      setNotice(requestError.response?.data?.message || "Could not save monthly sales target.");
    }
  };
  const updateReturnRequest = async (order, action) => {
    let note = "";
    let refundReference = "";
    if (action === "reject") {
      const enteredNote = window.prompt("Add an optional reason for declining this return request:");
      if (enteredNote === null) return;
      note = enteredNote;
    } else if (action === "approve") {
      if (!window.confirm(`Approve the return for order ${order.orderNumber}? The full order amount will be refunded.`)) return;
    } else if (action === "mark_refunded") {
      const enteredReference = window.prompt("Enter the manual refund reference for this COD order:");
      if (enteredReference === null) return;
      refundReference = enteredReference.trim();
      if (!refundReference) {
        setNotice("A refund reference is required to mark a manual refund complete.");
        return;
      }
    } else if (action === "retry_refund") {
      if (!window.confirm(`Retry the payment refund for order ${order.orderNumber}?`)) return;
    }
    setBusyId(order._id);
    setNotice("");
    try {
      const response = await api.patch(`/admin/returns/${order._id}`, { action, note, refundReference });
      const updatedOrder = response.data?.data;
      if (updatedOrder) {
        setRefundOrders((current) => current.map((item) => item._id === order._id ? updatedOrder : item));
      }
      setNotice(response.data?.message || "Return request updated.");
      await Promise.all([loadViewData(true), loadNotifications()]);
    } catch (requestError) {
      setNotice(requestError.response?.data?.message || "Could not update the return request.");
    } finally {
      setBusyId("");
    }
  };
  const markNotificationRead = async (notification) => {
    try {
      await api.patch(`/admin/notifications/${notification._id}/read`);
      setAdminNotifications((current) => current.map((item) => item._id === notification._id ? { ...item, isRead: true } : item));
      setUnreadNotificationCount((current) => Math.max(0, current - (notification.isRead ? 0 : 1)));
    } catch (requestError) {
      setNotificationError(requestError.response?.data?.message || "Could not mark the notification as read.");
    }
  };
  const exportOrdersReport = async (startDate, endDate) => {
    const rangeStart = new Date(`${startDate}T00:00:00`);
    const rangeEnd = new Date(`${endDate}T23:59:59.999`);
    const firstResponse = await api.get("/admin/reports/orders?page=1&limit=100");
    const firstPage = firstResponse.data?.data;
    if (!Array.isArray(firstPage)) throw new Error("The orders report returned an invalid response.");
    const allOrders = [...firstPage];
    const totalPages = Number(firstResponse.data?.pagination?.totalPages) || 1;
    const firstPageOldestOrder = firstPage[firstPage.length - 1];
    const firstPageIsBeforeRange = firstPageOldestOrder
      && new Date(firstPageOldestOrder.placedAt || firstPageOldestOrder.createdAt) < rangeStart;
    for (let page = 2; !firstPageIsBeforeRange && page <= totalPages; page += 1) {
      const response = await api.get(`/admin/reports/orders?page=${page}&limit=100`);
      if (!Array.isArray(response.data?.data)) throw new Error("The orders report returned an invalid response.");
      allOrders.push(...response.data.data);
      const oldestOrder = response.data.data[response.data.data.length - 1];
      if (oldestOrder && new Date(oldestOrder.placedAt || oldestOrder.createdAt) < rangeStart) break;
    }

    const reportOrders = allOrders.filter((order) => {
      const date = new Date(order.placedAt || order.createdAt);
      return Number.isFinite(date.getTime()) && date >= rangeStart && date <= rangeEnd;
    });
    const completedRefund = (order) => order.refundStatus === "processed" || ["refunded", "partially_refunded"].includes(order.paymentStatus);
    const openRefund = (order) => ["pending", "processing", "failed"].includes(order.refundStatus);
    const refundAmount = (order) => {
      const total = Number(order.totalAmount) || 0;
      const requested = Number(order.returnRequest?.refundAmount);
      return Math.min(total, requested > 0 ? requested : total);
    };
    const totals = reportOrders.reduce((result, order) => {
      const amount = Number(order.totalAmount) || 0;
      result.subtotal += Number(order.subtotal) || 0;
      result.shipping += Number(order.shippingFee) || 0;
      result.discount += Number(order.discount) || 0;
      if (["paid", "partially_refunded", "refunded"].includes(order.paymentStatus)) {
        result.paidSales += amount - (completedRefund(order) ? refundAmount(order) : 0);
      }
      if (completedRefund(order)) result.refunded += refundAmount(order);
      if (openRefund(order)) result.refundOpen += refundAmount(order);
      return result;
    }, { subtotal: 0, shipping: 0, discount: 0, paidSales: 0, refunded: 0, refundOpen: 0 });
    const headers = ["record_type", "order_number", "date", "customer", "order_status", "payment_status", "return_status", "return_reason", "return_details", "refund_status", "subtotal", "shipping_fee", "discount", "total_amount", "paid_sales_net_of_refunds", "completed_refund_amount", "open_or_failed_refund_amount", "return_items"];
    const orderRows = reportOrders.map((order) => {
      const total = Number(order.totalAmount) || 0;
      return [
        "order",
        order.orderNumber || order._id,
        order.placedAt || order.createdAt,
        order.shippingAddress?.fullName || "Customer",
        order.orderStatus || "",
        order.paymentStatus || "",
        order.returnRequest?.status || "none",
        order.returnRequest?.reason || "",
        order.returnRequest?.details || "",
        order.refundStatus || "not_required",
        Number(order.subtotal) || 0,
        Number(order.shippingFee) || 0,
        Number(order.discount) || 0,
        total,
        ["paid", "partially_refunded", "refunded"].includes(order.paymentStatus)
          ? total - (completedRefund(order) ? refundAmount(order) : 0)
          : 0,
        completedRefund(order) ? refundAmount(order) : 0,
        openRefund(order) ? refundAmount(order) : 0,
        (order.returnRequest?.items || []).map((item) => `${item.quantity} x ${item.name}`).join("; "),
      ];
    });
    const summaryRow = (label, column, value) => {
      const row = Array(headers.length).fill("");
      row[0] = "summary";
      row[1] = label;
      row[column] = value;
      return row;
    };
    const summaryRows = [
      summaryRow("date_range", 2, `${startDate} to ${endDate}`),
      summaryRow("orders", 13, reportOrders.length),
      summaryRow("subtotals", 10, totals.subtotal),
      summaryRow("shipping", 11, totals.shipping),
      summaryRow("discounts", 12, totals.discount),
      summaryRow("paid_sales_net_of_refunds", 14, totals.paidSales),
      summaryRow("completed_refunds", 15, totals.refunded),
      summaryRow("open_or_failed_refunds", 16, totals.refundOpen),
    ];
    const escapeCsv = (value) => {
      const text = String(value ?? "").replace(/^[=+\-@\t\r]/, (match) => `'${match}`);
      return `"${text.replaceAll('"', '""')}"`;
    };
    const csv = [headers, ...orderRows, [], ...summaryRows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `goodthings-orders-${startDate}-to-${endDate}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const selectView = (nextView) => {
    const permission = VIEW_PERMISSIONS[nextView];
    if (!permission || !can(permission)) {
      setError("Your staff role does not have access to that section.");
      return;
    }
    setView(nextView);
    setMenuOpen(false);
    setError("");
  };
  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard, permission: "dashboard.read" },
    { id: "analytics", label: "Analytics", icon: Activity, permission: "analytics.read" },
    { id: "refunds", label: "Returns & refunds", icon: RotateCcw, permission: "returns.read" },
    { id: "reports", label: "Reports & exports", icon: FileSpreadsheet, permission: "reports.export" },
    { id: "invoices", label: "Invoices", icon: FileText, permission: "invoices.read" },
    { id: "activity", label: "Activity log", icon: Activity, permission: "activity.read" },
    {
      id: "orders",
      label: "Orders",
      icon: ShoppingBag,
      permission: "orders.read",
      count: overview.stats?.totalOrders,
    },
    {
      id: "customers",
      label: "Customers",
      icon: Users,
      permission: "customers.read",
      count: overview.stats?.totalUsers,
    },
  ];
  const manageItems = [
    { id: "products", label: "Products", icon: Package, permission: "catalog.manage" },
    { id: "inventory", label: "Inventory", icon: Box, permission: "inventory.read" },
    { id: "catalog", label: "Catalog insights", icon: Activity, permission: "catalog.read" },
    { id: "team", label: "Team access", icon: ShieldCheck, permission: "staff.manage" },
    { id: "marketplace", label: "Vendors", icon: Store, permission: "vendors.manage" },
    { id: "settlements", label: "Vendor payouts", icon: Wallet, permission: "vendors.settle" },
    { id: "coupons", label: "Discount coupons", icon: BadgePercent, permission: "coupons.manage" },
  ];
  const pageTitle = {
    overview: "Overview",
    analytics: "Detailed analytics",
    refunds: "Returns & refunds",
    reports: "Reports & exports",
    invoices: "Invoices",
    activity: "Activity log",
    orders: "Orders",
    customers: "Customers",
    products: "Products",
    catalog: "Catalog insights",
    inventory: "Inventory",
    team: "Team access",
    marketplace: "Marketplace vendors",
    settlements: "Vendor payouts",
    coupons: "Discount coupons",
  }[view];
  const today = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
  const operationalAlertCount = Object.values(overview.stats?.operationalAlerts || {})
    .reduce((total, count) => total + (Number(count) || 0), 0);

  return (
    <div className="min-h-screen bg-[#f5f6fa] font-sans text-slate-800">
      {menuOpen && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[258px] flex-col overflow-y-auto border-r border-slate-200 bg-white px-4 transition-transform duration-200 lg:translate-x-0 ${menuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}
      >
        <div className="flex h-[74px] shrink-0 items-center gap-3 border-b border-slate-100 px-2">
          <Link
            to="/"
            className="grid size-10 place-items-center rounded-xl bg-[#172337] text-xl font-extrabold tracking-tight text-white"
          >
            g<span className="text-[#ffe500]">.</span>
          </Link>
          <div className="flex-1">
            <span className="block text-sm font-extrabold tracking-tight text-slate-900">
              goodthings
            </span>
            <span className="mt-0.5 block text-[9px] font-bold tracking-[.16em] text-slate-400">
              STAFF CONSOLE
            </span>
          </div>
          <button
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 lg:hidden"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <button className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-slate-300">
          <span className="grid size-9 place-items-center rounded-lg bg-amber-100 text-sm font-bold text-amber-700">
            G
          </span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-xs font-semibold text-slate-800">
              Goodthings Store
            </b>
            <small className="mt-0.5 block text-[11px] text-slate-400">
              Online store
            </small>
          </span>
          <ChevronDown size={15} className="text-slate-400" />
        </button>
        <p className="mb-2 mt-8 px-3 text-[10px] font-bold tracking-[.15em] text-slate-400">
          WORKSPACE
        </p>
        <nav className="grid gap-1" aria-label="Admin navigation">
          {navItems.filter(({ permission }) => can(permission)).map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => selectView(id)}
              className={`flex h-10 items-center gap-3 rounded-lg px-3 text-left text-[13px] transition ${view === id ? "bg-indigo-50 font-semibold text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
            >
              <Icon size={17} />
              <span className="flex-1">{label}</span>
              {count !== undefined && (
                <span
                  className={`text-[11px] ${view === id ? "text-indigo-500" : "text-slate-400"}`}
                >
                  {count.toLocaleString("en-IN")}
                </span>
              )}
            </button>
          ))}
        </nav>
        <p className="mb-2 mt-8 px-3 text-[10px] font-bold tracking-[.15em] text-slate-400">
          MANAGE
        </p>
        <nav className="grid gap-1" aria-label="Store management">
          {manageItems.filter(({ permission }) => can(permission)).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => selectView(id)}
              className={`flex h-10 items-center gap-3 rounded-lg px-3 text-left text-[13px] ${view === id ? "bg-indigo-50 font-semibold text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
          {can("staff.manage") && <button
            onClick={() => setNotice("Store settings are not available yet.")}
            className="flex h-10 items-center gap-3 rounded-lg px-3 text-left text-[13px] text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            <Settings size={17} />
            <span>Settings</span>
          </button>}
        </nav>
        <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-slate-700">
            <CircleHelp size={16} className="text-indigo-600" />
            <b className="text-xs">Need a hand?</b>
          </div>
          <p className="mb-2 mt-1 text-[11px] leading-4 text-slate-500">
            Our team is here when you need support.
          </p>
          <a
            className="text-[11px] font-semibold text-indigo-700 hover:underline"
            href="mailto:help@goodthings.shop"
          >
            Contact support <ArrowRight size={12} className="inline" />
          </a>
        </div>
        <div className="mt-4 flex items-center gap-3 border-t border-slate-100 py-4">
          <Avatar name={admin?.name || "Store Admin"} size="sm" />
          <span className="min-w-0 flex-1">
            <b className="block truncate text-xs font-semibold text-slate-800">
              {admin?.name || "Store admin"}
            </b>
            <small className="text-[11px] capitalize text-slate-400">{admin?.role?.replaceAll("_", " ") || "Staff"}</small>
          </span>
          <button
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="min-h-screen lg:pl-[258px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-7 lg:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={19} />
            </button>
            <div className="truncate text-xs text-slate-400 sm:text-sm">
              Workspace <span className="mx-2 text-slate-300">/</span>
              <b className="font-semibold text-slate-700">{pageTitle}</b>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <span className="hidden items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 sm:inline-flex">
              <ShieldCheck size={13} />
              {admin?.role?.replaceAll("_", " ") || "Staff"} access
            </span>
            {canAny(["dashboard.read", "inventory.read", "returns.read"]) && <div className="relative">
              <button
                className="relative grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label={unreadNotificationCount ? `${unreadNotificationCount} unread admin notifications` : "Open admin notifications"}
                title={operationalAlertCount ? `${operationalAlertCount} operational alert items` : "Admin notifications"}
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell size={18} />
                {unreadNotificationCount > 0 && <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">{unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}</span>}
              </button>
              {notificationsOpen && <section className="absolute right-0 top-11 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><b className="text-xs text-slate-800">Admin notifications</b><p className="mt-0.5 text-[10px] text-slate-500">Low-stock threshold and return request alerts</p></div><button type="button" onClick={() => loadNotifications()} className="text-[10px] font-semibold text-indigo-700">Refresh</button></div>
                {notificationError && <p role="alert" className="m-3 rounded-lg bg-rose-50 p-2 text-[11px] text-rose-700">{notificationError}</p>}
                {adminNotifications.length ? <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">{adminNotifications.map((notification) => <article key={notification._id} className={`flex gap-3 px-4 py-3 ${notification.isRead ? '' : 'bg-indigo-50/50'}`}>
                  <button type="button" onClick={() => { selectView(notification.type === "return_request" ? "refunds" : can("inventory.read") ? "inventory" : "overview"); setNotificationsOpen(false); }} className="min-w-0 flex-1 text-left"><b className="block text-[11px] text-slate-800">{notification.title}</b><span className="mt-1 block text-[10px] leading-4 text-slate-500">{notification.message}</span></button>
                  {!notification.isRead && <button type="button" onClick={() => markNotificationRead(notification)} className="shrink-0 self-center text-[10px] font-semibold text-indigo-700">Read</button>}
                </article>)}</div> : !notificationError && <p className="px-4 py-8 text-center text-xs text-slate-500">No active notifications.</p>}
                <button type="button" onClick={() => { const target = can("analytics.read") ? "analytics" : can("inventory.read") ? "inventory" : can("orders.read") ? "orders" : "refunds"; selectView(target); setNotificationsOpen(false); }} className="w-full border-t border-slate-100 px-4 py-3 text-left text-[11px] font-semibold text-indigo-700 hover:bg-slate-50">View operational alerts</button>
              </section>}
            </div>}
            <span className="hidden h-7 w-px bg-slate-200 sm:block" />
            <Avatar name={admin?.name || "Admin"} size="sm" />
          </div>
        </header>

        <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-7 lg:px-9 lg:py-9">
          <SectionTitle
            eyebrow={view === "overview" ? today : "STORE MANAGEMENT"}
            title={
              view === "overview"
                ? `Welcome back, ${admin?.name?.split(/\s+/)[0] || "Admin"}`
                : pageTitle
            }
            description={
              view === "overview"
                ? "Here’s what’s happening across your store today."
                : view === "orders"
                  ? "Review orders and keep fulfilment moving."
                  : view === "customers"
                    ? "Manage customer accounts and access."
                    : view === "products"
                      ? "Add products to your catalog with a CSV import."
                      : view === "inventory"
                        ? "Monitor stock levels and update quantities safely."
                        : view === "coupons"
                          ? "Create and pause server-validated fixed or percentage discount codes."
                          : view === "refunds"
                            ? "Review cancellation-linked refunds and monitor processing progress."
                            : view === "reports"
                              ? "Export order and sales data with clear subtotal and refund accounting."
                              : "Track inventory, availability, and category coverage."
            }
            actions={
              <>
                <button
                  disabled={loading || refreshing || authLoading}
                  onClick={() => loadViewData(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw
                    size={14}
                    className={refreshing ? "animate-spin" : ""}
                  />
                  Refresh
                </button>
                {!["products", "coupons"].includes(view) && can("catalog.manage") && (
                  <button
                    onClick={() => selectView("products")}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-xs font-semibold text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700"
                  >
                    <Package size={14} />
                    Manage products
                  </button>
                )}
              </>
            }
          />

          {error && (
            <div
              role="alert"
              className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            >
              <ShieldCheck size={17} />
              <span className="flex-1">{error}</span>
              {authorized ? (
                <button
                  onClick={() => loadViewData()}
                  className="font-semibold underline"
                >
                  Try again
                </button>
              ) : (
                <Link
                  to={admin ? "/" : "/login?redirect=%2Fadmin"}
                  className="font-semibold underline"
                >
                  {admin ? "Return to store" : "Sign in"}
                </Link>
              )}
            </div>
          )}
          {notice && (
            <div
              role="status"
              className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            >
              <Check size={16} />
              <span className="flex-1">{notice}</span>
              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss"
                className="text-emerald-700"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {authLoading || (loading && !error) ? (
            <div className="flex min-h-72 items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
              <RefreshCw size={17} className="animate-spin text-indigo-600" />
              Loading store data…
            </div>
          ) : (
            authorized &&
            !error && (
              <>
                {view === "overview" && (
                  <Overview
                    stats={overview.stats}
                    orders={overview.orders}
                    customers={overview.customers}
                    busyId={busyId}
                    onUpdateOrder={updateOrder}
                    onUpdateCustomer={updateCustomer}
                    canUpdateOrder={can("orders.update_fulfillment")}
                    canCancelOrders={can("orders.cancel")}
                    canDeactivateCustomers={can("customers.deactivate")}
                    canUpdateTarget={can("sales_target.update")}
                    canViewCustomers={can("customers.read")}
                    canViewOrders={can("orders.read")}
                    canViewInventory={can("inventory.read")}
                    canViewAnalytics={can("analytics.read")}
                    canViewInvoices={can("invoices.read")}
                    onView={selectView}
                    onSaveTarget={saveMonthlyTarget}
                    onRefresh={() => loadViewData(true)}
                  />
                )}
                {view === "analytics" && (
                  <AnalyticsView
                    stats={analyticsStats || {}}
                    days={analyticsDays}
                    onDays={setAnalyticsDays}
                    onView={selectView}
                    canViewInventory={can("inventory.read")}
                    canViewOrders={can("orders.read")}
                  />
                )}
                {view === "activity" && <AdminActivityView entries={activityEntries} />}
                {view === "refunds" && (
                  <RefundsView
                    orders={refundOrders}
                    pagination={refundPagination}
                    page={refundPagination.page}
                    busyId={busyId}
                    onAction={updateReturnRequest}
                    permissions={admin?.permissions || []}
                    onPage={(page) => setRefundPagination((current) => ({ ...current, page }))}
                  />
                )}
                {view === "reports" && <ReportsView onExport={exportOrdersReport} />}
                {view === "invoices" && (
                  <InvoicesView
                    orders={invoiceOrders}
                    pagination={invoicePagination}
                    page={invoicePage}
                    search={invoiceSearch}
                    onSearch={setInvoiceSearch}
                    onPage={setInvoicePage}
                  />
                )}
                {view === "orders" && (
                  <OrdersView
                    orders={orders}
                    pagination={orderPagination}
                    page={orderPagination.page}
                    status={orderStatus}
                    search={orderSearch}
                    busyId={busyId}
                    onSearch={setOrderSearch}
                    onStatus={(status) => {
                      setOrderStatus(status);
                      setOrderPagination((current) => ({
                        ...current,
                        page: 1,
                      }));
                    }}
                    onPage={(page) =>
                      setOrderPagination((current) => ({ ...current, page }))
                    }
                    onUpdate={updateOrder}
                    onRefresh={() => loadViewData(true)}
                    canUpdate={can("orders.update_fulfillment")}
                    canCancel={can("orders.cancel")}
                    canInvoice={can("invoices.read")}
                  />
                )}
                {view === "customers" && (
                  <CustomersView
                    customers={customers}
                    pagination={customerPagination}
                    page={customerPagination.page}
                    search={customerSearch}
                    adminId={admin?._id || admin?.id}
                    busyId={busyId}
                    onSearch={setCustomerSearch}
                    onPage={(page) =>
                      setCustomerPagination((current) => ({ ...current, page }))
                    }
                    onUpdate={updateCustomer}
                    canDeactivate={can("customers.deactivate")}
                  />
                )}
                {view === "products" && (
                  <ProductManagement
                    catalog={catalog}
                    onNotice={setNotice}
                    onRefresh={() => loadViewData(true)}
                  />
                )}
                {view === "catalog" && (
                  <CatalogInsights
                    catalog={catalog || {}}
                    categoryForm={categoryForm}
                    onCategoryForm={setCategoryForm}
                    onCreateCategory={createCategory}
                    canManage={can("catalog.manage")}
                  />
                )}
                {view === "inventory" && (
                  <InventoryView
                    inventory={inventory}
                    status={inventoryStatus}
                    search={inventorySearch}
                    busyId={busyId}
                    onStatus={(status) => {
                      setInventoryStatus(status);
                      setInventory((current) => ({ ...current, page: 1 }));
                    }}
                    onSearch={(search) => {
                      setInventorySearch(search);
                      setInventory((current) => ({ ...current, page: 1 }));
                    }}
                    onPage={(page) =>
                      setInventory((current) => ({ ...current, page }))
                    }
                    onUpdate={updateInventory}
                    canAdjust={can("inventory.adjust")}
                  />
                )}
                {view === "team" && <StaffAccessView adminId={admin?._id || admin?.id} />}
                {view === "coupons" && <CouponManagement onNotice={setNotice} />}
                {(view === "marketplace" || view === "settlements") && (
                  <MarketplaceManagement
                    section={view === "marketplace" ? "vendors" : "payouts"}
                    canManage={can("vendors.manage")}
                    canSettle={can("vendors.settle")}
                    onNotice={setNotice}
                  />
                )}
                <footer className="mt-8 flex flex-col gap-2 border-t border-slate-200 py-5 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    © {new Date().getFullYear()} Goodthings Supply Co.
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck size={13} /> Role permissions enforced
                  </span>
                </footer>
              </>
            )
          )}
        </div>
      </main>
    </div>
  );
}
