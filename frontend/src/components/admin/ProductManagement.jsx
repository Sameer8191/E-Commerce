import { useEffect, useRef, useState } from "react";
import {
  Check,
  ImagePlus,
  Package,
  Pencil,
  Plus,
  Upload,
  X,
} from "lucide-react";
import api from "../../api/axios.js";
import { Badge, EmptyState } from "./AdminComponents.jsx";
import { formatMoney } from "./adminUtils.js";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  if (quoted) throw new Error("CSV has an unclosed quoted field.");

  const headers =
    rows
      .shift()
      ?.map((header) => {
        const normalized = header.replace(/^\uFEFF/, "").toLowerCase();
        return normalized === "compareatprice" ? "compareAtPrice" : normalized;
      }) || [];
  const required = ["name", "description", "price", "category", "sku"];
  if (required.some((header) => !headers.includes(header))) {
    throw new Error(`CSV must include: ${required.join(", ")}.`);
  }

  return rows.map((values) =>
    Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ""]),
    ),
  );
}

function ImagePicker({
  files,
  onChange,
  required = false,
  label = "Choose product images",
}) {
  const inputRef = useRef(null);
  return (
    <div>
      <input
        ref={inputRef}
        required={required && files.length === 0}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        onChange={(event) =>
          onChange(Array.from(event.target.files || []).slice(0, 5))
        }
        className="sr-only"
        tabIndex={-1}
        aria-label={label}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-2 inline-flex h-9 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
      >
        <ImagePlus size={15} />
        {label}
      </button>
      <p className="mt-1 text-[11px] text-slate-500" aria-live="polite">
        {files.length
          ? `${files.length} image${files.length === 1 ? "" : "s"} selected: ${files.map((file) => file.name).join(", ")}`
          : required
            ? "Select 1–5 images, each up to 5 MB."
            : "No replacement selected; current images will stay."}
      </p>
    </div>
  );
}

function SingleProductForm({ categories, onCreated }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    compareAtPrice: "",
    category: "",
    brand: "",
    stock: "0",
    sku: "",
    variants: "",
  });

  const updateField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      images.forEach((image) => body.append("images", image));
      const response = await api.post("/products", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm({
        name: "",
        description: "",
        price: "",
        compareAtPrice: "",
        category: "",
        brand: "",
        stock: "0",
        sku: "",
        variants: "",
      });
      setImages([]);
      event.target.reset();
      onCreated(response.data?.message || "Product created successfully.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Could not create product.",
      );
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-normal outline-none focus:border-indigo-400";

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
          <Plus size={18} />
        </span>
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Create one product
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Add product details and at least one image to your catalog.
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700"
        >
          {error}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-700">
          Product name
          <input
            required
            maxLength={150}
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          SKU
          <input
            required
            value={form.sku}
            onChange={(event) => updateField("sku", event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Price
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(event) => updateField("price", event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Compare-at price
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.compareAtPrice}
            onChange={(event) =>
              updateField("compareAtPrice", event.target.value)
            }
            className={inputClass}
          />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Category
          <select
            required
            value={form.category}
            onChange={(event) => updateField("category", event.target.value)}
            className={inputClass}
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Brand
          <input
            value={form.brand}
            onChange={(event) => updateField("brand", event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Opening stock
          <input
            required
            type="number"
            min="0"
            step="1"
            value={form.stock}
            onChange={(event) => updateField("stock", event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Options (optional, comma-separated)<input maxLength={1000} placeholder="Example: Small, Medium, Large" value={form.variants} onChange={(event) => updateField("variants", event.target.value)} className={inputClass} /><small className="font-normal text-slate-400">All options share this product’s price and stock.</small></label>
        <label className="text-xs font-semibold text-slate-700">
          Product images
          <ImagePicker files={images} onChange={setImages} required />
          <small className="font-normal text-slate-400">
            Choose 1–5 images, each up to 5 MB.
          </small>
        </label>
        <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
          Description
          <textarea
            required
            rows="3"
            value={form.description}
            onChange={(event) => updateField("description", event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal outline-none focus:border-indigo-400"
          />
        </label>
      </div>

      <button
        disabled={saving || images.length === 0}
        className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? "Creating…" : "Create product"}
      </button>
    </form>
  );
}

function BulkProductUpload({ onNotice, onImported }) {
  const [csvFile, setCsvFile] = useState(null);
  const [imagesZip, setImagesZip] = useState(null);
  const [busy, setBusy] = useState(false);

  const importProducts = async () => {
    if (!csvFile) {
      onNotice("Choose a CSV file to import.");
      return;
    }
    if (csvFile.size > 1024 * 1024) {
      onNotice("CSV file must be 1 MB or smaller.");
      return;
    }

    setBusy(true);
    try {
      const products = parseCsv(await csvFile.text());
      const body = new FormData();
      body.append("products", JSON.stringify(products));
      if (imagesZip) body.append("imagesZip", imagesZip);
      const response = await api.post("/admin/catalog/products/bulk", body, {
        timeout: 300000,
        headers: { "Content-Type": "multipart/form-data" },
      });
      const result = response.data?.data || {};
      const rowErrors = result.errors || [];
      const errorSummary = rowErrors
        .slice(0, 5)
        .map(
          (item) =>
            `Row ${item.row}${item.sku ? ` (${item.sku})` : ""}: ${item.message}`,
        )
        .join(" · ");

      onNotice(
        `${result.imported || 0} products imported${rowErrors.length ? `; ${rowErrors.length} row(s) need attention. ${errorSummary}${rowErrors.length > 5 ? ` · plus ${rowErrors.length - 5} more` : ""}` : "."}`,
      );
      if (!rowErrors.length) {
        setCsvFile(null);
        setImagesZip(null);
      }
      if (result.imported > 0) onImported();
    } catch (requestError) {
      const details = requestError.response?.data?.data?.errors;
      const detailText = details
        ?.slice(0, 5)
        .map(
          (item) =>
            `Row ${item.row}${item.sku ? ` (${item.sku})` : ""}: ${item.message}`,
        )
        .join(" · ");
      onNotice(
        details?.length
          ? `${requestError.response?.data?.message}: ${detailText}${details.length > 5 ? ` · plus ${details.length - 5} more row errors` : ""}`
          : requestError.response?.data?.message ||
              requestError.message ||
              "Product import failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <Upload size={18} />
        </span>
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Bulk upload products
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Import up to 500 products from a CSV file, with an optional ZIP
            archive of product images.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm leading-7 text-slate-600">
        <p>
          <b className="text-slate-800">Required columns:</b> name, description,
          price, category, sku
        </p>
        <p>
          <b className="text-slate-800">Optional columns:</b> stock,
          compareAtPrice, brand, images
        </p>
        <p>
          Put image file names in the <b>images</b> column, separated by |.
          Names must match files in the ZIP (including folders), with up to 5
          images per product. Images must be JPEG, PNG, WebP, or AVIF and up to
          5 MB each.
        </p>
        <a
          className="font-semibold text-indigo-700 hover:underline"
          href={`data:text/csv;charset=utf-8,${encodeURIComponent("name,description,price,category,sku,stock,compareAtPrice,brand,images\nCotton tote,Reusable cotton shopping tote,499,bags,COTTON-TOTE-01,20,699,Goodthings,")}`}
          download="products-template.csv"
        >
          Download CSV template
        </a>
      </div>

      <label className="mt-4 block text-sm font-semibold text-slate-700">
        CSV file
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => setCsvFile(event.target.files?.[0] || null)}
          className="mt-2 block w-full rounded-lg border border-slate-200 p-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-700"
        />
      </label>

      <label className="mt-4 block text-sm font-semibold text-slate-700">
        Product images ZIP (optional, max 50 MB)
        <input
          type="file"
          accept=".zip,application/zip"
          onChange={(event) => setImagesZip(event.target.files?.[0] || null)}
          className="mt-2 block w-full rounded-lg border border-slate-200 p-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-700"
        />
      </label>

      <button
        type="button"
        disabled={!csvFile || busy}
        onClick={importProducts}
        className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {busy ? "Importing…" : "Import products"}
      </button>
      <p className="mt-4 text-xs leading-5 text-slate-500">
        SKUs must be unique, and each row must reference an active category by
        name, slug, or ID. Invalid rows include their line number and reason.
        ZIP imports are limited to 50 MB total and 2,500 image files.
      </p>
    </article>
  );
}

function ProductEditor({ product, categories, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState([]);
  const [form, setForm] = useState({
    name: product.name || "",
    description: product.description || "",
    price: product.price ?? "",
    compareAtPrice: product.compareAtPrice ?? "",
    category: product.category?._id || product.category || "",
    brand: product.brand || "",
    stock: product.stock ?? 0,
    sku: product.sku || "",
    isActive: Boolean(product.isActive),
    variants: Array.isArray(product.variants) ? product.variants.join(", ") : "",
  });
  const updateField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));
  const inputClass =
    "mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-normal outline-none focus:border-indigo-400";

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      images.forEach((image) => body.append("images", image));
      const response = await api.put(`/products/${product._id}`, body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onSaved(response.data?.message || "Product updated successfully.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Could not update product.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="my-auto w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-product-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="edit-product-title"
              className="text-lg font-bold text-slate-900"
            >
              Edit product
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Update product details, inventory, or replace its images.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Close editor"
          >
            <X size={18} />
          </button>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700"
          >
            {error}
          </p>
        )}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700">
            Product name
            <input
              required
              maxLength={150}
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            SKU
            <input
              required
              value={form.sku}
              onChange={(event) => updateField("sku", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Price
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(event) => updateField("price", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Compare-at price
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.compareAtPrice}
              onChange={(event) =>
                updateField("compareAtPrice", event.target.value)
              }
              className={inputClass}
            />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Category
            <select
              required
              value={form.category}
              onChange={(event) => updateField("category", event.target.value)}
              className={inputClass}
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Brand
            <input
              value={form.brand}
              onChange={(event) => updateField("brand", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Stock
            <input
              required
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={(event) => updateField("stock", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Options (optional, comma-separated)<input maxLength={1000} placeholder="Example: Small, Medium, Large" value={form.variants} onChange={(event) => updateField("variants", event.target.value)} className={inputClass} /><small className="font-normal text-slate-400">All options share this product’s price and stock.</small></label>
          <label className="text-xs font-semibold text-slate-700">
            Replace images (optional)
            <ImagePicker
              files={images}
              onChange={setImages}
              label="Choose replacement images"
            />
          </label>
          <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
            Description
            <textarea
              required
              rows="3"
              value={form.description}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal outline-none focus:border-indigo-400"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                updateField("isActive", event.target.checked)
              }
              className="size-4 rounded border-slate-300 text-indigo-600"
            />
            Product is active and visible in the catalog
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-600"
          >
            Cancel
          </button>
          <button
            disabled={saving}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? (
              "Saving…"
            ) : (
              <>
                <Check size={14} />
                Save changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function RecentProducts({ products = [], onEdit }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-bold text-slate-900">
          Recently added products
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Latest items in your catalog
        </p>
      </div>
      {products.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[660px] text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product._id} className="border-t border-slate-100">
                  <td className="px-5 py-3 text-xs font-semibold text-slate-800">
                    {product.name}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {product.sku}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {formatMoney(product.price)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {product.stock}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        product.isActive
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : "bg-slate-100 text-slate-600 ring-slate-200"
                      }
                    >
                      {product.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onEdit(product)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
                    >
                      <Pencil size={12} />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Package}
          title="No products yet"
          detail="New products will appear here."
        />
      )}
    </div>
  );
}

export default function ProductManagement({ catalog, onNotice, onRefresh, isVendor = false }) {
  const [categories, setCategories] = useState([]);
  const [categoryError, setCategoryError] = useState("");
  const [editingProduct, setEditingProduct] = useState(null);

  useEffect(() => {
    api
      .get("/category?limit=100")
      .then((response) => setCategories(response.data?.data || []))
      .catch(() =>
        setCategoryError(
          "Could not load categories. Create a category in Catalog insights first.",
        ),
      );
  }, []);

  const handleCreated = (message) => {
    onNotice(message);
    onRefresh();
  };

  return (
    <section className="grid gap-5">
      {categoryError && (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700"
        >
          {categoryError}
        </p>
      )}
      {isVendor ? (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <SingleProductForm categories={categories} onCreated={handleCreated} />
          <RecentProducts
            products={catalog?.recentProducts}
            onEdit={setEditingProduct}
          />
        </div>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-2">
            <SingleProductForm categories={categories} onCreated={handleCreated} />
            <BulkProductUpload onNotice={onNotice} onImported={onRefresh} />
          </div>
          <RecentProducts
            products={catalog?.recentProducts}
            onEdit={setEditingProduct}
          />
        </>
      )}
      {editingProduct && (
        <ProductEditor
          product={editingProduct}
          categories={categories}
          onClose={() => setEditingProduct(null)}
          onSaved={(message) => {
            setEditingProduct(null);
            onNotice(message);
            onRefresh();
          }}
        />
      )}
    </section>
  );
}
