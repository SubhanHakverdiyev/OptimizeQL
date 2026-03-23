"use client";

import type { AnalyzeMode } from "@/lib/types";

interface ModeSelectorProps {
  mode: AnalyzeMode;
  onChange: (mode: AnalyzeMode) => void;
}

const isHosted = !!(process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes("localhost"));

const allModes: { value: AnalyzeMode; label: string; icon: string; selfHostedOnly?: boolean }[] = [
  { value: "connect", label: "Connect DB", icon: "plug", selfHostedOnly: true },
  { value: "playground", label: "Playground", icon: "play" },
  { value: "none", label: "No Connection", icon: "edit" },
];

const modes = allModes.filter((m) => {
  if (m.selfHostedOnly && isHosted) return false;
  return true;
});

const icons: Record<string, React.ReactNode> = {
  plug: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
  ),
  play: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
    </svg>
  ),
  edit: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
    </svg>
  ),
};

export default function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div className="inline-flex rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-1 gap-1">
      {modes.map((m) => (
        <button
          key={m.value}
          onClick={() => onChange(m.value)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
            mode === m.value
              ? "bg-[#1e3a5f] text-white shadow-sm"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]"
          }`}
        >
          {icons[m.icon]}
          {m.label}
        </button>
      ))}
    </div>
  );
}
