"use client";

import { AnalysisProvider } from "@/context/analysis-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return <AnalysisProvider>{children}</AnalysisProvider>;
}
