/**
 * AuthenticatedShell — shared layout chrome used by lecturer/admin/student
 * apps. Replaces two near-identical sidebar implementations (lecturer and
 * admin) with one configurable `AppSidebar`. Pages should not roll their
 * own sidebar markup.
 *
 * Tokens used (per `design.md` / `app.css` `:root` block):
 *   - surface:    bg-background · bg-sidebar · bg-card
 *   - text:       text-foreground · text-sidebar-foreground · text-muted-foreground
 *   - hairline:   border-sidebar-border · border-border
 *   - accent:     bg-sidebar-accent · text-sidebar-accent-foreground
 *   - motion:     --motion-fast var(--motion-ease) (150ms)
 */
import {
  type ComponentType,
  type ReactNode,
  type SVGProps,
  useEffect,
  useState,
} from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  CalendarDays,
  FileText,
  GraduationCap,
  LogOut,
  Shield,
  Users,
} from "lucide-react";
import Logo from "~/components/Logo";
import { PageLoading } from "~/components/ui/page-loading";
import { cn } from "~/lib/utils";
import { useAuth } from "~/hooks/useAuth";
import type { Role } from "~/types/api";
import {
  getRecentItems,
  RECENTS_UPDATED_EVENT,
  type RecentItem,
} from "~/lib/recents";

export interface NavItem {
  name: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  exact?: boolean;
}

export interface AuthenticatedShellProps {
  navigation: NavItem[];
  roleLabel: string;
  children?: ReactNode;
}

type ModeItem = {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export default function AuthenticatedShell({
  navigation,
  roleLabel,
  children,
}: AuthenticatedShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading, logout } = useAuth();
  const isLecturer = roleLabel === "Lecturer";
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  useEffect(() => {
    if (!isLecturer) return;

    const updateRecents = () => setRecentItems(getRecentItems());
    updateRecents();
    window.addEventListener(RECENTS_UPDATED_EVENT, updateRecents);
    return () => window.removeEventListener(RECENTS_UPDATED_EVENT, updateRecents);
  }, [isLecturer]);

  if (isLoading || !user) {
    return <PageLoading label={`Loading ${roleLabel}…`} />;
  }

  const canOpenAdmin = user.role === "admin" || user.isSuperAdmin;
  const canOpenLecturer =
    user.role === "lecturer" || user.role === "admin" || user.isSuperAdmin;
  const modeItems: ModeItem[] = [];

  if (roleLabel !== "Admin Panel" && canOpenAdmin) {
    modeItems.push({
      label: "Switch to Admin",
      href: "/admin",
      icon: Shield,
    });
  }

  if (roleLabel !== "Lecturer" && canOpenLecturer) {
    modeItems.push({
      label: "Switch to Lecturer",
      href: "/lecturer",
      icon: GraduationCap,
    });
  }

  return (
    <div className="min-h-screen bg-background flex font-sans">
      <aside
        aria-label={`${roleLabel} navigation`}
        className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col fixed inset-y-0 z-50"
      >
        <div className="flex items-center gap-3 px-6 h-16 ">
          <Logo size="sm" />
          <div className="flex flex-col">
            <span className="font-semibold text-foreground tracking-tight">
              Derit
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {roleLabel}
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {navigation.map((item) => {
            const active = isActive(item.href, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                  "transition-[color,background-color] duration-(--motion-fast) ease-(--motion-ease)",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5",
                    "transition-colors duration-(--motion-fast) ease-(--motion-ease)",
                    active
                      ? "text-sidebar-accent-foreground"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                {item.name}
              </Link>
            );
          })}

          {isLecturer && recentItems.length > 0 && (
            <div className="mt-8 pt-5 border-t border-sidebar-border">
              <p className="px-3 mb-2 text-xs font-medium text-muted-foreground">
                Recents
              </p>
              {recentItems.map((item) => {
                const Icon =
                  item.type === "Template"
                    ? FileText
                    : item.type === "Session"
                      ? CalendarDays
                      : Users;
                const active = location.pathname === item.href;
                return (
                  <Link
                    key={`recent-${item.name}`}
                    to={item.href}
                    className={cn(
                      "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
                      "transition-[color,background-color] duration-(--motion-fast) ease-(--motion-ease)",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon
                      className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-foreground"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 truncate">
                      <span className="block truncate">{item.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {item.type}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        <div className="border-t border-sidebar-border bg-sidebar">
          <div className="flex items-center justify-center p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex gap-3 items-center w-full cursor-pointer hover:bg-muted p-2 rounded-lg justify-center transition-[background-color] duration-(--motion-fast) ease-(--motion-ease)"
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-9 h-9 rounded-full object-cover border-2 border-sidebar-border"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-accent-foreground font-medium">
                      {user.name.charAt(0)}
                    </div>
                  )}
                  <span className="hidden md:block text-left text-sm">
                    <span className="block font-medium text-foreground">
                      {user.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" className="w-52">
                {modeItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem
                      key={item.href}
                      onSelect={() => navigate(item.href)}
                      className="cursor-pointer"
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.label}
                    </DropdownMenuItem>
                  );
                })}
                {modeItems.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onClick={() => void logout()}
                  className="text-destructive cursor-pointer focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      <main
        id="main-content"
        className="flex-1 flex flex-col ml-64 min-h-screen"
        role="main"
      >
        {children ?? <Outlet />}
      </main>
    </div>
  );
}

// Role helper for downstream code that needs to pick a default redirect.
export const roleHomePath = (role: Role | undefined): string => {
  switch (role) {
    case "lecturer":
      return "/lecturer";
    case "admin":
      return "/admin";
    case "student":
      return "/student";
    default:
      return "/";
  }
};
