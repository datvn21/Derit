import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Calendar, Users, Clock, Plus } from "lucide-react";
import { examSessionAPI, examTemplateAPI } from "~/lib/api";
import { useAuth } from "~/hooks/useAuth";
import { StatCard } from "~/components/ui/stat-card";

export default function LecturerDashboard() {
  const { user, isLoading } = useAuth();

  const { data: sessionsData, isLoading: isLoadingSessions } = useQuery({
    queryKey: ["my-sessions"],
    queryFn: () => examSessionAPI.getAll(),
    enabled: !!user,
  });

  const { data: templatesData, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["my-templates"],
    queryFn: () => examTemplateAPI.getAll(),
    enabled: !!user,
  });

  if (isLoading || !user) {
    return (
      <div
        className="p-12 text-center text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        Loading…
      </div>
    );
  }

  const sessions = sessionsData?.data?.sessions || [];
  const templates = templatesData?.data?.templates || [];
  const ongoingSessions = sessions.filter((s: any) => s.status === "ongoing");
  const upcomingSessions = sessions.filter((s: any) => s.status === "scheduled");

  return (
    <div className="flex flex-col gap-8 p-6 max-w-7xl mx-auto w-full">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Dashboard
        </h1>
      </header>

      <section
        aria-label="Key stats"
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <StatCard
          icon={FileText}
          label="Exam Templates"
          value={templates.length}
          badge="Total"
          hint="Base for your exams"
          ctaLabel="New Template"
          ctaHref="/lecturer/exam-templates/create"
        />
        <StatCard
          icon={Calendar}
          label="Ongoing Sessions"
          value={ongoingSessions.length}
          badge="Live"
          hint="Currently in progress"
          ctaLabel="View all"
          ctaHref="/lecturer/exam-sessions"
        />
        <StatCard
          icon={Clock}
          label="Upcoming Sessions"
          value={upcomingSessions.length}
          badge="Scheduled"
          hint="Coming next"
          ctaLabel="Plan"
          ctaHref="/lecturer/exam-sessions"
        />
      </section>

      {(isLoadingSessions || isLoadingTemplates) && (
        <p className="text-sm text-muted-foreground">Refreshing…</p>
      )}

      <section
        aria-label="Shortcuts"
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <Link
          to="/lecturer/exam-templates"
          className="rounded-xl border border-border bg-card p-4 hover:border-foreground/20 transition-[border-color] duration-(--motion-fast) ease-(--motion-ease)"
        >
          <Users className="w-5 h-5 text-muted-foreground mb-2" aria-hidden />
          <p className="font-medium text-foreground">Manage templates</p>
          <p className="text-xs text-muted-foreground">
            Build and reuse exam codes.
          </p>
        </Link>
        <Link
          to="/lecturer/classrooms"
          className="rounded-xl border border-border bg-card p-4 hover:border-foreground/20 transition-[border-color] duration-(--motion-fast) ease-(--motion-ease)"
        >
          <Users className="w-5 h-5 text-muted-foreground mb-2" aria-hidden />
          <p className="font-medium text-foreground">Manage classrooms</p>
          <p className="text-xs text-muted-foreground">
            Group students by class.
          </p>
        </Link>
        <Link
          to="/lecturer/exam-sessions/create"
          className="rounded-xl border border-border bg-card p-4 hover:border-foreground/20 transition-[border-color] duration-(--motion-fast) ease-(--motion-ease)"
        >
          <Plus className="w-5 h-5 text-muted-foreground mb-2" aria-hidden />
          <p className="font-medium text-foreground">New session</p>
          <p className="text-xs text-muted-foreground">
            Spin up a live exam room.
          </p>
        </Link>
      </section>
    </div>
  );
}
