import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { getTelegramUser } from '../../utils/telegram';

export default function MiniAppProductsPage() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    setUser(getTelegramUser());
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [catRes, prodRes] = await Promise.all([
        api.get('/api/mini-app/categories'),
        api.get('/api/mini-app/products')
      ]);
      setCategories(catRes.data.data || catRes.data);
      setProducts(prodRes.data.data || prodRes.data);
    } catch (err) {
      console.error('Failed to load menu items', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId, delta) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean);
    });
  };

  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter((p) => p.category_id === selectedCategory);

  const totalCartPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 text-gray-500 text-sm">
        Loading Cafe Menu...
      </div>
    );
  }

  return (
    <div className="pb-28 bg-gray-50 min-h-screen text-gray-800">
      {/* Header / User Greeting */}
      <div className="bg-emerald-600 text-white p-4 shadow-md sticky top-0 z-20 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold">☕ Cafe Menu</h1>
          <p className="text-xs text-emerald-100">Welcome, {user?.first_name || 'Guest'}!</p>
        </div>
        <div className="bg-emerald-700 px-3 py-1 rounded-full text-xs font-semibold">
          Active Session
        </div>
      </div>

      {/* Category Horizontal Bar */}
      <div className="flex overflow-x-auto px-4 py-3 bg-white shadow-xs gap-2 no-scrollbar sticky top-14 z-10">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
            selectedCategory === 'all' 
              ? 'bg-emerald-600 text-white shadow' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All Items
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              selectedCategory === cat.id 
                ? 'bg-emerald-600 text-white shadow' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div className="p-4 grid grid-cols-2 gap-3 max-w-lg mx-auto">
        {filteredProducts.map((product) => {
          const cartItem = cart.find((item) => item.id === product.id);
          return (
            <div key={product.id} className="bg-white rounded-xl shadow-xs border border-gray-100 overflow-hidden flex flex-col justify-between">
              <div>
                {product.image_url && (
                  <img src={product.image_url} alt={product.name} className="w-full h-28 object-cover" />
                )}
                <div className="p-3">
                  <h3 className="font-bold text-sm text-gray-800 line-clamp-1">{product.name}</h3>
                  <p className="text-xs text-emerald-600 font-semibold mt-1">${Number(product.price).toFixed(2)}</p>
                </div>
              </div>
              
              <div className="p-3 pt-0">
                {cartItem ? (
                  <div className="flex items-center justify-between bg-emerald-50 rounded-lg p-1 border border-emerald-200">
                    <button 
                      onClick={() => handleUpdateQuantity(product.id, -1)}
                      className="w-7 h-7 bg-white text-emerald-700 font-bold rounded-md shadow-xs flex items-center justify-center text-sm"
                    >
                      -
                    </button>
                    <span className="text-xs font-bold text-emerald-800">{cartItem.quantity}</span>
                    <button 
                      onClick={() => handleUpdateQuantity(product.id, 1)}
                      className="w-7 h-7 bg-emerald-600 text-white font-bold rounded-md shadow-xs flex items-center justify-center text-sm"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleAddToCart(product)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 rounded-lg shadow transition"
                  >
                    + Add to Cart
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Bottom Cart Bar */}
      {totalCartItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-30 max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">{totalCartItems} items selected</p>
            <p className="text-base font-bold text-gray-800">${totalCartPrice.toFixed(2)}</p>
          </div>
          <button 
            onClick={() => alert('Proceeding to Checkout! (Step 2)')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow transition"
          >
            View Cart & Checkout ➔
          </button>
        </div>
      )}
    </div>
  );
}