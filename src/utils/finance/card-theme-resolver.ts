/**
 * Kitsune Finance — Dynamic Card Theme Resolver (resolveCardTheme)
 * Receives bank name, product name or description and infers visual identity
 * based on Brazilian banking keywords (ultravioleta, uniclass, azul itau, black, gold, etc.).
 * Produces clean, minimalist dark luxury styling with subtle specular reflection.
 */

export interface CardTheme {
  id: string;
  label: string;
  bgGradient: string;
  border: string;
  accentColor: string;
  badgeStyle: string;
  chipColor: string;
  textColor: string;
  subtextColor: string;
  brandFallback: string;
}

export function resolveCardTheme(nameOrDesc?: string | null, bankSlug?: string | null): CardTheme {
  const text = `${nameOrDesc || ""} ${bankSlug || ""}`.toLowerCase().trim();

  // 1. Nubank Ultravioleta
  if (text.includes("ultravioleta") || text.includes("ultra violeta")) {
    return {
      id: "nubank-ultravioleta",
      label: "Nubank Ultravioleta",
      bgGradient: "from-[#1a0826] via-[#14061f] to-[#0b0312]",
      border: "border-purple-500/40",
      accentColor: "#A855F7",
      badgeStyle: "bg-purple-500/15 text-purple-300 border-purple-500/30",
      chipColor: "#D8B4FE",
      textColor: "text-white",
      subtextColor: "text-purple-200/70",
      brandFallback: "Mastercard Black",
    };
  }

  // 2. Nubank Padrão (Roxo Nu)
  if (text.includes("nubank") || text.includes("nu pagamentos") || text.includes("nu ")) {
    return {
      id: "nubank-standard",
      label: "Nubank Roxinho",
      bgGradient: "from-[#590a8f] via-[#3c0561] to-[#220238]",
      border: "border-purple-400/30",
      accentColor: "#C084FC",
      badgeStyle: "bg-purple-400/15 text-purple-200 border-purple-400/30",
      chipColor: "#F3E8FF",
      textColor: "text-white",
      subtextColor: "text-purple-100/70",
      brandFallback: "Mastercard Platinum",
    };
  }

  // 3. Itaú Azul (TudoAzul)
  if (text.includes("azul itau") || text.includes("itaucard azul") || (text.includes("azul") && text.includes("itau"))) {
    return {
      id: "itau-azul",
      label: "Itaú Azul Linhas Aéreas",
      bgGradient: "from-[#0e2c4d] via-[#091e36] to-[#040f1c]",
      border: "border-sky-400/30",
      accentColor: "#38BDF8",
      badgeStyle: "bg-sky-500/15 text-sky-200 border-sky-400/30",
      chipColor: "#BAE6FD",
      textColor: "text-white",
      subtextColor: "text-sky-100/70",
      brandFallback: "Visa Infinite",
    };
  }

  // 4. Itaú Personnalité
  if (text.includes("personnalite") || text.includes("personalite")) {
    return {
      id: "itau-personnalite",
      label: "Itaú Personnalité",
      bgGradient: "from-[#111927] via-[#0a0f19] to-[#04060a]",
      border: "border-amber-400/40",
      accentColor: "#F59E0B",
      badgeStyle: "bg-amber-500/15 text-amber-200 border-amber-400/30",
      chipColor: "#FDE68A",
      textColor: "text-white",
      subtextColor: "text-amber-100/70",
      brandFallback: "Mastercard Black",
    };
  }

  // 5. Itaú Uniclass
  if (text.includes("uniclass")) {
    return {
      id: "itau-uniclass",
      label: "Itaú Uniclass",
      bgGradient: "from-[#1d2736] via-[#141b26] to-[#0b0e14]",
      border: "border-amber-500/30",
      accentColor: "#F59E0B",
      badgeStyle: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      chipColor: "#FCD34D",
      textColor: "text-white",
      subtextColor: "text-slate-300/70",
      brandFallback: "Visa Signature",
    };
  }

  // 6. Itaú Geral
  if (text.includes("itau") || text.includes("itaucard")) {
    return {
      id: "itau-standard",
      label: "Itaú",
      bgGradient: "from-[#242122] via-[#181617] to-[#0c0b0c]",
      border: "border-orange-500/30",
      accentColor: "#EC7000",
      badgeStyle: "bg-orange-500/15 text-orange-300 border-orange-500/30",
      chipColor: "#FED7AA",
      textColor: "text-white",
      subtextColor: "text-orange-100/70",
      brandFallback: "Mastercard Gold",
    };
  }

  // 7. Banco Inter
  if (text.includes("inter") || text.includes("banco inter")) {
    return {
      id: "inter-orange",
      label: "Banco Inter",
      bgGradient: "from-[#2b1f15] via-[#1c140d] to-[#0e0a06]",
      border: "border-orange-500/40",
      accentColor: "#FF7A00",
      badgeStyle: "bg-[#FF7A00]/20 text-[#FFA047] border-[#FF7A00]/30",
      chipColor: "#FFEDD5",
      textColor: "text-white",
      subtextColor: "text-orange-200/70",
      brandFallback: "Mastercard Gold",
    };
  }

  // 8. C6 Bank / Carbon
  if (text.includes("c6") || text.includes("carbon")) {
    return {
      id: "c6-carbon",
      label: "C6 Bank Carbon",
      bgGradient: "from-[#18181b] via-[#111113] to-[#09090b]",
      border: "border-zinc-500/40",
      accentColor: "#F4F4F5",
      badgeStyle: "bg-zinc-700/30 text-zinc-200 border-zinc-600/30",
      chipColor: "#E4E4E7",
      textColor: "text-white",
      subtextColor: "text-zinc-400",
      brandFallback: "Mastercard Black",
    };
  }

  // 9. Bradesco / Prime
  if (text.includes("bradesco") || text.includes("prime")) {
    return {
      id: "bradesco-prime",
      label: "Bradesco",
      bgGradient: "from-[#2e0a12] via-[#1f060c] to-[#100306]",
      border: "border-rose-500/30",
      accentColor: "#CC092F",
      badgeStyle: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      chipColor: "#FECDD3",
      textColor: "text-white",
      subtextColor: "text-rose-100/70",
      brandFallback: "Visa Infinite",
    };
  }

  // 10. Santander / Select
  if (text.includes("santander") || text.includes("select")) {
    return {
      id: "santander-select",
      label: "Santander",
      bgGradient: "from-[#2c080b] via-[#1c0406] to-[#0d0203]",
      border: "border-red-500/30",
      accentColor: "#EA1D2C",
      badgeStyle: "bg-red-500/15 text-red-300 border-red-500/30",
      chipColor: "#FCA5A5",
      textColor: "text-white",
      subtextColor: "text-red-100/70",
      brandFallback: "Mastercard Platinum",
    };
  }

  // 11. Banco do Brasil / Ourocard
  if (text.includes("ourocard") || text.includes("banco do brasil") || text.includes("bb")) {
    return {
      id: "bb-ourocard",
      label: "Banco do Brasil Ourocard",
      bgGradient: "from-[#182338] via-[#101726] to-[#080c14]",
      border: "border-amber-400/35",
      accentColor: "#FBBF24",
      badgeStyle: "bg-amber-400/15 text-amber-300 border-amber-400/30",
      chipColor: "#FDE68A",
      textColor: "text-white",
      subtextColor: "text-amber-100/70",
      brandFallback: "Visa Gold",
    };
  }

  // 12. Caixa Econômica Federal
  if (text.includes("caixa") || text.includes("cef")) {
    return {
      id: "caixa-standard",
      label: "Caixa Econômica",
      bgGradient: "from-[#0c2340] via-[#08182b] to-[#040c17]",
      border: "border-sky-500/30",
      accentColor: "#0284C7",
      badgeStyle: "bg-sky-500/15 text-sky-200 border-sky-500/30",
      chipColor: "#BAE6FD",
      textColor: "text-white",
      subtextColor: "text-sky-100/70",
      brandFallback: "Elo Mais",
    };
  }

  // 13. Black / Infinite / Dourado Genéricos
  if (text.includes("black") || text.includes("infinite") || text.includes("nanquim")) {
    return {
      id: "premium-black",
      label: "Black Edition",
      bgGradient: "from-[#161618] via-[#101012] to-[#08080a]",
      border: "border-zinc-500/40",
      accentColor: "#F4F4F5",
      badgeStyle: "bg-white/10 text-zinc-200 border-white/20",
      chipColor: "#E4E4E7",
      textColor: "text-white",
      subtextColor: "text-zinc-400",
      brandFallback: "Black",
    };
  }

  if (text.includes("gold") || text.includes("ouro")) {
    return {
      id: "premium-gold",
      label: "Gold Edition",
      bgGradient: "from-[#292215] via-[#1c170e] to-[#0e0b07]",
      border: "border-amber-500/40",
      accentColor: "#F59E0B",
      badgeStyle: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      chipColor: "#FDE68A",
      textColor: "text-white",
      subtextColor: "text-amber-200/70",
      brandFallback: "Gold",
    };
  }

  if (text.includes("platinum") || text.includes("prata")) {
    return {
      id: "premium-platinum",
      label: "Platinum Edition",
      bgGradient: "from-[#1e293b] via-[#141b27] to-[#0b0e14]",
      border: "border-slate-400/40",
      accentColor: "#94A3B8",
      badgeStyle: "bg-slate-400/15 text-slate-200 border-slate-400/30",
      chipColor: "#E2E8F0",
      textColor: "text-white",
      subtextColor: "text-slate-300/70",
      brandFallback: "Platinum",
    };
  }

  // 14. Fallback Escuro Neutro Minimalista (Sleek Obsidian Kitsune)
  return {
    id: "dark-minimal-fallback",
    label: nameOrDesc || "Cartão Bancário",
    bgGradient: "from-[#18181b] via-[#121214] to-[#09090b]",
    border: "border-zinc-700/50",
    accentColor: "#FF8216",
    badgeStyle: "bg-[#FF8216]/15 text-[#FF8216] border-[#FF8216]/30",
    chipColor: "#FED7AA",
    textColor: "text-white",
    subtextColor: "text-zinc-400",
    brandFallback: "Crédito Internacional",
  };
}
