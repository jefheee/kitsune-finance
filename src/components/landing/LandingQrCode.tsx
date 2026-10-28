"use client";

import dynamic from "next/dynamic";
import Image from "next/image";

const QRCodeComponent = dynamic(
  () => import("@/components/shared-assets/qr-code").then((mod) => mod.QRCode),
  {
    ssr: false,
    loading: () => (
      <div className="w-32 h-32 flex items-center justify-center bg-zinc-900 rounded-2xl animate-pulse text-[#FF8216]">
        <span className="material-symbols-outlined text-3xl">qr_code_2</span>
      </div>
    ),
  }
);

export function LandingQrCode() {
  return (
    <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-3xl bg-[#121214] border border-white/10 p-4 relative flex items-center justify-center shadow-2xl group">
      <QRCodeComponent
        value="https://kitsune-finance.vercel.app"
        size="lg"
        className="w-full h-full text-white"
        options={{
          width: 170,
          height: 170,
          dotsOptions: {
            color: "#FFFFFF",
            type: "rounded",
          },
          cornersSquareOptions: {
            color: "#FF8216",
            type: "extra-rounded",
          },
          cornersDotOptions: {
            color: "#FF8216",
            type: "dot",
          },
          backgroundOptions: {
            color: "transparent",
          },
        }}
      />
      {/* Central Mascot Badge */}
      <div className="absolute w-12 h-12 bg-black rounded-xl border border-white/20 p-2 flex items-center justify-center shadow-xl pointer-events-none group-hover:scale-110 transition-transform">
        <Image
          src="/assets/logo/logo_sem_fundo.png"
          alt="Kitsune Logo"
          width={28}
          height={28}
          className="object-contain"
        />
      </div>
    </div>
  );
}
