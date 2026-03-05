"use client";

import type { ConnectionResponse } from "@/lib/types";

interface ConnectionSelectorProps {
  connections: ConnectionResponse[];
  value: string | null;
  onChange: (id: string | null) => void;
}

export function ConnectionSelector({ connections, value, onChange }: ConnectionSelectorProps) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full px-3 py-2 border border-(--color-border-strong) rounded-xl bg-(--color-surface-muted) text-sm text-(--color-text-muted)
                 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 focus:border-blue-200 dark:focus:border-blue-700
                 focus:bg-(--color-surface) transition-all"
    >
      <option value="">No connection (static analysis only)</option>
      {connections.map((conn) => (
        <option key={conn.id} value={conn.id}>
          {conn.name} ({conn.db_type} - {conn.host}:{conn.port}/{conn.database})
        </option>
      ))}
    </select>
  );
}
