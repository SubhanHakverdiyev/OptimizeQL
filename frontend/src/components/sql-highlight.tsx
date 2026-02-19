"use client";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

export function SqlHighlight({ code }: { code: string }) {
  return (
    <SyntaxHighlighter
      language="sql"
      style={oneLight}
      customStyle={{
        margin: 0,
        borderRadius: "0.75rem",
        fontSize: "0.875rem",
        lineHeight: "1.6",
        padding: "1rem 1.25rem",
        background: "#f8f9fa",
        border: "1px solid #e9ecef",
      }}
    >
      {code}
    </SyntaxHighlighter>
  );
}
