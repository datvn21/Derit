import { useState } from "react";
import { adminAPI } from "~/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { PageLoading } from "~/components/ui/page-loading";
import { Button } from "~/components/ui/button";
import { useRequireRole } from "~/hooks/useAuth";
import {
  Activity,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

export default function AdminLogs() {
  const user = useRequireRole("admin");

  const [page, setPage] = useState(1);
  const [activityFilter, setActivityFilter] = useState("all");
  const [userFilter] = useState("");

  // Fetch logs
  const { data: logsData, isLoading } = useQuery({
    queryKey: ["admin-logs", page, activityFilter, userFilter],
    queryFn: () =>
      adminAPI.getLogs({
        page,
        limit: 20,
        activityType: activityFilter !== "all" ? activityFilter : undefined,
        userId: userFilter || undefined,
      }),
    enabled: !!user,
  });

  // Fetch log stats
  const { data: statsData } = useQuery({
    queryKey: ["admin-logs-stats"],
    queryFn: () => adminAPI.getLogStats(7),
    enabled: !!user,
  });

  const logs = logsData?.data?.logs || [];
  const pagination = logsData?.data?.pagination || { page: 1, pages: 1, total: 0 };
  const stats = statsData?.data?.stats || [];

  if (!user) {
    return <PageLoading label="Loading activity logs…" />;
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* Page heading */}
      <header>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">
          Activity Logs
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Track all user activities in the system
        </p>
      </header>

      {/* Stats */}
      <section
        aria-label="Activity stats"
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {stats.slice(0, 4).map((s: any) => (
          <div
            key={s._id}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="text-xl font-semibold text-foreground tracking-tight">
              {s.count}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-1">
              {s._id}
            </p>
          </div>
        ))}
      </section>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap gap-4">
          <Select
            value={activityFilter}
            onValueChange={(v) => {
              setActivityFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-45">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Activity Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Activities</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="logout">Logout</SelectItem>
              <SelectItem value="admin_create_user">User Created</SelectItem>
              <SelectItem value="admin_update_user">User Updated</SelectItem>
              <SelectItem value="admin_delete_user">User Deleted</SelectItem>
              <SelectItem value="admin_change_role">Role Changed</SelectItem>
              <SelectItem value="admin_update_settings">Settings Updated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm">No activity logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Time
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    User
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Activity
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    IP Address
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log: any) => (
                  <tr
                    key={log._id}
                    className="hover:bg-muted/50 transition-[background-color] duration-(--motion-fast) ease-(--motion-ease)"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p>{new Date(log.timestamp).toLocaleDateString()}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground border border-border">
                          {log.userId?.name?.charAt(0) || "?"}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {log.userId?.name || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {log.userId?.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant="default">{log.activityType}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">
                      {log.ipAddress || "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-muted">
            <p className="text-sm text-muted-foreground">
              Showing {(pagination.page - 1) * 20 + 1} to{" "}
              {Math.min(pagination.page * 20, pagination.total)} of{" "}
              {pagination.total} logs
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
