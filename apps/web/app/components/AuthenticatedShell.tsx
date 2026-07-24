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
import { type ComponentType, type ReactNode, type SVGProps } from "react";
import { Link, Outlet, useLocation } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { LogOut, Shield } from "lucide-react";
import Logo from "~/components/Logo";
import { PageLoading } from "~/components/ui/page-loading";
import { cn } from "~/lib/utils";
import { useAuth } from "~/hooks/useAuth";
import type { Role } from "~/types/api";

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

export default function AuthenticatedShell({
  navigation,
  roleLabel,
  children,
}: AuthenticatedShellProps) {
  const location = useLocation();
  const { user, isLoading, logout } = useAuth();

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  if (isLoading || !user) {
    return <PageLoading label={`Loading ${roleLabel}…`} />;
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
            {roleLabel !== "Derit" && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                {roleLabel}
              </span>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Menu
          </p>
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
              <DropdownMenuContent side="right" className="w-48">
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
