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
      <svg fill="currentColor" height="24px" viewBox="0 0 256 256" width="24px" xmlns="http://www.w3.org/2000/svg">
        <path d="M224,115.55V208a16,16,0,0,1-16,16H168a16,16,0,0,1-16-16V168a8,8,0,0,0-8-8H112a8,8,0,0,0-8,8v40a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V115.55a16,16,0,0,1,5.17-11.78l80-75.48.11-.11a16,16,0,0,1,21.53,0,1.14,1.14,0,0,0,.11.11l80,75.48A16,16,0,0,1,224,115.55Z"></path>
      </svg>
    ),
  },
  {
    id: 'portfolio',
    href: '/portfolio',
    label: 'Portfolio',
    icon: (
      <svg fill="currentColor" height="24px" viewBox="0 0 256 256" width="24px" xmlns="http://www.w3.org/2000/svg">
        <path d="M216,56H176V48a24,24,0,0,0-24-24H104A24,24,0,0,0,80,48v8H40A16,16,0,0,0,24,72V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V72A16,16,0,0,0,216,56ZM96,48a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96ZM216,72v41.61A184,184,0,0,1,128,136a184.07,184.07,0,0,1-88-22.38V72Zm0,128H40V131.64A200.19,200.19,0,0,0,128,152a200.25,200.25,0,0,0,88-20.37V200ZM104,112a8,8,0,0,1,8-8h32a8,8,0,0,1,0,16H112A8,8,0,0,1,104,112Z"></path>
      </svg>
    ),
  },
  {
    id: 'transfers',
    href: '/transfers',
    label: 'Transfers',
    icon: (
      <svg fill="currentColor" height="24px" viewBox="0 0 256 256" width="24px" xmlns="http://www.w3.org/2000/svg">
        <path d="M213.66,181.66l-32,32a8,8,0,0,1-11.32-11.32L188.69,184H48a8,8,0,0,1,0-16H188.69l-18.35-18.34a8,8,0,0,1,11.32-11.32l32,32A8,8,0,0,1,213.66,181.66Zm-139.32-64a8,8,0,0,0,11.32-11.32L67.31,88H208a8,8,0,0,0,0-16H67.31L85.66,53.66A8,8,0,0,0,74.34,42.34l-32,32a8,8,0,0,0,0,11.32Z"></path>
      </svg>
    ),
  },
  {
    id: 'profile',
    href: '/profile',
    label: 'Profile',
    icon: (
      <svg fill="currentColor" height="24px" viewBox="0 0 256 256" width="24px" xmlns="http://www.w3.org/2000/svg">
        <path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"></path>
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 w-full max-w-md mx-auto left-0 right-0 flex gap-2 border-t border-[#f4ede6] bg-[#fcfaf8]/80 backdrop-blur-md px-4 pb-safe-nav pt-2 z-50">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`just flex flex-1 flex-col items-center justify-end gap-1 rounded-full ${isActive ? 'text-[#1d140c]' : 'text-[#a17145]'}`}
          >
            <div className={`flex h-8 items-center justify-center ${isActive ? 'text-[#1d140c]' : 'text-[#a17145]'}`}>
              {item.icon}
            </div>
            <p className={`text-xs font-medium leading-normal tracking-[0.015em] ${isActive ? 'text-[#1d140c]' : 'text-[#a17145]'}`}>
              {item.label}
            </p>
          </Link>
        );
      })}
    </nav>
  );
}
