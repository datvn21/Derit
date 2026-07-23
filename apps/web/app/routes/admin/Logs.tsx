import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useUserStore } from "~/stores/userStore";
import { authAPI, adminAPI } from "~/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Activity,
  Clock,
  User,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

export default function AdminLogs() {
  const navigate = useNavigate();
  const { user, setUser } = useUserStore();

  const [page, setPage] = useState(1);
  const [activityFilter, setActivityFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("");

  // Auth check
  useEffect(() => {
    authAPI
      .getUser()
      .then((res) => {
        if (res.data.role !== "admin" && !res.data.isSuperAdmin) {
          navigate("/");
        } else {
          setUser(res.data);
        }
      })
      .catch(() => {
        navigate("/");
      });
  }, [navigate, setUser]);

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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-5">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Activity Logs</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Track all user activities in the system
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto px-8 w-full py-5 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.slice(0, 4).map((s: any) => (
            <div
              key={s._id}
              className="bg-white rounded-lg border border-gray-200 p-4"
            >
              <p className="text-xl font-semibold text-gray-900 tracking-tight">{s.count}</p>
              <p className="text-xs text-gray-500 truncate mt-1">{s._id}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex flex-wrap gap-4">
            <Select
              value={activityFilter}
              onValueChange={(v) => {
                setActivityFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2 text-gray-400" />
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
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Activity className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No activity logs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Activity
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP Address
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log: any) => (
                    <tr key={log._id} className="hover:bg-gray-50/50 transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <div>
                            <p>{new Date(log.timestamp).toLocaleDateString()}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                            {log.userId?.name?.charAt(0) || "?"}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {log.userId?.name || "Unknown"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {log.userId?.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                          {log.activityType}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-500">
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
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-500">
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
                <span className="text-sm text-gray-600">
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
      </main>
    </div>
  );
}
