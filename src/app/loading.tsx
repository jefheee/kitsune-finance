import Image from "next/image";

export default function Loading() {
  return (
    <div className="flex-1 w-full min-h-[60vh] flex flex-col items-center justify-center relative p-6 select-none bg-[#0F141C]">
      {/* Warm Ambient Glow Radial */}
      <div className="absolute w-72 h-72 rounded-full bg-[#FF6B00]/12 blur-[90px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-5">
        {/* Breathing Logo Container */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-[#FF6B00]/25 blur-xl animate-pulse" />
          <div className="w-16 h-16 rounded-2xl bg-[#141A24] border border-[#263042] flex items-center justify-center shadow-xl relative">
            <Image
              src="/assets/logo/logo_sem_fundo.png"
              alt="Kitsune"
              width={38}
              height={38}
              className="object-contain animate-pulse"
              priority
            />
          </div>
        </div>

        {/* Text & Reassuring Security Pill */}
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-sm font-semibold text-[#F8FAFC] tracking-tight">
            Kitsune Finance
          </span>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#141A24] border border-[#263042] shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
            <span className="text-xs text-[#94A3B8] font-medium">
              Carregando dados protegidos...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
