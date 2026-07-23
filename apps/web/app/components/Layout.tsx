import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  BookOpen,
  Calendar,
  FileText,
  Gauge,
  Layers,
  LogOut,
  Users,
} from "lucide-react";
import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import Logo from "~/assets/Logo.png";
import { authAPI } from "~/lib/api";
import { cn } from "~/lib/utils";
import { useUserStore } from "~/stores/userStore";

export default function Layout() {
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
    { name: "Dashboard", href: "/lecturer", icon: Gauge, exact: true },
    {
      name: "Templates",
      href: "/lecturer/exam-templates",
      icon: Layers,
      exact: false,
    },
    {
      name: "Classrooms",
      href: "/lecturer/classrooms",
      icon: Users,
      exact: false,
    },
    {
      name: "Sessions",
      href: "/lecturer/exam-sessions",
      icon: Calendar,
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
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col fixed inset-y-0 z-50">
        {/* Logo Section */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-gray-100">
          <img src={Logo} alt="Derit" className="h-8 w-8" />
          <span className="font-bold text-xl text-gray-900 tracking-tight">
            Derit
          </span>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Menu
          </p>

          {navigation.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-blue-50 text-primary ring-1 ring-blue-100"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                )}
              >
                <item.icon
                  className={cn(
                    "w-5 h-5 transition-colors",
                    active
                      ? "text-primary"
                      : "text-gray-400 group-hover:text-gray-600",
                  )}
                />
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* User / Footer Section */}
        <div className="border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex gap-4 items-center w-full cursor-pointer hover:bg-gray-100 px-4 py-2 justify-center rounded-sm">
                  <div className="cursor-pointer hover:opacity-80 transition">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-9 h-9 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-primary font-medium">
                        {user.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="hidden md:block">
                    <p className="text-sm font-medium text-gray-900">
                      {user.name}
                    </p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                className="w-full flex justify-center items-center"
              >
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-black cursor-pointer flex justify-center items-center rounded-sm"
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
      <div className="flex-1 flex flex-col ml-64 min-h-screen transition-all duration-300">
        <Outlet />
      </div>
    </div>
  );
}
