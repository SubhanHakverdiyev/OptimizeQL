"use client";

import { useState } from "react";
import type { ConnectionCreate } from "@/lib/types";

interface ConnectionFormProps {
  onSubmit: (data: ConnectionCreate) => Promise<void>;
  onCancel: () => void;
}

export function ConnectionForm({ onSubmit, onCancel }: ConnectionFormProps) {
  const [form, setForm] = useState<ConnectionCreate>({
    name: "",
    db_type: "postgresql",
    host: "localhost",
    port: 5432,
    database: "",
    username: "",
    password: "",
    ssl_enabled: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create connection");
    } finally {
      setLoading(false);
    }
  };

  const update = <K extends keyof ConnectionCreate>(key: K, value: ConnectionCreate[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="border border-(--color-border-strong) rounded-lg p-4 bg-(--color-surface) space-y-4">
      <h3 className="text-base font-semibold text-(--color-foreground)">Add Connection</h3>

      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</p>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-(--color-text-muted) mb-1">Name</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="w-full px-3 py-2 border border-(--color-border-strong) rounded-lg text-sm bg-(--color-surface) text-(--color-foreground) focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] dark:focus:ring-blue-500"
            placeholder="My Database"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-(--color-text-muted) mb-1">Type</label>
          <select
            value={form.db_type}
            onChange={(e) => {
              const type = e.target.value as "postgresql" | "mysql";
              update("db_type", type);
              update("port", type === "postgresql" ? 5432 : 3306);
            }}
            className="w-full px-3 py-2 border border-(--color-border-strong) rounded-lg text-sm bg-(--color-surface) text-(--color-foreground) focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] dark:focus:ring-blue-500"
          >
            <option value="postgresql">PostgreSQL</option>
            <option value="mysql">MySQL</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-(--color-text-muted) mb-1">Host</label>
          <input
            type="text"
            required
            value={form.host}
            onChange={(e) => update("host", e.target.value)}
            className="w-full px-3 py-2 border border-(--color-border-strong) rounded-lg text-sm bg-(--color-surface) text-(--color-foreground) focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] dark:focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-(--color-text-muted) mb-1">Port</label>
          <input
            type="number"
            required
            value={form.port}
            onChange={(e) => update("port", parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-(--color-border-strong) rounded-lg text-sm bg-(--color-surface) text-(--color-foreground) focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] dark:focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-(--color-text-muted) mb-1">Database</label>
          <input
            type="text"
            required
            value={form.database}
            onChange={(e) => update("database", e.target.value)}
            className="w-full px-3 py-2 border border-(--color-border-strong) rounded-lg text-sm bg-(--color-surface) text-(--color-foreground) focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] dark:focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-(--color-text-muted) mb-1">Username</label>
          <input
            type="text"
            required
            value={form.username}
            onChange={(e) => update("username", e.target.value)}
            className="w-full px-3 py-2 border border-(--color-border-strong) rounded-lg text-sm bg-(--color-surface) text-(--color-foreground) focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] dark:focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-(--color-text-muted) mb-1">Password</label>
          <input
            type="password"
            required
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            className="w-full px-3 py-2 border border-(--color-border-strong) rounded-lg text-sm bg-(--color-surface) text-(--color-foreground) focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] dark:focus:ring-blue-500"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-(--color-text-muted)">
            <input
              type="checkbox"
              checked={form.ssl_enabled}
              onChange={(e) => update("ssl_enabled", e.target.checked)}
              className="rounded border-gray-300"
            />
            SSL Enabled
          </label>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-[#1e3a5f] dark:bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-[#2a4d7a] dark:hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Creating..." : "Create Connection"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-(--color-text-muted) text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
