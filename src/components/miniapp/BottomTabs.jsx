import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon } from '../ui';

const TABS = [
  { to: '/menu', label: 'Menu', icon: 'cup' },
  { to: '/my-order', label: 'My order', icon: 'receipt' },
  { to: '/spending', label: 'Money', icon: 'chart' },
  { to: '/profile', label: 'Profile', icon: 'user' },
];

export default function BottomTabs() {
  const { pathname } = useLocation();

  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-3xl">
        {TABS.map(({ to, label, icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) => {
                const active = isActive || (to === '/menu' && pathname === '/');
                return `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:bg-stone-100 ${
                  active ? 'text-[#ef5a3c]' : 'text-stone-500 hover:text-stone-800'
                }`;
              }}
            >
              <Icon name={icon} size={22} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}