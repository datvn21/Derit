import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { useUserStore } from "~/stores/userStore";
import { authAPI, adminAPI } from "~/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Users, UserCheck, UserX, Activity, Clock } from "lucide-react";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, setUser } = useUserStore();

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

  // Fetch stats
  const { data: statsData, isLoading: isLoadingStats } = useQuery({
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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  const stats = statsData?.data;
  const logs = logsData?.data?.logs || [];

  // Process user stats
  const userStatsMap = {};
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Admin Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">
                Welcome back, {user.name}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Clock className="w-4 h-4" />
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto px-8 w-full py-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {/* Total Users */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold text-gray-900 tracking-tight">{totalUsers}</h3>
              <p className="text-sm text-gray-500">Total Users</p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex justify-between text-xs text-gray-400">
                <span>{studentCount} Students</span>
                <span>{lecturerCount} Lecturers</span>
                <span>{adminCount} Admins</span>
              </div>
            </div>
          </div>

          {/* Students */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <UserCheck className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold text-gray-900 tracking-tight">{studentCount}</h3>
              <p className="text-sm text-gray-500">Students</p>
            </div>
            <div className="mt-4">
              <Link
                to="/admin/users?role=student"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Manage Students →
              </Link>
            </div>
          </div>

          {/* Lecturers */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold text-gray-900 tracking-tight">{lecturerCount}</h3>
              <p className="text-sm text-gray-500">Lecturers</p>
            </div>
            <div className="mt-4">
              <Link
                to="/admin/users?role=lecturer"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Manage Lecturers →
              </Link>
            </div>
          </div>

          {/* Recent Logins */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-orange-50 rounded-lg">
                <Activity className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold text-gray-900 tracking-tight">
                {stats?.recentLogins || 0}
              </h3>
              <p className="text-sm text-gray-500">Active (7 days)</p>
            </div>
            <div className="mt-4">
              <Link
                to="/admin/logs"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                View Activity →
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Actions & Recent Activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Quick Actions */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                to="/admin/users"
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition"
              >
                <Users className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Manage Users</p>
                  <p className="text-xs text-gray-500">View and edit user accounts</p>
                </div>
              </Link>
              <Link
                to="/admin/settings"
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition"
              >
                <Activity className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">System Settings</p>
                  <p className="text-xs text-gray-500">Configure system preferences</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Recent Activity</h3>
              <Link
                to="/admin/logs"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                View All →
              </Link>
            </div>
            {logs.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                No recent activity
              </div>
            ) : (
              <div className="space-y-2">
                {logs.slice(0, 5).map((log: any) => (
                  <div
                    key={log._id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                        {log.userId?.name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {log.userId?.name || "Unknown"}
                        </p>
                        <p className="text-xs text-gray-500">{log.activityType}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
