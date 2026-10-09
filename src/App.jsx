import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import Dashboard from './pages/Admin/Dashboard';
import ProductsPage from './pages/Admin/ProductsPage';
import ReportsPage from './pages/Admin/ReportsPage';
import OrderSessionsPage from './pages/Admin/OrderSessionsPage';
import TelegramSettingsPage from './pages/Admin/TelegramSettingsPage';
import CartPage from './pages/CartPage';
import LoginPage from './pages/Admin/LoginPage';
import RegisterPage from './pages/Admin/RegisterPage';
import MyOrderPage from './pages/MiniApp/MyOrderPage';
import MiniAppProductsPage from './pages/MiniApp/ProductsPage';

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
        </Route>

        {/* Explicit Customer Menu Fallback Route */}
        <Route path="/menu" element={<MiniAppProductsPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/my-order" element={<MyOrderPage />} />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;