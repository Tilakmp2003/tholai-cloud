import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import axios from "axios";
import { ShieldCheck, ShieldAlert, FileText } from "lucide-react";

interface AuditEntry {
  id: string;
  type: string;
  payload: string;
  hash: string;
  createdAt: string;
}

interface AuditViewerProps {
  proposalId: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function AuditViewer({ proposalId }: AuditViewerProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [proposalId]);

  async function fetchLogs() {
    try {
      const res = await axios.get(`${API_URL}/api/audit/${proposalId}`);
      setEntries(res.data);
    } catch (err) {
      console.error("Failed to fetch audit logs", err);
    } finally {
      setLoading(false);
    }
  }

  async function verify(entry: AuditEntry) {
    try {
      const res = await axios.get(`${API_URL}/api/audit/entry/${entry.id}/verify`);
      if (res.data.ok) {
        toast.success("Integrity Verified: Hash matches payload.");
      } else {
        toast.error("Integrity Check FAILED: Hash mismatch!");
      }
    } catch (err) {
      toast.error("Verification failed: Server error");
    }
  }

  if (loading) return <div className="text-zinc-500 text-sm">Loading audit trail...</div>;

  return (
    <Card className="bg-zinc-900 border-zinc-800 text-white mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          Immutable Audit Trail
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-500">No audit logs found for this proposal.</p>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="p-3 border border-zinc-800 rounded bg-zinc-950/50">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-medium text-zinc-300 flex items-center gap-2">
                    {e.type}
                    <span className="text-xs text-zinc-500 font-normal">
                      ({new Date(e.createdAt).toLocaleString()})
                    </span>
                  </div>
                  <div className="text-xs font-mono text-zinc-600 mt-1 truncate max-w-[300px]">
                    Hash: {e.hash}
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => verify(e)}
                  className="h-7 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                >
                  Verify
                </Button>
              </div>
              <pre className="text-xs text-zinc-400 bg-zinc-900 p-2 rounded overflow-x-auto font-mono">
                {e.payload}
              </pre>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
