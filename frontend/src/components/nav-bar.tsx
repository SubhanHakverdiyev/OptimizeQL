"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/context/theme-context";

function AnalyzeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
      <path d="M11 8v6M8 11h6" />
    </svg>
  );
}

function ConnectionsIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function DocsIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

const isHosted = !!(process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes("localhost"));

const allLinks = [
  { href: "/", label: "Dashboard", icon: <DashboardIcon />, selfHostedOnly: true },
  { href: "/analyze", label: "Analyze", icon: <AnalyzeIcon /> },
  { href: "/connections", label: "Connections", icon: <ConnectionsIcon />, selfHostedOnly: true },
  { href: "/history", label: "History", icon: <HistoryIcon /> },
  { href: "/settings", label: "LLM Settings", icon: <SettingsIcon />, selfHostedOnly: true },
];

const mainLinks = allLinks.filter((link) => !isHosted || !link.selfHostedOnly);

export function NavBar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="w-[300px] shrink-0 min-h-screen bg-(--color-background) border-r border-(--color-border) flex flex-col py-6 px-6">
      {/* Brand — links to homepage */}
      <Link href="/" className="flex items-center gap-3 px-2 mb-8 group">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
          <svg width="32" height="32" viewBox="0 0 80 80" fill="none">
            <defs>
              <linearGradient id="navLogoBg" x1="10" y1="8" x2="70" y2="72" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#1e3a5f"/>
                <stop offset="1" stopColor="#2D5B8E"/>
              </linearGradient>
            </defs>
            <rect x="4" y="4" width="72" height="72" rx="22" fill="url(#navLogoBg)"/>
            <circle cx="39" cy="38" r="16" stroke="white" strokeWidth="3.5"/>
            <circle cx="53" cy="30" r="4.5" fill="#F6D2B8"/>
            <path d="M50 49L59 58" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="text-base font-bold text-(--color-foreground) tracking-tight group-hover:opacity-80 transition-opacity">
          OptimizeQL<span className="text-gray-300 dark:text-gray-600">.</span>
        </span>
      </Link>

      {/* Menu section */}
      <div className="mb-6">
        <p className="text-[10px] font-semibold text-(--color-text-faint) uppercase tracking-widest px-3 mb-2">
          Menu
        </p>
        <nav className="space-y-0.5">
          {mainLinks.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-white/70 dark:bg-white/10 text-(--color-foreground) shadow-sm backdrop-blur-sm"
                    : "text-(--color-text-muted) hover:bg-gray-50 dark:hover:bg-white/5 hover:text-(--color-foreground)"
                }`}
              >
                {link.icon}
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Theme toggle */}
      <div className="mb-6 px-3">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium
                     text-(--color-text-muted) hover:bg-gray-50 dark:hover:bg-white/5 hover:text-(--color-foreground) transition-all"
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
      </div>

      {/* Support section pinned to bottom */}
      <div className="mt-auto">
        <p className="text-[10px] font-semibold text-(--color-text-faint) uppercase tracking-widest px-3 mb-2">
          Support
        </p>
        <nav className="space-y-0.5">
          {!isHosted && (
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-(--color-text-muted) hover:bg-gray-50 dark:hover:bg-white/5 hover:text-(--color-foreground) transition-all"
            >
              <DocsIcon />
              API Docs
            </a>
          )}
          <a
            href="#"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-(--color-text-muted) hover:bg-gray-50 dark:hover:bg-white/5 hover:text-(--color-foreground) transition-all"
          >
            <HelpIcon />
            Help
          </a>
        </nav>
      </div>
    </aside>
  );
}
