"use client";

import { AnalysisProvider } from "@/context/analysis-context";
import { ThemeProvider } from "@/context/theme-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AnalysisProvider>{children}</AnalysisProvider>
    </ThemeProvider>
  );
}
