import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const Dashboard = lazy(() => import('./pages/Admin/Dashboard'));
const ProductsPage = lazy(() => import('./pages/Admin/ProductsPage'));
const ReportsPage = lazy(() => import('./pages/Admin/ReportsPage'));
const OrderSessionsPage = lazy(() => import('./pages/Admin/OrderSessionsPage'));
const TelegramSettingsPage = lazy(() => import('./pages/Admin/TelegramSettingsPage'));
const TelegramCustomersPage = lazy(() => import('./pages/Admin/TelegramCustomersPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const LoginPage = lazy(() => import('./pages/Admin/LoginPage'));
const RegisterPage = lazy(() => import('./pages/Admin/RegisterPage'));
const MyOrderPage = lazy(() => import('./pages/MiniApp/MyOrderPage'));
const MiniAppProductsPage = lazy(() => import('./pages/MiniApp/ProductsPage'));
const UsersPage = lazy(() => import('./pages/Admin/UsersPage'));
const StoresManagementPage = lazy(() => import('./pages/SuperAdmin/StoresManagementPage'));

function RouteLoading() {
  const { pathname } = useLocation();
  if (pathname === '/' || pathname === '/menu') {
    return (
      <main className="min-h-screen bg-gray-50 text-gray-800">
        <header className="flex h-14 items-center justify-between bg-emerald-700 px-4 text-white">
          <div className="h-4 w-36 animate-pulse rounded bg-emerald-600" />
          <div className="h-7 w-24 animate-pulse rounded-full bg-emerald-600" />
        </header>
        <div className="mx-auto max-w-3xl p-4">
          <div className="mb-4 h-12 animate-pulse rounded-xl bg-white" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
                <div className="aspect-[4/3] bg-stone-100" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-3/4 rounded bg-stone-100" />
                  <div className="h-3 w-1/3 rounded bg-stone-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <div role="status" className="flex min-h-screen items-center justify-center bg-stone-50 text-sm text-stone-500">
      Loading page…
    </div>
  );
}

// Helper to check if the app is running inside Telegram
const isTelegramMiniApp = () => {
  return window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData;
};

// Smart Root Component: Telegram users see the shop; regular browsers go to Login
const SmartRoot = () => {
  if (isTelegramMiniApp()) {
    return <MiniAppProductsPage />;
  }
  return <Navigate to="/admin/login" replace />;
};

function App() {
  return (
    <Router>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          {/* Smart Root (Telegram -> Mini App | Browser -> Admin Login) */}
          <Route path="/" element={<SmartRoot />} />

          {/* Public Admin Authentication Routes */}
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin/register" element={<RegisterPage />} />

          {/* Admin Dashboard Routes (Protected layout) */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="sessions" element={<OrderSessionsPage />} />
            <Route path="order-sessions" element={<OrderSessionsPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="telegram-settings" element={<TelegramSettingsPage />} />
            <Route path="telegram-customers" element={<TelegramCustomersPage />} />
            
            {/* NEW: SuperAdmin Stores Management Route */}
            <Route path="stores" element={<StoresManagementPage />} />
          </Route>
          
          <Route path="/admin/users" element={<UsersPage />} />

          {/* Explicit Customer Menu Fallback Route */}
          <Route path="/menu" element={<MiniAppProductsPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/my-order" element={<MyOrderPage />} />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;