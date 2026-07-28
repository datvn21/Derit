import { Calendar, Gauge, Layers, Users } from "lucide-react";
import AuthenticatedShell, { type NavItem } from "~/components/AuthenticatedShell";

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/lecturer", icon: Gauge, exact: true },
  { name: "Templates", href: "/lecturer/exam-templates", icon: Layers },
  { name: "Classrooms", href: "/lecturer/classrooms", icon: Users },
  { name: "Sessions", href: "/lecturer/exam-sessions", icon: Calendar },
];

export default function Layout() {
  return <AuthenticatedShell navigation={navigation} roleLabel="Lecturer" />;
}
