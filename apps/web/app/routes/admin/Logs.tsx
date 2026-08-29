import { useState, useMemo } from "react";
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
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useRequireRole } from "~/hooks/useAuth";
import {
  Activity,
  Clock,
  Filter,
  Loader2,
  LogIn,
  ShieldCheck,
  Users,
  Search,
  X,
} from "lucide-react";
import { TablePagination } from "~/components/ui/table-pagination";
import { EmptyState } from "~/components/ui/empty-state";
import { StatCard } from "~/components/ui/stat-card";

export default function AdminLogs() {
  const user = useRequireRole("admin");

  const [page, setPage] = useState(1);
  const [activityFilter, setActivityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch logs
  const { data: logsData, isLoading } = useQuery({
    queryKey: ["admin-logs", page, activityFilter],
    queryFn: () =>
      adminAPI.getLogs({
        page,
        limit: 20,
        activityType: activityFilter !== "all" ? activityFilter : undefined,
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
  const pagination = logsData?.data?.pagination || {
    page: 1,
    pages: 1,
    total: 0,
  };
  const statsList = statsData?.data?.stats || [];
  const totalActions = statsData?.data?.totalActions ?? pagination.total;

  // Compute key KPI numbers
  const loginCount = useMemo(() => {
    const item = statsList.find((s: any) => s._id === "login");
    return item ? item.count : 0;
  }, [statsList]);

  const adminActionsCount = useMemo(() => {
    return statsList
      .filter(
        (s: any) => typeof s._id === "string" && s._id.startsWith("admin_"),
      )
      .reduce((sum: number, s: any) => sum + (s.count || 0), 0);
  }, [statsList]);

  const otherCount = Math.max(0, totalActions - loginCount - adminActionsCount);

  // Client-side search filter for currently loaded logs (or user email/name/ip)
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase().trim();
    return logs.filter((log: any) => {
      const userName = log.userId?.name?.toLowerCase() || "";
      const userEmail = log.userId?.email?.toLowerCase() || "";
      const ip = log.ipAddress?.toLowerCase() || "";
      const type = log.activityType?.toLowerCase() || "";
      return (
        userName.includes(q) ||
        userEmail.includes(q) ||
        ip.includes(q) ||
        type.includes(q)
      );
    });
  }, [logs, searchQuery]);

  if (!user) {
    return <PageLoading label="Loading activity logs…" />;
  }

  const renderActivityBadge = (type: string) => {
    switch (type) {
      case "login":
        return <Badge variant="info">login</Badge>;
      case "logout":
        return <Badge variant="outline">logout</Badge>;
      case "admin_create_user":
      case "admin_update_user":
      case "admin_delete_user":
      case "admin_change_role":
      case "admin_update_settings":
        return <Badge variant="warning">{type}</Badge>;
      default:
        return <Badge variant="default">{type}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* Page heading */}
      <header>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">
          Activity Logs
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Track all user activities and administrative changes in the system
        </p>
      </header>

      {/* KPI Stats Grid */}
      <section
        aria-label="Activity stats"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard
          icon={Activity}
          label="Total Events"
          value={totalActions}
          hint="Past 7 days"
        />
        <StatCard
          icon={LogIn}
          label="User Logins"
          value={loginCount}
          hint="Authentication events"
        />
        <StatCard
          icon={ShieldCheck}
          label="Admin Actions"
          value={adminActionsCount}
          hint="Settings & user edits"
        />
        <StatCard
          icon={Users}
          label="Other Activities"
          value={otherCount}
          hint="Exam & session activity"
        />
      </section>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user, email, IP, or type..."
              className="h-9 pl-9 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={activityFilter}
            onValueChange={(v) => {
              setActivityFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-48 h-9 text-xs">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Activities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Activities</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="logout">Logout</SelectItem>
              <SelectItem value="admin_create_user">User Created</SelectItem>
              <SelectItem value="admin_update_user">User Updated</SelectItem>
              <SelectItem value="admin_delete_user">User Deleted</SelectItem>
              <SelectItem value="admin_change_role">Role Changed</SelectItem>
              <SelectItem value="admin_update_settings">
                Settings Updated
              </SelectItem>
            </SelectContent>
          </Select>

          {(activityFilter !== "all" || searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActivityFilter("all");
                setSearchQuery("");
                setPage(1);
              }}
              className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Logs Table */}
      <Card className="shadow-none border-border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity logs found"
            description="No logs matched the selected filter or search criteria."
            withCard={false}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/30">
                  <TableHead className="w-44 text-xs font-semibold">
                    Time
                  </TableHead>
                  <TableHead className="min-w-56 text-xs font-semibold">
                    User
                  </TableHead>
                  <TableHead className="w-44 text-xs font-semibold">
                    Activity
                  </TableHead>
                  <TableHead className="w-48 text-xs font-semibold">
                    IP Address
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log: any) => (
                  <TableRow key={log._id}>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="font-medium text-foreground">
                            {new Date(log.timestamp).toLocaleDateString(
                              "vi-VN",
                            )}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2.5 min-w-0">
                        {log.userId?.avatar ? (
                          <img
                            src={log.userId.avatar}
                            alt={log.userId.name || "User"}
                            className="w-7 h-7 rounded-full object-cover border border-border shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                            {log.userId?.name?.charAt(0)?.toUpperCase() || "U"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {log.userId?.name || "System / Guest"}
                          </p>
                          {log.userId?.email && (
                            <p className="text-[11px] text-muted-foreground truncate">
                              {log.userId.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      {renderActivityBadge(log.activityType)}
                    </TableCell>

                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {log.ipAddress || "—"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <TablePagination
              page={pagination.page}
              pages={pagination.pages}
              total={pagination.total}
              limit={20}
              onPageChange={setPage}
              itemName="logs"
            />
          </>
        )}
      </Card>
    </div>
  );
}
