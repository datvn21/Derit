import { Activity, BarChart3, Settings, Users } from "lucide-react";
import AuthenticatedShell, { type NavItem } from "~/components/AuthenticatedShell";

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/admin", icon: BarChart3, exact: true },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Activity Logs", href: "/admin/logs", icon: Activity },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

export default function AdminLayout() {
  return <AuthenticatedShell navigation={navigation} roleLabel="Admin Panel" />;
}
