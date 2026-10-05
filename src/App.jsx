import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import Dashboard from './pages/Admin/Dashboard';
import ProductsPage from './pages/Admin/ProductsPage';
import ReportsPage from './pages/Admin/ReportsPage';
import CartPage from './pages/CartPage';
import OrderSessionsPage from './pages/Admin/OrderSessionsPage'; // Ensure this component exists
import TelegramSettingsPage from './pages/Admin/TelegramSettingsPage'; // Ensure this component exists
// Import your Order Sessions component if you have it, e.g.:
// import OrderSessionsPage from './pages/Admin/OrderSessionsPage';

function App() {
  return (
    <Router>
      <Routes>
        {/* Customer / Mini App View */}
        <Route path="/" element={<CartPage />} />

        {/* Admin Dashboard Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="sessions" element={<OrderSessionsPage />} />
          <Route path="order-sessions" element={<OrderSessionsPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="/admin/telegram-settings" element={<TelegramSettingsPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;