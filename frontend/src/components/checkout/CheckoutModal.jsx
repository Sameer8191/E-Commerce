import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios.js";
import { addGuestCartItem, getGuestCart, guestCartEventName, mergeGuestCartToAccount, updateGuestCartItem } from "../../api/guestCart.js";

const emptyAddress = {
  fullName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
};

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CheckoutModal({
  open,
  onClose,
  pendingProduct,
  onAdded,
  onCartCount,
}) {
  const [token, setToken] = useState(
    () => window.localStorage.getItem("authToken") || "",
  );
  const [cart, setCart] = useState([]);
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [address, setAddress] = useState(emptyAddress);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("razorpay");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [couponApplied, setCouponApplied] = useState(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState("");
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  const itemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );
  const total = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + Number(item.product?.price || 0) * item.quantity,
        0,
      ),
    [cart],
  );
  const grandTotal = Math.max(0, total - Number(couponApplied?.discount || 0));
  const handleClose = useCallback(() => {
    setCouponInput("");
    setCouponApplied(null);
    setCouponError("");
    onClose();
  }, [onClose]);

  const refreshCart = useCallback(async () => {
    const response = await api.get("/cart");
    const items = response.data?.data?.items || [];
    setCart(
      items
        .filter((item) => item.product)
        .map((item) => ({
          product: item.product,
          variant: item.variant || '',
          quantity: item.quantity,
          available: item.available,
        })),
    );
    onCartCount?.(
      items.reduce((sum, item) => sum + (item.product ? item.quantity : 0), 0),
    );
  }, [onCartCount]);

  const refreshGuestCart = useCallback(() => {
    const guestItems = getGuestCart()
    const items = guestItems.map((item) => ({
      product: item.product,
      variant: item.variant || '',
      quantity: item.quantity,
      available: Number(item.product?.stock) >= guestItems.filter((entry) => entry.product?._id === item.product?._id).reduce((sum, entry) => sum + entry.quantity, 0),
    }));
    setCart(items);
    onCartCount?.(items.reduce((sum, item) => sum + item.quantity, 0));
  }, [onCartCount]);

  useEffect(() => {
    if (!open || !token) return;
    const timer = window.setTimeout(() => refreshCart().catch((requestError) => {
      if (requestError.response?.status === 401) {
        window.localStorage.removeItem("authToken");
        setToken("");
      } else
        setError(
          requestError.response?.data?.message || "Could not load your bag.",
        );
    }), 0);
    return () => window.clearTimeout(timer);
  }, [open, token, refreshCart]);

  useEffect(() => {
    if (!open || token) return undefined;
    const timer = window.setTimeout(refreshGuestCart, 0);
    window.addEventListener(guestCartEventName(), refreshGuestCart);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(guestCartEventName(), refreshGuestCart);
    };
  }, [open, token, refreshGuestCart]);

  useEffect(() => {
    if (!open || !token) return;
    let active = true;
    api.get("/users/me").then((response) => {
      if (!active) return;
      const user = response.data?.user;
      const savedAddresses = Array.isArray(user?.addresses) ? user.addresses : [];
      setSavedAddresses(savedAddresses);
      const savedAddress = user?.addresses?.find((item) => item.isDefault) || user?.addresses?.[0];
      setSelectedAddressId(savedAddress?._id || "");
      setAddress((current) => ({
        ...current,
        fullName: current.fullName || user?.name || savedAddress?.fullName || "",
        phone: current.phone || user?.phone || savedAddress?.phone || "",
        addressLine1: current.addressLine1 || savedAddress?.street || "",
        addressLine2: current.addressLine2 || savedAddress?.street2 || "",
        city: current.city || savedAddress?.city || "",
        state: current.state || savedAddress?.state || "",
        postalCode: current.postalCode || savedAddress?.postalCode || "",
        country: current.country || savedAddress?.country || "India",
      }));
    }).catch((requestError) => {
      if (active && requestError.response?.status !== 401) {
        setError(requestError.response?.data?.message || "Saved delivery details could not be loaded.");
      }
    });
    return () => { active = false; };
  }, [open, token]);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    closeButtonRef.current?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (!busy) handleClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, handleClose]);

  if (!open) return null;

  const login = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await api.post("/auth/login", credentials);
      const nextToken = response.data?.token;
      if (!nextToken) throw new Error("Login did not return an access token.");
      window.localStorage.setItem("authToken", nextToken);
      try {
        await mergeGuestCartToAccount(api);
      } catch (mergeError) {
        window.localStorage.removeItem("authToken");
        throw mergeError;
      }
      setToken(nextToken);
      setSuccess(
        `Signed in as ${response.data.user?.name || response.data.user?.email || "customer"}.`,
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to sign in.",
      );
    } finally {
      setBusy(false);
    }
  };

  const addPendingProduct = async () => {
    if (!pendingProduct?._id) return;
    setBusy(true);
    setError("");
    try {
      if (!token) {
        addGuestCartItem(pendingProduct, 1, pendingProduct.selectedVariant || '');
        refreshGuestCart();
        setError("");
        return;
      }
      const response = await api.post("/cart/items", {
        productId: pendingProduct._id,
        quantity: 1,
        variant: pendingProduct.selectedVariant || '',
      });
      await refreshCart();
      setCouponApplied(null);
      setCouponError("");
      onAdded(
        response.data?.message || `${pendingProduct.name} added to your bag`,
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not add this item to your bag.",
      );
    } finally {
      setBusy(false);
    }
  };

  const updateQuantity = async (productId, quantity, variant = '') => {
    if (!token) {
      updateGuestCartItem(productId, quantity, variant);
      refreshGuestCart();
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (quantity < 1) await api.delete(`/cart/items/${productId}?variant=${encodeURIComponent(variant)}`);
      else await api.patch(`/cart/items/${productId}`, { quantity, variant });
      setCouponApplied(null);
      setCouponError("");
      await refreshCart();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Could not update your bag.",
      );
      await refreshCart().catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const applyCoupon = async (event) => {
    event.preventDefault();
    setCouponBusy(true);
    setCouponError("");
    try {
      const response = await api.post("/coupons/validate", { code: couponInput });
      setCouponApplied(response.data?.data || null);
      if (!response.data?.data?.code) throw new Error("Coupon validation returned an invalid response.");
      setCouponInput(response.data.data.code);
    } catch (requestError) {
      setCouponApplied(null);
      setCouponError(requestError.response?.data?.message || requestError.message || "Could not validate this coupon.");
    } finally {
      setCouponBusy(false);
    }
  };

  const selectSavedAddress = (addressId) => {
    setSelectedAddressId(addressId);
    const selected = savedAddresses.find((item) => item._id === addressId);
    if (!selected) {
      setAddress(emptyAddress);
      return;
    }
    setAddress({
      fullName: selected.fullName || "",
      phone: selected.phone || "",
      addressLine1: selected.street || "",
      addressLine2: selected.street2 || "",
      city: selected.city || "",
      state: selected.state || "",
      postalCode: selected.postalCode || "",
      country: selected.country || "India",
    });
  };

  const checkout = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const key =
        window.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const orderResponse = await api.post(
        "/orders",
        { shippingAddress: address, paymentMethod, couponCode: couponApplied?.code || "" },
        { headers: { "Idempotency-Key": key } },
      );
      const localOrder = orderResponse.data?.data;
      if (!localOrder?._id)
        throw new Error(
          "Order was created, but its details could not be read.",
        );
      if (paymentMethod === "cod") {
        setCart([]);
        onCartCount?.(0);
        setSuccess(`Order ${localOrder.orderNumber || ""} placed. Pay on delivery and track it from Your orders.`);
        setBusy(false);
        return;
      }
      const paymentOrderResponse = await api.post("/payments/create-order", {
        orderId: localOrder._id,
      });
      const paymentOrder = paymentOrderResponse.data;
      if (!(await loadRazorpay()))
        throw new Error(
          "Razorpay checkout could not be loaded. Your order is saved; retry from your orders.",
        );

      const options = {
        key: paymentOrder.key,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: "goodthings",
        description: `Order ${localOrder.orderNumber || "payment"}`,
        order_id: paymentOrder.razorpayOrderId,
        prefill: { name: address.fullName, contact: address.phone },
        notes: { orderNumber: localOrder.orderNumber || "" },
        theme: { color: "#172337" },
        handler: async (payment) => {
          try {
            await api.post("/payments/verify", {
              orderId: localOrder._id,
              razorpay_order_id: payment.razorpay_order_id,
              razorpay_payment_id: payment.razorpay_payment_id,
              razorpay_signature: payment.razorpay_signature,
            });
            setCart([]);
            onCartCount?.(0);
            onAdded("Payment successful. Your order is confirmed.");
            handleClose();
          } catch (verifyError) {
            setError(
              verifyError.response?.data?.message ||
                "Payment was received but could not be verified. Check your orders before retrying.",
            );
          }
        },
        modal: {
          ondismiss: () => {
            setSuccess(
              `Payment was not completed. Order ${localOrder.orderNumber || "details"} is pending; check your orders before starting another checkout.`,
            );
            refreshCart().catch(() => {});
          },
        },
      };
      setBusy(false);
      new window.Razorpay(options).open();
    } catch (requestError) {
      const serverMessage =
        requestError.response?.data?.message ||
        requestError.message ||
        "Unable to start checkout.";
      if (requestError.response?.status === 409) {
        await refreshCart().catch(() => {});
        setError(
          serverMessage.includes("products in your cart are unavailable")
            ? "An unavailable item was removed. Review your cart and try checkout again."
            : serverMessage,
        );
      } else setError(serverMessage);
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-stretch justify-end bg-[#111a28a8]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) handleClose();
      }}
    >
      <section
        ref={dialogRef}
        className="relative h-full w-full max-w-[520px] overflow-auto bg-white px-[clamp(22px,5vw,42px)] py-[38px] shadow-[-12px_0_40px_#10192430] max-[520px]:px-[18px] max-[520px]:py-[34px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
      >
        <button
          ref={closeButtonRef}
          className="absolute right-[22px] top-[18px] cursor-pointer border-0 bg-transparent text-[29px] leading-none text-[#536074]"
          type="button"
          onClick={handleClose}
          aria-label="Close checkout"
        >
          ×
        </button>
        <span className="text-[9px] font-bold tracking-[.16em] text-[#2874f0]">
          GOOD THINGS, ON THEIR WAY
        </span>
        <h2 id="checkout-title">{token || cart.length ? "Your bag" : "Sign in to shop"}</h2>
        {token && (
          <Link
            to="/cart"
            onClick={handleClose}
            className="mb-5 inline-block text-xs font-semibold text-indigo-700 hover:underline"
          >
            View full cart
          </Link>
        )}
        {!token ? (
          <form
            className="grid gap-[13px] [&>p]:text-[13px] [&>p]:leading-[1.6] [&>p]:text-[#687386] [&>label]:grid [&>label]:gap-[6px] [&>label]:text-[11px] [&>label]:font-bold [&>label]:text-[#394557] [&_input]:h-[39px] [&_input]:w-full [&_input]:rounded [&_input]:border [&_input]:border-[#dbe0e8] [&_input]:px-[11px] [&_input]:outline-none [&_input:focus]:border-[#2874f0] [&_input:focus]:shadow-[0_0_0_3px_#2874f018]"
            onSubmit={login}
          >
            <p>Your bag is saved on this device. Sign in whenever you’re ready to continue to checkout.</p>
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={credentials.email}
                onChange={(event) =>
                  setCredentials({ ...credentials, email: event.target.value })
                }
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={credentials.password}
                onChange={(event) =>
                  setCredentials({
                    ...credentials,
                    password: event.target.value,
                  })
                }
              />
            </label>
            <button
              className="min-h-[45px] w-full cursor-pointer rounded-[3px] border-0 bg-[#172337] text-xs font-bold text-white disabled:cursor-wait disabled:opacity-55"
              disabled={busy}
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <p className="text-center text-xs text-slate-500">New here? <Link className="font-semibold text-indigo-700 hover:underline" to="/signup?redirect=%2Fcart" onClick={handleClose}>Create an account</Link></p>
          </form>
        ) : (
          <>
            {pendingProduct &&
              !cart.some(
                (item) => item.product?._id === pendingProduct._id && (item.variant || '') === (pendingProduct.selectedVariant || ''),
              ) && (
                <div className="mb-[14px] flex items-center justify-between rounded bg-[#f3f6fb] p-3 text-xs">
                  <span>{pendingProduct.name}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={addPendingProduct}
                  >
                    Add to bag
                  </button>
                </div>
              )}
            <div className="grid border-t border-[#e8ebf0]">
              {cart.length ? (
                cart.map(({ product, variant, quantity, available }) => (
                  <div
                    className="flex items-center justify-between gap-3 border-b border-[#e8ebf0] py-[14px]"
                    key={`${product._id}:${variant || ''}`}
                  >
                    <div>
                      <b>{product.name}</b>
                      {variant && <small className="block">Option: {variant}</small>}
                      <small>
                        {new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: "INR",
                        }).format(product.price)}{" "}
                        each {!available && "· unavailable"}
                      </small>
                    </div>
                    <div className="flex items-center gap-[11px]">
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Remove one ${product.name}`}
                        onClick={() =>
                          updateQuantity(product._id, quantity - 1, variant)
                        }
                      >
                        −
                      </button>
                      <span>{quantity}</span>
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Add one ${product.name}`}
                        onClick={() =>
                          updateQuantity(product._id, quantity + 1, variant)
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-[10px] text-[13px] leading-[1.6] text-[#687386]">
                  Your bag is waiting for something good.
                </p>
              )}
            </div>
            {cart.length > 0 && (
              <>
                <div className="flex justify-between border-b border-[#e8ebf0] py-4 text-[13px]">
                  <span>
                    {itemCount} item{itemCount === 1 ? "" : "s"}
                  </span>
                  <b>
                    {new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: "INR",
                    }).format(total)}
                  </b>
                </div>
                <form onSubmit={applyCoupon} className="my-4 grid gap-2">
                  <label htmlFor="checkout-coupon" className="text-[11px] font-bold text-[#394557]">Discount code</label>
                  <div className="flex gap-2">
                    <input id="checkout-coupon" value={couponInput} maxLength={40} onChange={(event) => { setCouponInput(event.target.value.toUpperCase()); setCouponApplied(null); setCouponError(""); }} placeholder="Enter a coupon code" className="h-10 min-w-0 flex-1 rounded border border-[#dbe0e8] px-3 text-xs outline-none focus:border-[#2874f0]" />
                    <button type="submit" disabled={couponBusy || !couponInput.trim()} className="rounded bg-[#172337] px-3 text-xs font-semibold text-white disabled:opacity-50">{couponBusy ? "Checking…" : couponApplied ? "Apply again" : "Apply"}</button>
                  </div>
                  {couponError && <p className="text-xs text-rose-700" role="alert">{couponError}</p>}
                  {couponApplied && <p className="text-xs text-emerald-700" role="status">{couponApplied.code} applied — you save ₹{Number(couponApplied.discount).toFixed(2)}.</p>}
                </form>
                <div className="grid gap-2 border-b border-[#e8ebf0] pb-4 text-xs">
                  {couponApplied && <div className="flex justify-between text-emerald-700"><span>Discount</span><b>−₹{Number(couponApplied.discount).toFixed(2)}</b></div>}
                  <div className="flex justify-between font-semibold text-[#172337]"><span>Estimated total</span><b>{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(grandTotal)}</b></div>
                  <p className="text-[10px] text-[#687386]">Free shipping across India. Applicable GST is included in listed prices. Coupon eligibility is checked again when you place your order.</p>
                </div>
                <form
                  className="grid gap-[13px] [&>p]:text-[13px] [&>p]:leading-[1.6] [&>p]:text-[#687386] [&>label]:grid [&>label]:gap-[6px] [&>label]:text-[11px] [&>label]:font-bold [&>label]:text-[#394557] [&_input]:h-[39px] [&_input]:w-full [&_input]:rounded [&_input]:border [&_input]:border-[#dbe0e8] [&_input]:px-[11px] [&_input]:outline-none [&_input:focus]:border-[#2874f0] [&_input:focus]:shadow-[0_0_0_3px_#2874f018]"
                  onSubmit={checkout}
                >
                  <h3>Delivery address</h3>
                  {savedAddresses.length > 0 && <label className="grid gap-1.5 text-[11px] font-bold text-[#394557]">Use a saved address<select value={selectedAddressId} onChange={(event) => selectSavedAddress(event.target.value)} className="h-10 rounded border border-[#dbe0e8] bg-white px-3 text-xs font-normal"><option value="">Enter a different address</option>{savedAddresses.map((saved) => <option value={saved._id} key={saved._id}>{saved.fullName} — {saved.street}, {saved.city}{saved.isDefault ? ' (default)' : ''}</option>)}</select></label>}
                  <div className="grid grid-cols-2 gap-[11px] max-[520px]:grid-cols-1">
                    {[
                      ["fullName", "Full name"],
                      ["phone", "Phone"],
                      ["addressLine1", "Address line 1"],
                      ["addressLine2", "Address line 2 (optional)"],
                      ["city", "City"],
                      ["state", "State"],
                      ["postalCode", "Postal code"],
                    ].map(([name, label]) => (
                      <label key={name}>
                        {label}
                        <input
                          required={!name.includes("Line2")}
                          value={address[name]}
                          autoComplete={
                            name === "fullName"
                              ? "name"
                              : name === "phone"
                                ? "tel"
                                : name === "addressLine2"
                                  ? "shipping address-line2"
                                  : "shipping address-line1"
                          }
                          onChange={(event) => {
                            setSelectedAddressId("");
                            setAddress({
                              ...address,
                              [name]: event.target.value,
                            });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  <fieldset className="grid gap-2 border-t border-[#e8ebf0] pt-4">
                    <legend className="text-[11px] font-bold text-[#394557]">Payment method</legend>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#dbe0e8] p-3">
                      <input className="mt-0.5 accent-[#2874f0]" type="radio" name="paymentMethod" value="razorpay" checked={paymentMethod === "razorpay"} onChange={() => setPaymentMethod("razorpay")} />
                      <span><b className="block text-xs text-[#172337]">Pay online</b><small className="mt-1 block text-[10px] font-normal text-[#687386]">Secure payment with Razorpay</small></span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#dbe0e8] p-3">
                      <input className="mt-0.5 accent-[#2874f0]" type="radio" name="paymentMethod" value="cod" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} />
                      <span><b className="block text-xs text-[#172337]">Cash on delivery</b><small className="mt-1 block text-[10px] font-normal text-[#687386]">Pay when your order arrives</small></span>
                    </label>
                  </fieldset>
                  <button
                    className="min-h-[45px] w-full cursor-pointer rounded-[3px] border-0 bg-[#172337] text-xs font-bold text-white disabled:cursor-wait disabled:opacity-55"
                    disabled={busy || cart.some((item) => !item.available)}
                  >
                    {busy
                      ? "Preparing secure checkout…"
                      : paymentMethod === "cod" ? "Place order" : "Pay securely with Razorpay"}
                  </button>
                  <small className="block text-center text-[10px] text-[#687386]">
                    {paymentMethod === "cod" ? "Pay when your order is delivered · INR" : "Secure payment · INR · Powered by Razorpay"}
                  </small>
                </form>
              </>
            )}
            {!token && pendingProduct && !cart.some((item) => item.product?._id === pendingProduct._id && (item.variant || '') === (pendingProduct.selectedVariant || '')) && <div className="mt-4 flex items-center justify-between rounded bg-[#f3f6fb] p-3 text-xs">
              <span>{pendingProduct.name}{pendingProduct.selectedVariant ? ` · ${pendingProduct.selectedVariant}` : ''}</span>
              <button type="button" disabled={busy} onClick={addPendingProduct}>Add to bag</button>
            </div>}
            {!token && cart.length > 0 && <div className="mt-5">
              <div className="grid border-t border-[#e8ebf0]">
                {cart.map(({ product, variant, quantity }) => <div className="flex items-center justify-between gap-3 border-b border-[#e8ebf0] py-3 text-xs" key={`${product._id}:${variant || ''}`}>
                  <span className="min-w-0 flex-1 truncate">{product.name}{variant ? ` · ${variant}` : ''} · {quantity} × ₹{Number(product.price).toFixed(2)}</span>
                  <div className="flex items-center gap-2"><button type="button" aria-label={`Remove one ${product.name}`} onClick={() => updateQuantity(product._id, quantity - 1, variant)}>−</button><button type="button" aria-label={`Add one ${product.name}`} disabled={quantity >= Number(product.stock)} onClick={() => updateQuantity(product._id, quantity + 1, variant)}>+</button></div>
                </div>)}
              </div>
              <p className="mt-3 text-xs text-slate-500">Sign in to sync these items to your account and complete checkout.</p>
            </div>}
          </>
        )}
        {success && (
          <p
            className="my-3 rounded bg-[#edf8f0] p-[10px_12px] text-[13px] leading-[1.6] text-[#20633b]"
            role="status"
          >
            {success}
          </p>
        )}
        {error && (
          <p
            className="my-3 rounded bg-[#fff0ee] p-[10px_12px] text-[13px] leading-[1.6] text-[#a12b1a]"
            role="alert"
          >
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
