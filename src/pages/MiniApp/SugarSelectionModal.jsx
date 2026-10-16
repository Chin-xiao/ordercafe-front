import React, { useState } from 'react';
import { formatRiel } from '../../utils/currency';

export default function SugarSelectionModal({ product, sugarOptions, onClose, onAdd }) {
  const [sugarPercent, setSugarPercent] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');

  if (!product) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-stone-950/50 sm:justify-center sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sugar-selection-title"
        className="mx-auto w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="sugar-selection-title" className="text-lg font-bold text-stone-900">{product.name}</h2>
            <p className="mt-1 text-sm font-semibold text-emerald-700">{formatRiel(product.price)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sugar selection"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 font-bold text-stone-600"
          >
            ×
          </button>
        </div>

        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-semibold text-stone-800">Choose sugar percentage</legend>
          <div className="grid grid-cols-5 gap-2">
            {sugarOptions.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={sugarPercent === option}
                onClick={() => {
                  setSugarPercent(option);
                  setError('');
                }}
                className={`min-h-12 rounded-xl border px-2 text-sm font-bold transition ${
                  sugarPercent === option
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-emerald-400'
                }`}
              >
                {option}%
              </button>
            ))}
          </div>
          {sugarPercent === null && (
            <p className="mt-2 text-xs text-stone-500">Select a sugar level to continue.</p>
          )}
        </fieldset>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm font-semibold text-stone-800">Quantity</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setQuantity((current) => Math.max(1, current - 1));
                setError('');
              }}
              aria-label="Decrease quantity"
              className="h-11 w-11 rounded-xl bg-stone-100 text-lg font-bold text-stone-700"
            >
              −
            </button>
            <span aria-live="polite" className="w-6 text-center font-bold text-stone-900">{quantity}</span>
            <button
              type="button"
              onClick={() => {
                setQuantity((current) => Math.min(100, current + 1));
                setError('');
              }}
              disabled={quantity >= 100}
              aria-label="Increase quantity"
              className="h-11 w-11 rounded-xl bg-emerald-700 text-lg font-bold text-white disabled:opacity-50"
            >
              +
            </button>
          </div>
        </div>

        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        <button
          type="button"
          onClick={() => {
            if (!onAdd(product, sugarPercent, quantity)) {
              setError('This drink and sugar combination cannot exceed 100 items per order.');
            }
          }}
          disabled={sugarPercent === null}
          className="mt-6 min-h-12 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          Add to Order · {formatRiel(Number(product.price) * quantity)}
        </button>
      </section>
    </div>
  );
}
