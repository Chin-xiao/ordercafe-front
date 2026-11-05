import React, { useEffect, useMemo, useState } from 'react';
import { formatRiel } from '../../utils/currency';
import { Icon } from '../../components/ui';

const THUMB = 44; // handle width in px, must match the CSS below
const LAST_SUGAR_KEY = 'last_sugar_percent';
const QUICK_PICKS = [0, 25, 50, 75, 100];

const CSS = `
.sugar-range{-webkit-appearance:none;appearance:none;width:100%;height:32px;margin:0;background:transparent;cursor:pointer;position:relative;z-index:1}
.sugar-range::-webkit-slider-runnable-track{height:32px;background:transparent}
.sugar-range::-moz-range-track{height:32px;background:transparent}
.sugar-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:${THUMB}px;height:30px;margin-top:1px;border-radius:999px;background:#fff;border:1px solid #d6d3d1;box-shadow:0 2px 8px rgba(0,0,0,.22);cursor:grab}
.sugar-range::-moz-range-thumb{width:${THUMB - 2}px;height:28px;border-radius:999px;background:#fff;border:1px solid #d6d3d1;box-shadow:0 2px 8px rgba(0,0,0,.22);cursor:grab}
.sugar-range:active::-webkit-slider-thumb{cursor:grabbing;transform:scale(1.05)}
.sugar-range:focus-visible{outline:2px solid #ef5a3c;outline-offset:6px;border-radius:999px}
@keyframes sugar-pop{0%{transform:scale(.9)}60%{transform:scale(1.08)}100%{transform:scale(1)}}
.sugar-pop{animation:sugar-pop .18s ease-out}
@media (prefers-reduced-motion:reduce){.sugar-pop{animation:none}}
`;

// Position that lines up with the handle centre for a value from 0 to 1
const at = (fraction) => `calc(${fraction * 100}% + ${(0.5 - fraction) * THUMB}px)`;

function readLastSugar() {
  try {
    const raw = localStorage.getItem(LAST_SUGAR_KEY);
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}

function haptic(kind) {
  try { window.Telegram?.WebApp?.HapticFeedback?.[kind]?.(); } catch { /* optional */ }
}

export default function SugarSelectionModal({ product, sugarOptions, onClose, onAdd }) {
  const options = useMemo(
    () => [...(sugarOptions || [])].sort((a, b) => Number(a) - Number(b)),
    [sugarOptions]
  );
  const last = Math.max(0, options.length - 1);

  // Quick-pick chips: all options when few, otherwise the common ones that exist
  const quickIndexes = useMemo(() => {
    if (options.length <= 6) return options.map((_, i) => i);
    const picked = options
      .map((value, i) => (QUICK_PICKS.includes(Number(value)) ? i : -1))
      .filter((i) => i >= 0);
    return picked.length >= 2 ? picked : [0, Math.floor(last / 2), last];
  }, [options, last]);

  const rememberedIndex = useMemo(() => {
    const saved = readLastSugar();
    if (saved === null) return -1;
    return options.findIndex((value) => Number(value) === saved);
  }, [options]);

  const [index, setIndex] = useState(rememberedIndex >= 0 ? rememberedIndex : Math.floor(last / 2));
  // With a remembered choice the drink can be added in one tap; otherwise the customer must choose
  const [chosen, setChosen] = useState(rememberedIndex >= 0);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [popKey, setPopKey] = useState(0);

  useEffect(() => {
    if (!product) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [product, onClose]);

  if (!product) return null;

  const fraction = last === 0 ? 0 : index / last;
  const sugarPercent = chosen ? options[index] : null;

  const select = (next) => {
    if (next !== index) {
      haptic('selectionChanged');
      setPopKey((k) => k + 1);
    }
    setIndex(next);
    setChosen(true);
    setError('');
  };

  const handleAdd = () => {
    if (onAdd(product, sugarPercent, quantity)) {
      try { localStorage.setItem(LAST_SUGAR_KEY, String(sugarPercent)); } catch { /* storage may be unavailable */ }
      haptic('notificationOccurred');
    } else {
      setError(`You can order at most 100 of this drink at ${sugarPercent}% sugar.`);
    }
  };

  // Tick labels under the slider: all when few, otherwise only the two ends
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
        {/* Grab handle, a cue that this sheet can be dismissed */}
        <span aria-hidden="true" className="mx-auto -mt-1 mb-3 block h-1 w-10 rounded-full bg-stone-200 sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="sugar-selection-title" className="truncate text-lg font-bold text-stone-900">{product.name}</h2>
            <p className="mt-1 text-sm font-semibold text-[#d4401f]">{formatRiel(product.price)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sugar selection"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition-colors hover:bg-stone-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c]"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="mt-5 rounded-2xl bg-stone-50 p-4">
          <div className="flex items-end justify-between">
            <div>
              <p id="sugar-label" className="text-sm font-semibold text-stone-800">Sugar level</p>
              {rememberedIndex >= 0 && chosen && index === rememberedIndex && (
                <p className="mt-0.5 text-xs text-stone-500">Same as your last order</p>
              )}
            </div>
            <p
              key={popKey}
              aria-live="polite"
              className={`sugar-pop text-3xl font-bold leading-none ${chosen ? 'text-[#d4401f]' : 'text-stone-300'}`}
            >
              {chosen ? `${options[index]}%` : '–'}
            </p>
          </div>

          {/* Quick picks: one tap instead of dragging */}
          <div role="group" aria-label="Quick sugar levels" className="mt-4 flex flex-wrap gap-2">
            {quickIndexes.map((i) => {
              const active = chosen && i === index;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => select(i)}
                  aria-pressed={active}
                  className={`min-h-10 min-w-14 rounded-full px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c] focus-visible:ring-offset-1 ${
                    active ? 'bg-[#1f1a17] text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {options[i]}%
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-center gap-3">
            {/* small cube = less sugar */}
            <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded-[4px] border-2 border-stone-400" />

            <div className="relative flex-1">
              <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full bg-stone-200">
                <div
                  className={`h-full rounded-full transition-[width] duration-150 ${chosen ? 'bg-[#ef5a3c]' : 'bg-stone-300'}`}
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
                onChange={(event) => select(Number(event.target.value))}
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

          <div className="relative ml-[26px] mr-[36px] mt-1 h-5" aria-hidden="true">
            {labelIndexes.map((i) => (
              <span
                key={i}
                className={`absolute top-0 -translate-x-1/2 text-xs font-medium ${chosen && i === index ? 'text-[#d4401f]' : 'text-stone-400'}`}
                style={{ left: at(last === 0 ? 0 : i / last) }}
              >
                {options[i]}%
              </span>
            ))}
          </div>

          {!chosen && <p className="mt-2 text-center text-xs text-stone-500">Tap a level or slide to choose.</p>}
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
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-stone-100 text-stone-700 transition-colors hover:bg-stone-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c] disabled:opacity-40"
            >
              <Icon name="minus" size={18} />
            </button>
            <span aria-live="polite" className="w-8 text-center text-lg font-bold text-stone-900">{quantity}</span>
            <button
              type="button"
              onClick={() => { setQuantity((current) => Math.min(100, current + 1)); setError(''); }}
              disabled={quantity >= 100}
              aria-label="Increase quantity"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ef5a3c] text-white transition-colors hover:bg-[#dc4a2c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c] focus-visible:ring-offset-1 disabled:opacity-40"
            >
              <Icon name="plus" size={18} />
            </button>
          </div>
        </div>

        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}

        <button
          type="button"
          onClick={handleAdd}
          disabled={sugarPercent === null}
          className="mt-5 min-h-12 w-full rounded-xl bg-[#ef5a3c] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#dc4a2c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {sugarPercent === null ? 'Choose a sugar level' : `Add to order · ${formatRiel(Number(product.price) * quantity)}`}
        </button>
      </section>
    </div>
  );
}