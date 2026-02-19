"use client";

import { useState } from "react";
import type { ConnectionResponse } from "@/lib/types";
import { deleteConnection, testConnection } from "@/lib/api-client";

interface ConnectionListProps {
  connections: ConnectionResponse[];
  onRefresh: () => void;
}

export function ConnectionList({ connections, onRefresh }: ConnectionListProps) {
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);

  const handleTest = async (id: string) => {
    setTesting(id);
    setTestResult(null);
    try {
      const result = await testConnection(id);
      setTestResult({ id, ok: result.success, msg: result.message });
    } catch (err) {
      setTestResult({ id, ok: false, msg: err instanceof Error ? err.message : "Test failed" });
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this connection?")) return;
    try {
      await deleteConnection(id);
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  if (connections.length === 0) {
    return <p className="text-sm text-gray-500">No connections configured yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 font-medium text-gray-600">Name</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Type</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Host</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Database</th>
            <th className="text-right py-2 px-3 font-medium text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {connections.map((conn) => (
            <tr key={conn.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-3 font-medium text-gray-900">{conn.name}</td>
              <td className="py-2 px-3">
                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">
                  {conn.db_type}
                </span>
              </td>
              <td className="py-2 px-3 text-gray-600">
                {conn.host}:{conn.port}
              </td>
              <td className="py-2 px-3 text-gray-600">{conn.database}</td>
              <td className="py-2 px-3 text-right space-x-2">
                <button
                  onClick={() => handleTest(conn.id)}
                  disabled={testing === conn.id}
                  className="px-2 py-1 text-xs rounded bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
                >
                  {testing === conn.id ? "Testing..." : "Test"}
                </button>
                <button
                  onClick={() => handleDelete(conn.id)}
                  className="px-2 py-1 text-xs rounded bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                >
                  Delete
                </button>
                {testResult && testResult.id === conn.id && (
                  <span className={`text-xs ml-2 ${testResult.ok ? "text-green-600" : "text-red-600"}`}>
                    {testResult.msg}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
