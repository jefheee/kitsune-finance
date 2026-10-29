import { VisionAnalyzer } from "@/components/vision/VisionAnalyzer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kitsune Vision • Análise Multimodal Financeira com IA",
  description:
    "Envie ou tire fotos de cardápios, produtos, orçamentos e simulações de financiamento para obter diagnósticos instantâneos da IA com cálculos patrimoniais.",
};

export default function VisionPage() {
  return (
    <div className="flex-1 w-full h-full p-4 md:p-8 overflow-y-auto">
      <VisionAnalyzer />
    </div>
  );
}
