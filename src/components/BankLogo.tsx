'use client';

import React, { useState, useEffect } from 'react';
import { getBankCatalogBySlugOrName, type BankSlug } from '@/utils/pluggy/bank-resolver';

interface BankLogoProps {
    bank?: string | BankSlug | null;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
    className?: string;
    showName?: boolean;
    logoUrl?: string | null;
}

const SIZE_MAP: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number> = {
    xs: 20,
    sm: 28,
    md: 36,
    lg: 44,
    xl: 56,
};

// Conjunto das marcas oficiais salvas localmente em /public/banks/*.svg
const LOCAL_AVAILABLE_SLUGS = new Set([
    'nubank',
    'itau',
    'santander',
    'inter',
    'caixa',
    'mercadopago',
    'bradesco',
    'bb',
    'c6',
    'btg',
    'safra',
    'picpay',
    'xp',
    'rico',
    'sicredi',
    'sicoob',
]);

export function BankLogo({
    bank,
    size = 'md',
    className = '',
    showName = false,
    logoUrl,
}: BankLogoProps) {
    const entry = getBankCatalogBySlugOrName(bank);
    const px = typeof size === 'number' ? size : SIZE_MAP[size] || 36;

    // Resolução multi-camadas de URL:
    // 1. URL remota direta passada via prop logoUrl ou no próprio bank (ex: CDN da Pluggy)
    // 2. SVG vetorial corporativo local em /banks/[slug].svg se estiver na lista dos bancos principais
    // 3. CDN oficial de logos bancárias brasileiras (henriquezolini/react-bancos) para os demais 140+ bancos
    // 4. Fallback resiliente para /banks/generic.svg
    const resolveInitialSrc = (): string => {
        if (logoUrl && (logoUrl.startsWith('http://') || logoUrl.startsWith('https://'))) {
            return logoUrl;
        }

        if (typeof bank === 'string' && (bank.startsWith('http://') || bank.startsWith('https://'))) {
            return bank;
        }

        if (LOCAL_AVAILABLE_SLUGS.has(entry.slug)) {
            return `/banks/${entry.slug}.svg`;
        }

        // Se for um banco fora da lista dos 16 principais, busca na CDN oficial
        const cleanName = (typeof bank === 'string' ? bank : entry.name)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');

        if (cleanName.length > 2) {
            return `https://raw.githubusercontent.com/henriquezolini/react-bancos/main/icons/${cleanName}.svg`;
        }

        return '/banks/generic.svg';
    };

    const [imgSrc, setImgSrc] = useState<string>(resolveInitialSrc());

    useEffect(() => {
        setImgSrc(resolveInitialSrc());
    }, [bank, logoUrl, entry.slug]);

    const handleImgError = () => {
        // Se falhar a CDN externa ou URL remota, faz fallback para o ícone bancário limpo local
        if (!imgSrc.endsWith('/banks/generic.svg')) {
            setImgSrc('/banks/generic.svg');
        }
    };

    const logoElement = (
        <img
            src={imgSrc}
            alt={entry.name}
            width={px}
            height={px}
            style={{ width: `${px}px`, height: `${px}px` }}
            className="shrink-0 object-contain rounded-lg shadow-xs"
            loading="eager"
            onError={handleImgError}
        />
    );

    if (!showName) {
        return (
            <span className={`inline-flex items-center justify-center ${className}`}>
                {logoElement}
            </span>
        );
    }

    return (
        <span className={`inline-flex items-center gap-2 ${className}`}>
            {logoElement}
            <span className="font-semibold text-white">{entry.shortName}</span>
        </span>
    );
}
