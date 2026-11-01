'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const SCROLL_POS_STORAGE_PREFIX = 'kitsune_scroll_pos_';

export function ScrollRestorationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Configura o comportamento nativo de restauração de histórico
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    // Restaura a posição anterior salva ao entrar na rota
    const savedScrollPos = sessionStorage.getItem(`${SCROLL_POS_STORAGE_PREFIX}${pathname}`);
    if (savedScrollPos !== null) {
      const targetY = parseInt(savedScrollPos, 10);
      requestAnimationFrame(() => {
        window.scrollTo({
          top: targetY,
          left: 0,
          behavior: 'instant' as ScrollBehavior,
        });
      });
    }

    // Salva a posição antes de sair ou recarregar
    const handleScroll = () => {
      sessionStorage.setItem(`${SCROLL_POS_STORAGE_PREFIX}${pathname}`, window.scrollY.toString());
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [pathname]);

  return <>{children}</>;
}

