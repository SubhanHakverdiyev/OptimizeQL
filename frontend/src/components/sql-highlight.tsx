"use client";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight, oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "@/context/theme-context";

export function SqlHighlight({ code }: { code: string }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <SyntaxHighlighter
      language="sql"
      style={isDark ? oneDark : oneLight}
      customStyle={{
        margin: 0,
        borderRadius: "0.75rem",
        fontSize: "0.875rem",
        lineHeight: "1.6",
        padding: "1rem 1.25rem",
        background: isDark ? "#1a1d27" : "#f8f9fa",
        border: isDark ? "1px solid #2a2d3a" : "1px solid #e9ecef",
      }}
    >
      {code}
    </SyntaxHighlighter>
  );
}
