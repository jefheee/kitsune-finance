"use client";

import { useState, useRef, useEffect } from "react";

export interface DropdownOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
}

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  className?: string;
  direction?: "up" | "down";
}

export default function CustomDropdown({
  value,
  onChange,
  options,
  placeholder = "Selecionar...",
  className = "",
  direction = "down",
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 text-left font-sans text-xs font-medium text-zinc-100 flex items-center justify-between gap-2 transition-colors cursor-pointer backdrop-blur-md"
      >
        <span className="truncate flex items-center gap-2">
          {selectedOption?.icon && (
            <span className="material-symbols-outlined text-[15px] text-amber-400">
              {selectedOption.icon}
            </span>
          )}
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span
          className={`material-symbols-outlined text-[16px] text-zinc-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </button>

      {isOpen && (
        <div
          className={`absolute left-0 right-0 min-w-[200px] z-[80] bg-zinc-900/95 border border-zinc-800 rounded-xl shadow-2xl backdrop-blur-xl p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150 ${
            direction === "up" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 rounded-lg text-left font-sans transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                  isSelected
                    ? "bg-amber-500/15 text-amber-400 font-semibold"
                    : "text-zinc-200 hover:bg-zinc-800/80"
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-xs leading-tight">{opt.label}</span>
                  {opt.description && (
                    <span className="text-[11px] text-zinc-400 font-normal mt-0.5">
                      {opt.description}
                    </span>
                  )}
                </div>
                {isSelected && (
                  <span className="material-symbols-outlined text-[16px] text-amber-400 shrink-0">
                    check
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
