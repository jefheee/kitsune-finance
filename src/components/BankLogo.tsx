'use client';

import React, { useState } from 'react';
import { getBankCatalogBySlugOrName, type BankSlug } from '@/utils/pluggy/bank-resolver';

interface BankLogoProps {
    bank?: string | BankSlug | null;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
    className?: string;
    showName?: boolean;
}

const SIZE_MAP: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number> = {
    xs: 20,
    sm: 28,
    md: 36,
    lg: 44,
    xl: 56,
};

export function BankLogo({ bank, size = 'md', className = '', showName = false }: BankLogoProps) {
    const entry = getBankCatalogBySlugOrName(bank);
    const px = typeof size === 'number' ? size : SIZE_MAP[size] || 36;
    const [imgSrc, setImgSrc] = useState<string>(`/banks/${entry.slug}.svg`);

    // In case the bank prop changes dynamically
    React.useEffect(() => {
        setImgSrc(`/banks/${entry.slug}.svg`);
    }, [entry.slug]);

    const handleImgError = () => {
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
            className="shrink-0 object-contain rounded-lg shadow-sm"
            loading="eager"
            onError={handleImgError}
        />
    );

    if (!showName) {
        return <span className={`inline-flex items-center justify-center ${className}`}>{logoElement}</span>;
    }

    return (
        <span className={`inline-flex items-center gap-2 ${className}`}>
            {logoElement}
            <span className="font-semibold text-white">{entry.shortName}</span>
        </span>
    );
}
