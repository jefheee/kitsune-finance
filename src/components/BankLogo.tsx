import React from 'react';
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

    const renderVector = (slug: BankSlug) => {
        switch (slug) {
            case 'nubank':
                return (
                    <svg viewBox="0 0 64 64" width={px} height={px} fill="none" aria-label="Nubank" className="shrink-0">
                        <rect width="64" height="64" rx="16" fill="#820AD1" />
                        <path
                            d="M16 42V27.5C16 22.8 19.6 19 24.2 19C28.8 19 32.4 22.8 32.4 27.5V42H27.4V27.8C27.4 25.6 26 24 24.2 24C22.4 24 21 25.6 21 27.8V42H16Z"
                            fill="#FFFFFF"
                        />
                        <path
                            d="M48 22V36.5C48 41.2 44.4 45 39.8 45C35.2 45 31.6 41.2 31.6 36.5V22H36.6V36.2C36.6 38.4 38 40 39.8 40C41.6 40 43 38.4 43 36.2V22H48Z"
                            fill="#FFFFFF"
                        />
                    </svg>
                );
            case 'itau':
                return (
                    <svg viewBox="0 0 64 64" width={px} height={px} fill="none" aria-label="Itaú" className="shrink-0">
                        <rect width="64" height="64" rx="16" fill="#FF6200" />
                        <rect x="6" y="6" width="52" height="52" rx="13" fill="#003399" />
                        <text
                            x="32"
                            y="39"
                            textAnchor="middle"
                            fill="#FFD100"
                            fontFamily="Arial, Helvetica, sans-serif"
                            fontWeight="900"
                            fontSize="21"
                            letterSpacing="-0.5"
                        >
                            Itaú
                        </text>
                    </svg>
                );
            case 'santander':
                return (
                    <svg viewBox="0 0 64 64" width={px} height={px} fill="none" aria-label="Santander" className="shrink-0">
                        <rect width="64" height="64" rx="16" fill="#EC0000" />
                        <path
                            d="M32.5 14C28.5 18.8 28.2 23.2 31.8 27.5C35.2 31.5 34.8 35.8 31 40.5C35.2 38.2 38.5 34.4 38.5 29.5C38.5 24.5 33.8 20.5 32.5 14Z"
                            fill="#FFFFFF"
                        />
                        <path
                            d="M25.5 21C22.5 24.8 22.5 28.5 25.5 32.2C28.2 35.5 27.8 38.8 25 42C28.5 40.2 31 37 31 33C31 28.8 26.8 25.8 25.5 21Z"
                            fill="#FFFFFF"
                            fillOpacity="0.9"
                        />
                        <ellipse cx="32" cy="44" rx="16" ry="4.5" stroke="#FFFFFF" strokeWidth="3.2" fill="none" />
                    </svg>
                );
            case 'inter':
                return (
                    <svg viewBox="0 0 64 64" width={px} height={px} fill="none" aria-label="Banco Inter" className="shrink-0">
                        <rect width="64" height="64" rx="16" fill="#FF7A00" />
                        <text
                            x="32"
                            y="40"
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontFamily="Arial, Helvetica, sans-serif"
                            fontWeight="900"
                            fontSize="21"
                            letterSpacing="-0.6"
                        >
                            inter
                        </text>
                        <circle cx="20.5" cy="20" r="2.6" fill="#FFFFFF" />
                    </svg>
                );
            case 'caixa':
                return (
                    <svg viewBox="0 0 64 64" width={px} height={px} fill="none" aria-label="Caixa" className="shrink-0">
                        <rect width="64" height="64" rx="16" fill="#005CA9" />
                        <path d="M18 20L30 32L18 44H25.5L34 35.5L42.5 44H50L38 32L50 20H42.5L34 28.5L25.5 20H18Z" fill="#F39200" />
                        <path d="M14 20L26 32L14 44H21L33 32L21 20H14Z" fill="#FFFFFF" />
                    </svg>
                );
            case 'mercadopago':
                return (
                    <svg viewBox="0 0 64 64" width={px} height={px} fill="none" aria-label="Mercado Pago" className="shrink-0">
                        <rect width="64" height="64" rx="16" fill="#009EE3" />
                        <ellipse cx="32" cy="32" rx="22" ry="15" fill="#FFFFFF" />
                        <path
                            d="M21 32L27.5 26.5L33 31.5L39.5 26.5L44 31.5"
                            stroke="#009EE3"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <path d="M23 36.5C26.5 39.5 37.5 39.5 41 36.5" stroke="#009EE3" strokeWidth="3.2" strokeLinecap="round" />
                    </svg>
                );
            case 'bradesco':
                return (
                    <svg viewBox="0 0 64 64" width={px} height={px} fill="none" aria-label="Bradesco" className="shrink-0">
                        <rect width="64" height="64" rx="16" fill="#CC092F" />
                        <path d="M16 36C16 25.5 23.2 18 32 18C40.8 18 48 25.5 48 36" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" />
                        <path d="M22 36C22 28.8 26.5 23.5 32 23.5C37.5 23.5 42 28.8 42 36" stroke="#FFFFFF" strokeWidth="3.8" strokeLinecap="round" />
                        <rect x="29.5" y="34" width="5" height="13" rx="2" fill="#FFFFFF" />
                    </svg>
                );
            case 'bb':
                return (
                    <svg viewBox="0 0 64 64" width={px} height={px} fill="none" aria-label="Banco do Brasil" className="shrink-0">
                        <rect width="64" height="64" rx="16" fill="#F8D117" />
                        <path d="M32 14L50 25L32 36L14 25L32 14Z" stroke="#0038A8" strokeWidth="4.5" strokeLinejoin="round" />
                        <path d="M32 28L50 39L32 50L14 39L32 28Z" stroke="#0038A8" strokeWidth="4.5" strokeLinejoin="round" />
                    </svg>
                );
            case 'c6':
                return (
                    <svg viewBox="0 0 64 64" width={px} height={px} fill="none" aria-label="C6 Bank" className="shrink-0">
                        <rect width="64" height="64" rx="16" fill="#18181B" />
                        <rect x="2" y="2" width="60" height="60" rx="14" stroke="#3F3F46" strokeWidth="2" />
                        <text
                            x="32"
                            y="40"
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontFamily="Arial, Helvetica, sans-serif"
                            fontWeight="900"
                            fontSize="24"
                            letterSpacing="0.5"
                        >
                            C6
                        </text>
                    </svg>
                );
            case 'btg':
                return (
                    <svg viewBox="0 0 64 64" width={px} height={px} fill="none" aria-label="BTG Pactual" className="shrink-0">
                        <rect width="64" height="64" rx="16" fill="#001E62" />
                        <text
                            x="32"
                            y="39"
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontFamily="Arial, Helvetica, sans-serif"
                            fontWeight="800"
                            fontSize="20"
                            letterSpacing="1"
                        >
                            BTG
                        </text>
                    </svg>
                );
            case 'safra':
                return (
                    <svg viewBox="0 0 64 64" width={px} height={px} fill="none" aria-label="Banco Safra" className="shrink-0">
                        <rect width="64" height="64" rx="16" fill="#0C1B33" />
                        <rect x="3" y="3" width="58" height="58" rx="13" stroke="#D4AF37" strokeWidth="2" />
                        <text x="32" y="39" textAnchor="middle" fill="#D4AF37" fontFamily="Georgia, serif" fontWeight="700" fontSize="19">
                            Safra
                        </text>
                    </svg>
                );
            case 'picpay':
                return (
                    <svg viewBox="0 0 64 64" width={px} height={px} fill="none" aria-label="PicPay" className="shrink-0">
                        <rect width="64" height="64" rx="16" fill="#11C76F" />
                        <text
                            x="32"
                            y="39"
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontFamily="Arial, Helvetica, sans-serif"
                            fontWeight="900"
                            fontSize="16"
                            letterSpacing="-0.4"
                        >
                            PicPay
                        </text>
                    </svg>
                );
            case 'xp':
                return (
                    <svg viewBox="0 0 64 64" width={px} height={px} fill="none" aria-label="XP" className="shrink-0">
                        <rect width="64" height="64" rx="16" fill="#121214" />
                        <rect x="3" y="3" width="58" height="58" rx="13" stroke="#F59E0B" strokeWidth="2" />
                        <text x="32" y="40" textAnchor="middle" fill="#F59E0B" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontSize="24">
                            XP
                        </text>
                    </svg>
                );
            case 'rico':
                return (
                    <svg viewBox="0 0 64 64" width={px} height={px} fill="none" aria-label="Rico" className="shrink-0">
                        <rect width="64" height="64" rx="16" fill="#FF5500" />
                        <text x="32" y="39" textAnchor="middle" fill="#FFFFFF" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontSize="19">
                            rico
                        </text>
                    </svg>
                );
            case 'sicredi':
                return (
                    <svg viewBox="0 0 64 64" width={px} height={px} fill="none" aria-label="Sicredi" className="shrink-0">
                        <rect width="64" height="64" rx="16" fill="#3FA110" />
                        <circle cx="32" cy="32" r="14" stroke="#FFFFFF" strokeWidth="4" />
                        <path d="M24 32L32 22L40 32L32 42L24 32Z" fill="#FFFFFF" />
                    </svg>
                );
            case 'sicoob':
                return (
                    <svg viewBox="0 0 64 64" width={px} height={px} fill="none" aria-label="Sicoob" className="shrink-0">
                        <rect width="64" height="64" rx="16" fill="#003641" />
                        <polygon points="32,14 49,44 15,44" fill="#00A091" />
                        <polygon points="32,23 42,41 22,41" fill="#C4D600" />
                    </svg>
                );
            default:
                return (
                    <svg viewBox="0 0 64 64" width={px} height={px} fill="none" aria-label="Banco" className="shrink-0">
                        <rect width="64" height="64" rx="16" fill="#18181B" />
                        <path d="M32 16L48 24V28H16V24L32 16Z" fill="#10B981" />
                        <rect x="20" y="31" width="4" height="12" rx="1" fill="#10B981" />
                        <rect x="30" y="31" width="4" height="12" rx="1" fill="#10B981" />
                        <rect x="40" y="31" width="4" height="12" rx="1" fill="#10B981" />
                        <rect x="16" y="45" width="32" height="4" rx="1.5" fill="#10B981" />
                    </svg>
                );
        }
    };

    if (!showName) {
        return <span className={`inline-flex items-center justify-center ${className}`}>{renderVector(entry.slug)}</span>;
    }

    return (
        <span className={`inline-flex items-center gap-2 ${className}`}>
            {renderVector(entry.slug)}
            <span className="font-semibold text-white">{entry.shortName}</span>
        </span>
    );
}
