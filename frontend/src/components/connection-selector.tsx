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
      className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50/50 text-sm text-gray-600
                 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-200
                 focus:bg-white transition-all"
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
