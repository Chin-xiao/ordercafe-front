// src/store/useCartStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../api/axios';

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [], // Format: { product_id, name, price, quantity, image_url }
      activeSession: null,
      loading: false,
      error: null,

      // Add or increment item
      addItem: (product) => {
        set((state) => {
          const existingIndex = state.items.findIndex((item) => item.product_id === product.id);
          
          if (existingIndex > -1) {
            const newItems = [...state.items];
            newItems[existingIndex].quantity += 1;
            return { items: newItems };
          }

          return {
            items: [
              ...state.items,
              {
                product_id: product.id,
                name: product.name,
                price: Number(product.price),
                image_url: product.image_url,
                quantity: 1,
              },
            ],
          };
        });
      },

      // Decrement or remove item
      removeItem: (productId) => {
        set((state) => {
          const existingIndex = state.items.findIndex((item) => item.product_id === productId);
          if (existingIndex === -1) return state;

          const newItems = [...state.items];
          if (newItems[existingIndex].quantity > 1) {
            newItems[existingIndex].quantity -= 1;
            return { items: newItems };
          }

          // Remove entirely if quantity hits 0
          return { items: newItems.filter((item) => item.product_id !== productId) };
        });
      },

      clearCart: () => set({ items: [] }),

      // Getters/Computations
      getTotalItemsCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      getTotalAmount: () => {
        return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      },

      // Fetch active session from Laravel
      fetchActiveSession: async () => {
        try {
          const response = await api.get('/mini-app/order-session/current');
          set({ activeSession: response.data.data || response.data });
        } catch (err) {
          console.error('Failed to fetch active order session', err);
        }
      },

      // Submit order to Laravel backend (Prices recalculated securely on server)
      submitOrder: async () => {
        const state = get();
        if (!state.activeSession) throw new Error('No active order session found.');
        if (state.items.length === 0) throw new Error('Your cart is empty.');

        set({ loading: true, error: null });

        try {
          const payload = {
            order_session_id: state.activeSession.id,
            items: state.items.map((item) => ({
              product_id: item.product_id,
              quantity: item.quantity,
            })),
          };

          const response = await api.post('/mini-app/orders', payload);
          set({ items: [], loading: false }); // Clear cart on success
          return response.data.data;
        } catch (err) {
          const errorMessage = err.response?.data?.message || err.response?.data?.errors?.items?.[0] || 'Failed to submit order.';
          set({ error: errorMessage, loading: false });
          throw new Error(errorMessage);
        }
      },
    }),
    {
      name: 'cafe-cart-storage', // Saves cart state locally in sessionStorage/localStorage
    }
  )
);