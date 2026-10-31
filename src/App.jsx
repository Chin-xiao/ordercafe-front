import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import RouteLoading from './components/RouteLoading';

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

            {/* SuperAdmin pages */}
            <Route path="stores" element={<StoresManagementPage />} />
            <Route path="users" element={<UsersPage />} />
          </Route>

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