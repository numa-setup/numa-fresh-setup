import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, RefreshCw, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { api } from '@/lib/api';

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  STORE_CONFIRMED: 'bg-blue-100 text-blue-800',
  IN_PREPARATION: 'bg-purple-100 text-purple-800',
  REPLACEMENT_HANDLING: 'bg-orange-100 text-orange-800',
  READY_FOR_PICKUP: 'bg-teal-100 text-teal-800',
  OUT_FOR_DELIVERY: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-orange-100 text-orange-800',
};

interface LogEntry {
  id: string; orderId: string; orderNumber: string;
  status: string; note: string | null; createdBy: string | null;
  actorFirstName: string | null; actorLastName: string | null; actorEmail: string | null;
  createdAt: string;
}

export default function AdminAudit() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/admin/audit?page=${page}&limit=50`);
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch {}
    setLoading(false);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminLayout title="Audit Log" subtitle={`${total} recorded events`}>
      <div className="p-4 lg:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Order status history — every status change across the platform
          </p>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="rounded-xl h-9">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array(10).fill(0).map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}
              </div>
            ) : logs.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No audit events yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider">Order #</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider">Note</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider">Actor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-mono font-semibold">{log.orderNumber ?? log.orderId?.slice(0, 8)}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${STATUS_STYLE[log.status] ?? 'bg-muted text-muted-foreground'}`}>
                            {log.status?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate">
                          {log.note ?? '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          {log.createdBy ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <User className="w-3 h-3 text-primary" />
                              </div>
                              <span className="font-medium">
                                {log.actorFirstName && log.actorLastName
                                  ? `${log.actorFirstName} ${log.actorLastName}`
                                  : log.actorEmail ?? log.createdBy.slice(0, 8)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50">System</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-xl h-8 px-3">
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages} ({total} events)</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-xl h-8 px-3">
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
