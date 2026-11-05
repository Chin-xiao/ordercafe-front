import React, { useEffect, useMemo, useState } from 'react';
import { formatRiel } from '../../utils/currency';
import { Icon } from '../../components/ui';

const THUMB = 44; // handle width in px, must match the CSS below

const CSS = `
.sugar-range{-webkit-appearance:none;appearance:none;width:100%;height:32px;margin:0;background:transparent;cursor:pointer;position:relative;z-index:1}
.sugar-range::-webkit-slider-runnable-track{height:32px;background:transparent}
.sugar-range::-moz-range-track{height:32px;background:transparent}
.sugar-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:${THUMB}px;height:30px;margin-top:1px;border-radius:999px;background:#fff;border:1px solid #d6d3d1;box-shadow:0 2px 8px rgba(0,0,0,.22);cursor:grab}
.sugar-range::-moz-range-thumb{width:${THUMB - 2}px;height:28px;border-radius:999px;background:#fff;border:1px solid #d6d3d1;box-shadow:0 2px 8px rgba(0,0,0,.22);cursor:grab}
.sugar-range:active::-webkit-slider-thumb{cursor:grabbing;transform:scale(1.05)}
.sugar-range:focus-visible{outline:2px solid #10b981;outline-offset:6px;border-radius:999px}
`;

// Position that lines up with the handle centre for a value from 0 to 1
const at = (fraction) => `calc(${fraction * 100}% + ${(0.5 - fraction) * THUMB}px)`;

export default function SugarSelectionModal({ product, sugarOptions, onClose, onAdd }) {
  const options = useMemo(
    () => [...(sugarOptions || [])].sort((a, b) => Number(a) - Number(b)),
    [sugarOptions]
  );
  const last = Math.max(0, options.length - 1);

  const [index, setIndex] = useState(Math.floor(last / 2));
  const [chosen, setChosen] = useState(false); // customer must touch the slider before adding
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!product) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [product, onClose]);

  if (!product) return null;

  const fraction = last === 0 ? 0 : index / last;
  const sugarPercent = chosen ? options[index] : null;

  const handleChange = (event) => {
    const next = Number(event.target.value);
    if (next !== index) {
      try { window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.(); } catch { /* optional */ }
    }
    setIndex(next);
    setChosen(true);
    setError('');
  };

  // Show every label when there are few options, otherwise only the two ends
  const labelIndexes = options.length <= 6 ? options.map((_, i) => i) : [0, last];

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col justify-end bg-stone-950/50 sm:justify-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{CSS}</style>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sugar-selection-title"
        className="mx-auto w-full max-w-lg rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="sugar-selection-title" className="truncate text-lg font-bold text-stone-900">{product.name}</h2>
            <p className="mt-1 text-sm font-semibold text-emerald-700">{formatRiel(product.price)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sugar selection"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition-colors hover:bg-stone-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Sugar slider */}
        <div className="mt-6 rounded-2xl bg-stone-50 p-4">
          <div className="flex items-end justify-between">
            <p id="sugar-label" className="text-sm font-semibold text-stone-800">Sugar level</p>
            <p aria-live="polite" className={`text-3xl font-bold leading-none ${chosen ? 'text-emerald-700' : 'text-stone-300'}`}>
              {chosen ? `${options[index]}%` : '–'}
            </p>
          </div>

          <div className="mt-5 flex items-center gap-3">
            {/* small cube = less sugar */}
            <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded-[4px] border-2 border-stone-400" />

            <div className="relative flex-1">
              {/* track + fill */}
              <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full bg-stone-200">
                <div
                  className={`h-full rounded-full transition-[width] duration-150 ${chosen ? 'bg-emerald-700' : 'bg-stone-300'}`}
                  style={{ width: at(fraction) }}
                />
              </div>
              <input
                type="range"
                className="sugar-range"
                min={0}
                max={last}
                step={1}
                value={index}
                onChange={handleChange}
                onPointerUp={() => setChosen(true)}
                onKeyUp={(e) => e.key.startsWith('Arrow') && setChosen(true)}
                aria-labelledby="sugar-label"
                aria-valuetext={chosen ? `${options[index]}% sugar` : 'No sugar level selected'}
                disabled={options.length === 0}
              />
            </div>

            {/* big cube = more sugar */}
            <span aria-hidden="true" className="h-6 w-6 shrink-0 rounded-md border-2 border-stone-400" />
          </div>

          {/* tick labels */}
          <div className="relative ml-[26px] mr-[36px] mt-1 h-5" aria-hidden="true">
            {labelIndexes.map((i) => (
              <span
                key={i}
                className={`absolute top-0 -translate-x-1/2 text-xs font-medium ${chosen && i === index ? 'text-emerald-700' : 'text-stone-400'}`}
                style={{ left: at(last === 0 ? 0 : i / last) }}
              >
                {options[i]}%
              </span>
            ))}
          </div>

          {!chosen && <p className="mt-2 text-center text-xs text-stone-500">Slide to choose a sugar level.</p>}
        </div>

        {/* Quantity */}
        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm font-semibold text-stone-800">Quantity</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setQuantity((current) => Math.max(1, current - 1)); setError(''); }}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-stone-100 text-stone-700 transition-colors hover:bg-stone-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40"
            >
              <Icon name="minus" size={18} />
            </button>
            <span aria-live="polite" className="w-8 text-center text-lg font-bold text-stone-900">{quantity}</span>
            <button
              type="button"
              onClick={() => { setQuantity((current) => Math.min(100, current + 1)); setError(''); }}
              disabled={quantity >= 100}
              aria-label="Increase quantity"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-700 text-white transition-colors hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-1 disabled:opacity-40"
            >
              <Icon name="plus" size={18} />
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
          className="mt-6 min-h-12 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          Add to order · {formatRiel(Number(product.price) * quantity)}
        </button>
      </section>
    </div>
  );
}