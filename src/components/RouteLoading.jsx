// src/components/RouteLoading.jsx — used as the <Suspense> fallback
import React, { useEffect, useState } from 'react';
import CoffeeLoader from './CoffeeLoader';

export default function RouteLoading() {
  // Wait a moment first, so fast page loads never flash the loader
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(id);
  }, []);

  if (!visible) return <div className="min-h-screen bg-white" aria-hidden="true" />;
  return <CoffeeLoader />;
}