import React from "react";

interface SpinnerProps {
  size?: number | "xs" | "sm" | "md" | "lg";
  className?: string;
  color?: string;
}

const SIZE_MAP: Record<string, number> = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 28,
};

export default function Spinner({
  size = 18,
  className = "",
  color = "currentColor",
}: SpinnerProps) {
  const pixelSize =
    typeof size === "number" ? size : SIZE_MAP[size] || 18;

  return (
    <svg
      className={`animate-spin shrink-0 ${className}`}
      width={pixelSize}
      height={pixelSize}
      style={{ width: `${pixelSize}px`, height: `${pixelSize}px`, minWidth: `${pixelSize}px`, minHeight: `${pixelSize}px` }}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="status"
      aria-label="Carregando"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        fill={color}
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
