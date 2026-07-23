import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Settings,
  Shield,
  LogOut,
  Users,
  FileText,
  BarChart3,
  Activity,
} from "lucide-react";
import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import Logo from "~/assets/Logo.png";
import { authAPI } from "~/lib/api";
import { cn } from "~/lib/utils";
import { useUserStore } from "~/stores/userStore";

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, setUser, logout } = useUserStore();

  const handleLogout = async () => {
    await authAPI.logout();
    logout();
    navigate("/");
  };

  useEffect(() => {
    authAPI
      .getUser()
      .then((res) => {
        setUser(res.data);
      })
      .catch(() => {
        navigate("/");
      });
  }, [navigate, setUser]);

  const navigation = [
    { name: "Dashboard", href: "/admin", icon: BarChart3, exact: true },
    {
      name: "Users",
      href: "/admin/users",
      icon: Users,
      exact: false,
    },
    {
      name: "Activity Logs",
      href: "/admin/logs",
      icon: Activity,
      exact: false,
    },
    {
      name: "Settings",
      href: "/admin/settings",
      icon: Settings,
      exact: false,
    },
  ];

  const isActive = (path: string, exact: boolean) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* Sidebar - Light Theme */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col fixed inset-y-0 z-50">
        {/* Logo Section */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-gray-200">
          <img src={Logo} alt="Derit" className="h-8 w-8" />
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900 tracking-tight">
              Derit
            </span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Admin Panel
            </span>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          <p className="px-3 text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Management
          </p>

          {navigation.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                )}
              >
                <item.icon
                  className={cn(
                    "w-5 h-5 transition-colors",
                    active ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600",
                  )}
                />
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* User / Footer Section */}
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-center p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex gap-4 items-center w-full cursor-pointer hover:bg-gray-100 p-2 rounded-lg justify-center transition">
                  <div className="cursor-pointer hover:opacity-80 transition">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-9 h-9 rounded-full object-cover border-2 border-gray-200"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium">
                        {user.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {user.isSuperAdmin ? "Super Admin" : "Admin"}
                    </p>
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" className="w-48">
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-600 cursor-pointer focus:text-red-600 focus:bg-red-50"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col ml-64 min-h-screen">
        <Outlet />
      </div>
    </div>
  );
}
