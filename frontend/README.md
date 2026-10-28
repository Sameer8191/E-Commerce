# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Frontend source layout

- `src/App.jsx` defines application routes; `src/main.jsx` mounts the app.
- `src/pages/` groups route-level screens by domain (`account`, `admin`, `cart`, `catalog`, `info`, `marketplace`, `orders`, and `storefront`).
- `src/components/` contains reusable UI grouped by purpose (`admin`, `catalog`, `checkout`, and `layout`).
- `src/api/` contains HTTP and guest-cart helpers.
- `src/assets/` contains imported static assets; `src/styles/` contains global styles.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Store administration

The `/admin` staff console is restricted to authenticated staff accounts and enforces permissions in the backend as well as hiding unavailable controls in the frontend. It includes order and fulfillment operations, date-range order/sales CSV exports, operational alerts, and return/refund review.

Admin product imports accept up to 500 CSV rows and an optional image ZIP (up to 50 MB). Add an optional `images` CSV column with exact ZIP paths separated by `|` (up to five images per product); supported images are JPEG, PNG, WebP, or AVIF, up to 5 MB each. The archive is limited to 2,500 files and 50 MB of uncompressed content. Rows with missing or invalid images are reported without blocking other valid rows.

## Staff roles and access

An existing `admin` account is the full-access store owner. Owners can open **Team access** from the staff console to assign one of these least-privilege roles to an existing active account:

| Role | Access |
| --- | --- |
| `support` | Read customers, orders, and invoices; read and decline return requests. Cannot approve or issue refunds, deactivate accounts, or change fulfillment. |
| `fulfillment` | Read orders and inventory; update order fulfillment status. Cannot cancel orders or access customer deactivation and refund actions. |
| `inventory_manager` | Read catalog insights and inventory; adjust stock and low-stock thresholds. Cannot edit the product catalog. |
| `finance_manager` | Read sales analytics, orders, returns, invoices, and activity; approve/retry refunds, record manual refunds, and export reports. Cannot change sales targets or deactivate customers. |
| `admin` | Full permissions, including customer deactivation, order cancellation, catalog management, sales-target changes, and staff access management. |

Role changes invalidate the account's existing authentication tokens. The console prevents changing your own role and the backend prevents demoting the last active owner. Staff access is never granted during public registration; an owner must assign it to an existing account. Backend permission checks remain authoritative even if a user bypasses the frontend.

Customers can submit one return request per delivered, paid order within 30 days of delivery. The request stores a reason and optional details. Admin approval refunds the full order total: Razorpay refunds run through the existing reconciliation job, while COD refunds must be issued manually and recorded with a refund reference. Customer return reasons and statuses are shown on the order page and in the admin console.

Low-stock notifications use each product's configured threshold (5 units when none is set). The admin console refreshes in-app notifications once per minute; no email notification provider or recipient configuration is required.

## Customer information and order updates

The storefront includes Help/FAQ, shipping, returns/refunds, privacy, and terms pages. Shipping is currently free to addresses in India. Applicable GST is included in listed prices, with no separate checkout tax line. Eligible paid orders can request a return within 30 days after delivery; requests are reviewed individually and no fixed refund timeline is promised. Privacy and terms pages are explicitly drafts and must be completed and reviewed against the operator's actual practices and applicable law before launch. Have the invoice and GST disclosures reviewed for the operator's legal and tax obligations before production.

Customers can save, edit, remove, and choose a default delivery address in Account; checkout also allows choosing a saved address. Order placement, payment, fulfillment, return, cancellation, and refund updates appear at `/notifications`. Transactional email delivery uses the existing Brevo integration and requires `BREVO_API_KEY` and `EMAIL_USER`; failed sends are retained and retried by a scheduled job. Email delivery failure does not block checkout or fulfillment.

## Coupon discounts

Owners can create and pause percentage or fixed INR coupons in **Admin → Discount coupons**, with start/expiry dates, minimum subtotal, optional maximum discount, and a total usage limit. Checkout validates coupons on the server and records the discount in the order. Coupons are platform-funded: seller commission and seller payout snapshots remain based on the pre-discount item subtotals. A coupon use is consumed when the order is created and is not automatically restored after cancellation, failed payment, or refund. Shipping remains free across India. The homepage newsletter records explicit consent and supports email-based unsubscribe; the app does not send campaigns. Product pages include a format-only India PIN check, reviews, related and recently viewed items, and back-in-stock email alerts. The PIN check does not query courier serviceability; availability and timing are confirmed at checkout. Back-in-stock alerts use the configured Brevo sender and retry after delivery failures.

## Multi-vendor marketplace

Customers can apply to sell at `/vendor`; new applications require owner review from **Admin → Vendors**. Approval assigns the vendor role and opens the seller workspace. Sellers can manage only their own products, stock, store profile, and vendor-specific fulfillment. They can view return requests but cannot approve or refund them. Public catalog results include only products belonging to approved vendors and identify the seller.

The platform remains the payment merchant: checkout charges the customer's full order through the existing platform payment flow. Each order snapshots its seller lines, effective commission, platform commission amount, and seller payable amount. The default commission is 10%; an owner may set a vendor-specific override or change the default for future orders. Existing order snapshots are not rewritten.

Before selling, an owner must use **Admin → Vendors → Set up / migrate products** once. This creates the platform-owned seller and assigns legacy products that have no vendor. New admin-created and bulk-imported products then belong to that platform store. Existing orders are not rewritten; historic orders have no seller split and are not eligible for vendor payout.

Payouts are recorded manually in **Admin → Vendor payouts** by staff with the vendor-settlement permission (admin and finance manager). The console never initiates a bank transfer. Only paid, fully delivered orders with no open return become eligible, and payout is held through the 30-day return window. The operator must transfer funds through their chosen payout process and enter its reference; the seller sees the resulting settlement record. The existing return/refund workflow is order-level, so a return currently refunds the full customer order rather than individual seller lines; the hold prevents paying out while a return is open or still within its request window.

Before handling real marketplace transactions, configure and verify payment webhooks, review applicable marketplace/tax/invoice obligations, define seller identity and payout verification processes, and decide the operational policies for shipping, disputes, and refunds. Vendor settlement is an auditable manual ledger, not an integrated payout provider. Run the existing backend test suite and frontend lint/build after deployment, then test application approval, cross-vendor catalog isolation, mixed-vendor checkout, payment webhooks, return/refund behavior, and a test payout in a non-production environment.
