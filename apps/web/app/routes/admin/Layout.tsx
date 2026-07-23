import { Activity, BarChart3, FileText, Settings, Shield, Users } from "lucide-react";
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

// Shield kept for future use; FileText kept as a placeholder for upcoming export routes.
void Shield;
void FileText;
