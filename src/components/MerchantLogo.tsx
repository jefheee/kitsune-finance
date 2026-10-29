"use client";

import React, { useState } from "react";
import { resolveMerchant } from "@/utils/finance/merchant-resolver";

interface MerchantLogoProps {
    cleanName?: string | null;
    rawDescription?: string | null;
    category?: string | null;
    size?: "sm" | "md" | "lg";
    className?: string;
}

export function MerchantLogo({
    cleanName,
    rawDescription,
    category,
    size = "md",
    className = "",
}: MerchantLogoProps) {
    const [imgError, setImgError] = useState(false);

    const query = cleanName || rawDescription || "Transação";
    const resolved = resolveMerchant(query, category);

    const sizeClasses = {
        sm: "w-7 h-7 text-xs rounded-lg",
        md: "w-9 h-9 text-sm rounded-xl",
        lg: "w-11 h-11 text-base rounded-2xl",
    }[size];

    const iconSizeClasses = {
        sm: "w-3.5 h-3.5",
        md: "w-4.5 h-4.5",
        lg: "w-5.5 h-5.5",
    }[size];

    // Se temos um slug do Simple Icons oficial
    if (resolved.simpleIconSlug && !imgError) {
        // Simple Icons CDN: https://cdn.simpleicons.org/[SLUG]/[COLOR]
        // Remove # do hex para a URL
        const cleanHex = (resolved.brandColor || "#FFFFFF").replace("#", "");
        const cdnUrl = `https://cdn.simpleicons.org/${resolved.simpleIconSlug}/${cleanHex}`;

        return (
            <div
                className={`relative flex items-center justify-center shrink-0 border border-white/10 transition-transform duration-300 hover:scale-105 shadow-sm ${sizeClasses} ${className}`}
                style={{
                    backgroundColor: resolved.brandColor ? `${resolved.brandColor}18` : "rgba(255, 255, 255, 0.05)",
                }}
                title={resolved.cleanName}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={cdnUrl}
                    alt={resolved.cleanName}
                    className={`${iconSizeClasses} object-contain transition-opacity duration-300`}
                    onError={() => setImgError(true)}
                    loading="lazy"
                />
            </div>
        );
    }

    // Se é uma loja brasileira decodificada ou categoria específica
    const getCategoryBadge = () => {
        const cat = (resolved.category || "").toLowerCase();
        if (cat.includes("aliment") || cat.includes("rest") || cat.includes("lanche") || cat.includes("padaria")) {
            return { icon: "🍽️", bg: "bg-amber-500/10 text-amber-500 border-amber-500/20" };
        }
        if (cat.includes("transp") || cat.includes("posto") || cat.includes("mobil")) {
            return { icon: "🚗", bg: "bg-blue-500/10 text-blue-500 border-blue-500/20" };
        }
        if (cat.includes("constru") || cat.includes("reform") || cat.includes("casa")) {
            return { icon: "🔨", bg: "bg-orange-500/10 text-orange-500 border-orange-500/20" };
        }
        if (cat.includes("supermerc") || cat.includes("atacad") || cat.includes("varejo")) {
            return { icon: "🛒", bg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" };
        }
        if (cat.includes("saude") || cat.includes("farm") || cat.includes("medic")) {
            return { icon: "💊", bg: "bg-rose-500/10 text-rose-500 border-rose-500/20" };
        }
        if (cat.includes("digital") || cat.includes("servi") || cat.includes("assinat")) {
            return { icon: "⚡", bg: "bg-purple-500/10 text-purple-500 border-purple-500/20" };
        }
        if (cat.includes("jogos") || cat.includes("lazer") || cat.includes("gamer")) {
            return { icon: "🎮", bg: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" };
        }
        if (cat.includes("educ") || cat.includes("curso")) {
            return { icon: "📚", bg: "bg-teal-500/10 text-teal-500 border-teal-500/20" };
        }
        if (cat.includes("pet")) {
            return { icon: "🐾", bg: "bg-amber-600/10 text-amber-600 border-amber-600/20" };
        }
        if (cat.includes("pix")) {
            return { icon: "💠", bg: "bg-teal-500/10 text-teal-400 border-teal-500/20" };
        }
        return {
            icon: resolved.cleanName.charAt(0).toUpperCase() || "💰",
            bg: "bg-slate-800 text-slate-300 border-white/5",
        };
    };

    const badge = getCategoryBadge();

    return (
        <div
            className={`flex items-center justify-center shrink-0 border font-semibold select-none shadow-sm ${sizeClasses} ${badge.bg} ${className}`}
            title={resolved.cleanName}
        >
            <span>{badge.icon}</span>
        </div>
    );
}
