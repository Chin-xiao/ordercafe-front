import React, { useState } from 'react';
import { formatRiel } from '../../utils/currency';
import { Icon, Skeleton, SkeletonStyles } from '../ui';

// Still exported by name in case another file imports it
export const ProductImage = React.memo(function ProductImage({ product, eager = false, square = false, className = '' }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const ratio = square ? 'aspect-square' : 'aspect-[4/3]';

  if (!product?.image_url || failed) {
    return (
      <div
        className={`flex ${ratio} w-full flex-col items-center justify-center gap-1 bg-stone-100 text-stone-300 ${className}`}
        role="img"
        aria-label={`Image unavailable for ${product?.name || 'item'}`}
      >
        <Icon name="cup" size={square ? 40 : 32} />
        <span className="text-[11px] text-stone-400">No photo</span>
      </div>
    );
  }

  return (
    <div className={`relative ${ratio} w-full overflow-hidden bg-stone-100 ${className}`}>
      {!loaded && <div aria-hidden="true" className="absolute inset-0 bg-stone-100" />}
      <img
        src={product.image_url}
        alt={product.name}
        width="480"
        height={square ? '480' : '360'}
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

function ProductCard({ product, index, orderingOpen, entries, onProductClick, onDecrease }) {
  const inCart = entries.reduce((sum, item) => sum + item.quantity, 0);
  const unavailable = product.is_available === false;
  const disabled = !orderingOpen || unavailable;
  const needsSugar = Boolean(product.requires_sugar);
  // Drinks without a sugar choice can be changed right on the card
  const simpleEntry = !needsSugar ? entries.find((item) => item.cart_id === `${product.id}:nosugar`) : null;
  const sugarEntries = entries.filter((item) => item.sugar_percent !== null && item.sugar_percent !== undefined);

  return (
    <li className={`flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-200/70 ${unavailable ? 'opacity-80' : ''}`}>
      <button
        type="button"
        onClick={() => onProductClick(product)}
        disabled={disabled}
        aria-label={needsSugar ? `Choose sugar for ${product.name}` : `Add ${product.name}`}
        className="relative block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ef5a3c] disabled:cursor-not-allowed"
      >
        <ProductImage key={product.image_url} product={product} eager={index < 2} square className={unavailable ? 'grayscale' : ''} />
        {inCart > 0 && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-[#ef5a3c] px-2.5 py-1 text-xs font-bold text-white shadow">
            {inCart} in cart
          </span>
        )}
        {unavailable && (
          <span className="absolute inset-x-0 bottom-2.5 mx-auto w-fit rounded-full bg-stone-900/80 px-3 py-1 text-xs font-semibold text-white">
            Unavailable
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-stone-900">{product.name}</h3>
        {product.description && <p className="mt-0.5 line-clamp-1 text-xs text-stone-500">{product.description}</p>}
        {sugarEntries.length > 0 && (
          <p className="mt-1 text-[11px] font-medium text-[#d4401f]">
            In cart: {sugarEntries.map((item) => `${item.sugar_percent}% × ${item.quantity}`).join(' · ')}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="text-base font-bold text-stone-900">{formatRiel(product.price)}</span>

          {unavailable ? (
            <span className="text-xs font-medium text-stone-400">Currently unavailable</span>
          ) : simpleEntry ? (
            <div className="flex items-center rounded-full bg-stone-100 p-0.5">
              <button
                type="button"
                onClick={() => onDecrease(product)}
                disabled={disabled}
                aria-label={`Remove one ${product.name}`}
                className="flex h-9 w-9 items-center justify-center rounded-full text-stone-700 hover:bg-stone-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c] disabled:opacity-40"
              >
                <Icon name={simpleEntry.quantity === 1 ? 'trash' : 'minus'} size={16} />
              </button>
              <span aria-live="polite" className="w-7 text-center text-sm font-bold text-stone-900">{simpleEntry.quantity}</span>
              <button
                type="button"
                onClick={() => onProductClick(product)}
                disabled={disabled || simpleEntry.quantity >= 100}
                aria-label={`Add one ${product.name}`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ef5a3c] text-white hover:bg-[#dc4a2c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c] focus-visible:ring-offset-1 disabled:opacity-40"
              >
                <Icon name="plus" size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onProductClick(product)}
              disabled={disabled}
              aria-label={needsSugar ? `Choose sugar for ${product.name}` : `Add ${product.name}`}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ef5a3c] text-white shadow-sm transition-colors hover:bg-[#dc4a2c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c] focus-visible:ring-offset-2 disabled:bg-stone-200 disabled:text-stone-400 disabled:shadow-none"
            >
              <Icon name="plus" size={20} />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export default function ProductGrid({
  products = [],
  loading = false,
  error = null,
  search = '',
  orderingOpen = true,
  cartByProduct = new Map(),
  onProductClick = () => {},
  onDecrease = () => {},
  onRetryMenu,
}) {
  // Safely handle cartByProduct even if it's passed as a plain object or undefined
  const cartMap = cartByProduct instanceof Map
    ? cartByProduct
    : new Map(Object.entries(cartByProduct || {}));

  const wrap = 'mx-auto grid max-w-3xl grid-cols-2 gap-3 px-4 pt-2 sm:grid-cols-3';

  if (loading && products.length === 0) {
    return (
      <div role="status" aria-busy="true" className={wrap}>
        <SkeletonStyles />
        <span className="sr-only">Loading menu…</span>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="overflow-hidden rounded-3xl bg-white ring-1 ring-stone-200/70">
            <Skeleton className="aspect-square w-full !rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-5 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    if (error) {
      // The menu page already shows the error with a retry button.
      // If a parent passes onRetryMenu instead, show the panel here.
      if (!onRetryMenu) return null;
      const message = typeof error === 'string' ? error : error?.message;
      return (
        <div className="mx-auto max-w-md p-8 text-center">
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-sm font-semibold text-red-800">Could not load the menu</p>
            <p className="mt-1 text-sm text-red-700">{message || 'Unable to load products for this store.'}</p>
            <button
              type="button"
              onClick={onRetryMenu}
              className="mt-4 min-h-11 rounded-xl bg-red-700 px-5 text-sm font-semibold text-white hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              Retry menu
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-14 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-400">
          <Icon name="search" size={26} />
        </span>
        <p className="mt-3 text-sm font-semibold text-stone-900">
          {search.trim() ? `No results for “${search.trim()}”` : 'No products are available yet'}
        </p>
        <p className="mt-1 text-sm text-stone-500">
          {search.trim() ? 'Try a different word or pick another category.' : 'Please check again in a moment.'}
        </p>
      </div>
    );
  }

  return (
    <ul className={wrap}>
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          index={index}
          orderingOpen={orderingOpen}
          entries={cartMap.get(String(product.id)) || []}
          onProductClick={onProductClick}
          onDecrease={onDecrease}
        />
      ))}
    </ul>
  );
}