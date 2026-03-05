"use client";

import Editor from "@monaco-editor/react";
import { useTheme } from "@/context/theme-context";

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function SqlEditor({ value, onChange }: SqlEditorProps) {
  const { theme } = useTheme();

  return (
    <div className="relative rounded-xl overflow-hidden border border-(--color-border-strong)
                    focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900
                    focus-within:border-blue-200 dark:focus-within:border-blue-700 transition-all">
      <Editor
        height="176px"
        language="sql"
        theme={theme === "dark" ? "vs-dark" : "vs"}
        value={value}
        onChange={(val) => onChange(val ?? "")}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: "off",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          padding: { top: 16, bottom: 16 },
          renderLineHighlight: "none",
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          scrollbar: { vertical: "auto", horizontal: "hidden" },
          suggest: { showKeywords: true },
          folding: false,
          glyphMargin: false,
          lineDecorationsWidth: 16,
          lineNumbersMinChars: 0,
        }}
      />
      {!value && (
        <div className="absolute top-4 left-4 pointer-events-none text-sm text-(--color-text-faint) font-mono">
          Enter your SQL query here...
        </div>
      )}
    </div>
  );
}
