"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { path: "/dashboard", icon: "monitoring", label: "Dashboard" },
    { path: "/kitsune", icon: "auto_awesome", label: "Kitsune AI" },
    { path: "/agents", icon: "hub", label: "Agents" },
  ];

  return (
    <div className="flex h-screen w-full bg-[#0A0A0A] overflow-hidden">
      {/* Desktop Sidebar (Minimalist) */}
      <aside className="hidden md:flex flex-col w-20 border-r border-white/5 bg-[#121212] pt-6 pb-4 items-center justify-between">
        <div className="flex flex-col items-center gap-8 w-full">
          <Link href="/dashboard" className="flex items-center justify-center p-2 rounded-full hover:bg-white/5 transition-colors">
            <Image src="/assets/logo/logo.png" alt="Logo" width={32} height={32} className="object-contain" />
          </Link>

          <nav className="flex flex-col items-center gap-4 w-full px-2">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center justify-center w-full h-12 rounded-xl transition-all duration-300 ${
                    isActive ? "text-kitsune bg-kitsune/10" : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                  title={item.label}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                    {item.icon}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="flex items-center justify-center w-full">
          <button className="text-white/50 hover:text-white transition-colors w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5">
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto pb-20 md:pb-0 relative">
        <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-[#121212]/80 backdrop-blur-md sticky top-0 z-50">
          <Image src="/assets/logo/logo.png" alt="Logo" width={24} height={24} className="object-contain" />
          <span className="font-sans font-semibold text-white/90">Kitsune Finance</span>
          <button className="text-white/50">
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full h-16 bg-[#121212]/90 backdrop-blur-xl border-t border-white/5 flex items-center justify-around z-50 pb-safe">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-300 ${
                isActive ? "text-kitsune" : "text-white/50"
              }`}
            >
              <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                {item.icon}
              </span>
              <span className="text-[10px] font-sans font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
