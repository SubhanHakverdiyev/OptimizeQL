"use client";

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function SqlEditor({ value, onChange }: SqlEditorProps) {
  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your SQL query here..."
        className="w-full h-44 p-4 font-mono text-sm leading-relaxed
                   border border-gray-200 rounded-xl bg-gray-50/50
                   focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-200
                   focus:bg-white
                   resize-y placeholder-gray-300 transition-all"
        spellCheck={false}
      />
    </div>
  );
}
