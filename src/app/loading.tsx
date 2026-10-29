import Image from "next/image";

export default function Loading() {
  return (
    <div className="flex-1 w-full min-h-[60vh] flex flex-col items-center justify-center relative p-6 select-none bg-slate-50 dark:bg-[#0A0A0A]">
      {/* Sutil ambient glow */}
      <div className="absolute w-64 h-64 rounded-full bg-[#FF8216]/10 blur-[80px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-4">
        {/* Breathing Logo Container */}
        <div className="relative flex items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] flex items-center justify-center shadow-md relative">
            <Image
              src="/assets/logo/logo_sem_fundo.png"
              alt="Kitsune"
              width={34}
              height={34}
              className="object-contain animate-pulse"
              priority
            />
          </div>
        </div>

        {/* Text & Reassuring Security Pill */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <span className="text-sm font-bold text-slate-800 dark:text-[#F8FAFC] tracking-tight">
            Kitsune Finance
          </span>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium">
              Carregando dados com segurança...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
