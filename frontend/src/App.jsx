import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/storefront/HomePage.jsx'
import LoginPage from './pages/account/LoginPage.jsx'
import OrdersPage from './pages/orders/OrdersPage.jsx'
import SignupPage from './pages/account/SignupPage.jsx'
import ProductsPage from './pages/catalog/ProductsPage.jsx'
import ProductDetailsPage from './pages/catalog/ProductDetailsPage.jsx'
import CartPage from './pages/cart/CartPage.jsx'
import ProfilePage from './pages/account/ProfilePage.jsx'
import WishlistPage from './pages/catalog/WishlistPage.jsx'
import PasswordResetPage from './pages/account/PasswordResetPage.jsx'
import AboutPage from './pages/info/AboutPage.jsx'
import CustomerInfoPage from './pages/info/CustomerInfoPage.jsx'
import NotificationsPage from './pages/account/NotificationsPage.jsx'
import PrivacyPage from './pages/account/PrivacyPage.jsx'
import ContactPage from './pages/info/ContactPage.jsx'
import api from './api/axios.js'
import './styles/theme.css'

const AdminPage = lazy(() => import('./pages/admin/AdminPage.jsx'))
const VendorPortalPage = lazy(() => import('./pages/marketplace/VendorPortalPage.jsx'))
const VendorStorefrontPage = lazy(() => import('./pages/marketplace/VendorStorefrontPage.jsx'))

function WorkspaceLoading() {
  return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Loading workspace…</div>
}

function VisitorTracker() {
  useEffect(() => {
    if (window.location.pathname === '/admin') return
    let visitorId = window.sessionStorage.getItem('goodthingsVisitorId')
    if (!visitorId) {
      visitorId = window.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => { const random = Math.random() * 16 | 0; return (character === 'x' ? random : (random & 3 | 8)).toString(16) })
      window.sessionStorage.setItem('goodthingsVisitorId', visitorId)
    }
    api.post('/analytics/visit', { visitorId }).catch(() => {})
  }, [])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-theme">
        <VisitorTracker />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/vendor/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/vendor/signup" element={<SignupPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/account" element={<ProfilePage />} />
          <Route path="/account/privacy" element={<PrivacyPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/password-reset" element={<PasswordResetPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/help" element={<CustomerInfoPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/policies/:policy" element={<CustomerInfoPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/:productId" element={<ProductDetailsPage />} />
          <Route path="/store/:slug" element={<Suspense fallback={<WorkspaceLoading />}><VendorStorefrontPage /></Suspense>} />
          <Route path="/admin" element={<Suspense fallback={<WorkspaceLoading />}><AdminPage /></Suspense>} />
          <Route path="/vendor" element={<Suspense fallback={<WorkspaceLoading />}><VendorPortalPage /></Suspense>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
