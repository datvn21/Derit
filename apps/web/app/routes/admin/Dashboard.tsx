import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, UserCheck, Activity, Clock } from "lucide-react";
import { PageLoading } from "~/components/ui/page-loading";
import { StatCard } from "~/components/ui/stat-card";
import { useRequireRole } from "~/hooks/useAuth";
import { adminAPI } from "~/lib/api";

export default function AdminDashboard() {
  const user = useRequireRole("admin");

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminAPI.getStats(),
    enabled: !!user,
  });

  // Fetch recent logs
  const { data: logsData } = useQuery({
    queryKey: ["admin-logs-recent"],
    queryFn: () => adminAPI.getLogs({ limit: 5 }),
    enabled: !!user,
  });

  if (!user) {
    return <PageLoading label="Loading admin dashboard…" />;
  }

  const stats = statsData?.data;
  const logs = logsData?.data?.logs || [];

  // Process user stats
  const userStatsMap: Record<string, number> = {};
  let totalUsers = 0;
  let activeUsers = 0;
  if (stats?.users) {
    stats.users.forEach((u: any) => {
      userStatsMap[u._id] = u.count;
      totalUsers += u.count;
      if (u._id !== "student") activeUsers += u.activeCount || 0;
    });
  }

  const studentCount = userStatsMap["student"] || 0;
  const lecturerCount = userStatsMap["lecturer"] || 0;
  const adminCount = userStatsMap["admin"] || 0;

  return (
    <div className="flex flex-col gap-8 p-6 max-w-7xl mx-auto w-full">
      {/* Page heading */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Admin Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back, {user.name}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>
      </header>

      {/* Stats Grid */}
      <section
        aria-label="Key stats"
        className="grid grid-cols-1 md:grid-cols-4 gap-5"
      >
          <StatCard
            icon={Users}
            label="Total Users"
            value={totalUsers}
            badge="All roles"
            hint={`${studentCount} Students · ${lecturerCount} Lecturers · ${adminCount} Admins`}
          />
          <StatCard
            icon={UserCheck}
            label="Students"
            value={studentCount}
            ctaLabel="Manage"
            ctaHref="/admin/users?role=student"
          />
          <StatCard
            icon={Users}
            label="Lecturers"
            value={lecturerCount}
            variant="muted"
            ctaLabel="Manage"
            ctaHref="/admin/users?role=lecturer"
          />
          <StatCard
            icon={Activity}
            label="Active (7 days)"
            value={stats?.recentLogins || 0}
            badge="Engagement"
            ctaLabel="View activity"
            ctaHref="/admin/logs"
          />
      </section>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Quick Actions */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-base font-semibold text-foreground mb-4">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <Link
                to="/admin/users"
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-[background-color] duration-(--motion-fast) ease-(--motion-ease)"
              >
                <Users className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Manage Users
                  </p>
                  <p className="text-xs text-muted-foreground">
                    View and edit user accounts
                  </p>
                </div>
              </Link>
              <Link
                to="/admin/settings"
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-[background-color] duration-(--motion-fast) ease-(--motion-ease)"
              >
                <Activity className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    System Settings
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Configure system preferences
                  </p>
                </div>
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">
                Recent Activity
              </h3>
              <Link
                to="/admin/logs"
                className="text-sm font-medium text-primary hover:text-primary-hover"
              >
                View All →
              </Link>
            </div>
            {logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No recent activity
              </div>
            ) : (
              <div className="space-y-2">
                {logs.slice(0, 5).map((log: any) => (
                  <div
                    key={log._id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center text-xs font-medium text-muted-foreground border border-border">
                        {log.userId?.name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {log.userId?.name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {log.activityType}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
