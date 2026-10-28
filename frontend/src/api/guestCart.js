const CART_KEY = 'guestCart'
const CART_ID_KEY = 'guestCartId'
const CART_EVENT = 'goodthings:cart-updated'

export function getGuestCart() {
  const saved = window.localStorage.getItem(CART_KEY)
  if (!saved) return []
  let items
  try {
    items = JSON.parse(saved)
  } catch (error) {
    window.localStorage.removeItem(CART_KEY)
    console.error('Saved guest cart could not be parsed and was cleared.', error)
    return []
  }
  if (!Array.isArray(items)) {
    window.localStorage.removeItem(CART_KEY)
    console.error('Saved guest cart was invalid and has been cleared.')
    return []
  }
  return items
}

function saveGuestCart(items) {
  window.localStorage.setItem(CART_KEY, JSON.stringify(items))
  window.dispatchEvent(new Event(CART_EVENT))
}

export function addGuestCartItem(product, quantity = 1, variant = '') {
  if (!product?._id || !Number.isSafeInteger(quantity) || quantity < 1) {
    throw new Error('A valid product and quantity are required.')
  }
  const items = getGuestCart()
  const existing = items.find((item) => item.product?._id === product._id && (item.variant || '') === variant)
  const nextQuantity = (existing?.quantity || 0) + quantity
  const usedStock = items.filter((item) => item.product?._id === product._id).reduce((sum, item) => sum + item.quantity, 0)
  if (usedStock + quantity > Number(product.stock)) {
    throw new Error('Requested quantity exceeds available stock.')
  }
  if (existing) existing.quantity = nextQuantity
  else items.push({ product, variant, quantity })
  saveGuestCart(items)
}

export function updateGuestCartItem(productId, quantity, variant = '') {
  const items = getGuestCart()
  if (!Number.isSafeInteger(quantity)) {
    throw new Error('Cart quantity must be a whole number.')
  }
  const existing = items.find((item) => item.product?._id === productId && (item.variant || '') === variant)
  const otherStock = items.filter((item) => item.product?._id === productId && (item.variant || '') !== variant).reduce((sum, item) => sum + item.quantity, 0)
  if (quantity + otherStock > Number(existing?.product?.stock)) {
    throw new Error('Requested quantity exceeds available stock.')
  }
  const nextItems = quantity < 1
    ? items.filter((item) => !(item.product?._id === productId && (item.variant || '') === variant))
    : items.map((item) => item.product?._id === productId && (item.variant || '') === variant ? { ...item, quantity } : item)
  saveGuestCart(nextItems)
}

export function clearGuestCart() {
  saveGuestCart([])
  window.localStorage.removeItem(CART_ID_KEY)
}

export function getGuestCartId() {
  let id = window.localStorage.getItem(CART_ID_KEY)
  if (!id) {
    id = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(CART_ID_KEY, id)
  }
  return id
}

export async function mergeGuestCartToAccount(api) {
  const items = getGuestCart()
  if (!items.length) return false
  await api.post('/cart/merge-guest', {
    guestCartId: getGuestCartId(),
    items: items.map((item) => ({
      productId: item.product?._id,
      variant: item.variant || '',
      quantity: item.quantity,
    })),
  })
  clearGuestCart()
  return true
}

export function guestCartEventName() {
  return CART_EVENT
}
