'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'home',
    href: '/',
    label: 'Home',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: 'portfolio',
    href: '/portfolio',
    label: 'Portfolio',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
  {
    id: 'transfers',
    href: '/transfers',
    label: 'Transfers',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    id: 'profile',
    href: '/profile',
    label: 'Profile',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      id="bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-50 glass"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-center justify-around h-[72px] max-w-md mx-auto px-4">
        {NAV_ITEMS.map((item) => {
          // Check for active state correctly (exact match for root, prefix for others)
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

          return (
            <Link
              key={item.id}
              href={item.href}
              id={`nav-${item.id}`}
              className="flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all duration-300"
              style={{
                color: isActive
                  ? 'var(--color-accent)'
                  : 'var(--color-text-muted)',
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
              }}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span
                className="transition-all duration-300"
                style={{
                  filter: isActive
                    ? 'drop-shadow(0 0 8px rgba(255, 94, 0, 0.5))'
                    : 'none',
                }}
              >
                {item.icon}
              </span>
              <span
                className="transition-all duration-300 font-sans"
                style={{
                  fontSize: '0.625rem',
                  fontWeight: isActive ? 600 : 400,
                  letterSpacing: '0.05em',
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
