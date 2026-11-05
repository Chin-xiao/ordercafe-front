import React, { useState } from 'react';
import { formatRiel } from '../../utils/currency';

export const ProductImage = React.memo(function ProductImage({ product, eager = false }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  
  if (!product?.image_url || failed) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-stone-100 text-xs text-stone-400" aria-label={`Image unavailable for ${product?.name || 'item'}`}>
        Image unavailable
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
      {!loaded && <div aria-hidden="true" className="absolute inset-0 bg-stone-100" />}
      <img
        src={product.image_url}
        alt={product.name}
        width="480"
        height="360"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={eager ? 'high' : 'auto'}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
});

export default function ProductGrid({
  products = [],
  loading = false,
  error = null,
  search = '',
  orderingOpen = true,
  cartByProduct = new Map(),
  onProductClick = () => {},
  onRetryMenu = () => {}
}) {
  // Safely handle cartByProduct even if it's passed as a plain object or undefined
  const cartMap = cartByProduct instanceof Map 
    ? cartByProduct 
    : new Map(Object.entries(cartByProduct || {}));

  if (loading && products.length === 0) {
    return (
      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:gap-4">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="overflow-hidden rounded-2xl border border-stone-200 bg-white" aria-hidden="true">
            <div className="aspect-[4/3] bg-stone-100" />
            <div className="space-y-2 p-3">
              <div className="h-4 w-3/4 rounded bg-stone-100" />
              <div className="h-3 w-1/3 rounded bg-stone-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-semibold text-red-800">Server Error</p>
          <p className="mt-1 text-xs text-red-600">{error.message || 'Unable to load products for this store.'}</p>
          <button
            onClick={onRetryMenu}
            className="mt-4 rounded-xl bg-red-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-800"
          >
            Retry menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:gap-4">
      {products.map((product, index) => {
        const unavailable = product.is_available === false;
        const productIdStr = String(product.id);
        const cartItems = cartMap.get(productIdStr);

        return (
          <article key={product.id} className={`flex flex-col justify-between overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${unavailable ? 'border-stone-200 opacity-75' : 'border-stone-100'}`}>
            <div>
              <div className="relative">
                <ProductImage key={product.image_url} product={product} eager={index < 2} />
                {unavailable && (
                  <span className="absolute left-2 top-2 rounded-full bg-stone-900/80 px-2.5 py-1 text-[10px] font-semibold text-white">
                    Unavailable
                  </span>
                )}
              </div>
              <div className="p-3 sm:p-4">
                <h2 className="line-clamp-2 min-h-10 text-sm font-bold text-stone-900">{product.name}</h2>
                {product.description && <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-relaxed text-stone-500">{product.description}</p>}
                <p className="mt-2 text-sm font-bold text-emerald-700">{formatRiel(product.price)}</p>
                <p className={`mt-1 text-[11px] font-medium ${unavailable ? 'text-red-700' : 'text-stone-500'}`}>
                  {unavailable ? 'Currently unavailable' : product.is_available === true ? 'Available' : 'Availability not provided'}
                </p>
              </div>
            </div>
            <div className="p-3 pt-0">
              {cartItems && cartItems.length > 0 && (
                <p className="mb-2 text-[11px] text-stone-500">
                  In cart: {cartItems
                    .map((item) => item.sugar_percent !== null && item.sugar_percent !== undefined ? `${item.sugar_percent}% × ${item.quantity}` : `${item.quantity}`)
                    .join(' · ')}
                </p>
              )}
              <button
                onClick={() => onProductClick(product)}
                disabled={!orderingOpen || unavailable}
                className="w-full min-h-11 rounded-xl bg-emerald-700 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                {unavailable ? 'Unavailable' : product.requires_sugar ? '+ Choose Sugar & Add' : '+ Add to Order'}
              </button>
            </div>
          </article>
        );
      })}
      {products.length === 0 && !error && (
        <div className="col-span-full py-12 text-center">
          <p className="text-sm font-medium text-stone-600">No products are available in this store yet.</p>
          <p className="mt-1 text-xs text-stone-400">Add products from your admin panel to start selling.</p>
        </div>
      )}
    </div>
  );
}