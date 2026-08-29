import { Gauge, History } from "lucide-react";
import AuthenticatedShell, { type NavItem } from "~/components/AuthenticatedShell";

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/student", icon: Gauge, exact: true },
  { name: "History", href: "/student/history", icon: History },
];

export default function StudentLayout() {
  return <AuthenticatedShell navigation={navigation} roleLabel="Student" />;
}
