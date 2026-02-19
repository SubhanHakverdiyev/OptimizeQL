"use client";

import { useCallback, useEffect, useState } from "react";
import { ConnectionList } from "@/components/connection-list";
import { ConnectionForm } from "@/components/connection-form";
import { createConnection, listConnections } from "@/lib/api-client";
import type { ConnectionCreate, ConnectionResponse } from "@/lib/types";

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<ConnectionResponse[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchConnections = useCallback(async () => {
    try {
      const data = await listConnections();
      setConnections(data);
    } catch {
      // silently fail — user will see empty list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleCreate = async (data: ConnectionCreate) => {
    await createConnection(data);
    setShowForm(false);
    fetchConnections();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Database Connections</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your database connections for live query analysis.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-[#1e3a5f] text-white text-sm font-medium rounded-lg hover:bg-[#2a4d7a] transition-colors"
          >
            Add Connection
          </button>
        )}
      </div>

      {showForm && (
        <ConnectionForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading connections...</p>
      ) : (
        <ConnectionList connections={connections} onRefresh={fetchConnections} />
      )}
    </div>
  );
}
