import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { useUserStore } from "~/stores/userStore";
import { authAPI, examSessionAPI, examTemplateAPI } from "~/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { FileText, Calendar, Users, Eye, History, Plus } from "lucide-react";

export default function LecturerDashboard() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useUserStore();

  // Auth check
  useEffect(() => {
    authAPI
      .getUser()
      .then((res) => {
        if (res.data.role !== "lecturer") {
          navigate("/student");
        } else {
          setUser(res.data);
        }
      })
      .catch(() => {
        navigate("/");
      });
  }, [navigate, setUser]);

  // Fetch Sessions
  const { data: sessionsData, isLoading: isLoadingSessions } = useQuery({
    queryKey: ["my-sessions"],
    queryFn: () => examSessionAPI.getAll(),
    enabled: !!user,
  });

  // Fetch Templates
  const { data: templatesData, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["my-templates"],
    queryFn: () => examTemplateAPI.getAll(),
    enabled: !!user,
  });

  if (!user) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  const sessions = sessionsData?.data?.sessions || [];
  const templates = templatesData?.data?.templates || [];
  const ongoingSessions = sessions.filter((s: any) => s.status === "ongoing");
  const upcomingSessions = sessions.filter((s: any) => s.status === "scheduled");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              Dashboard
            </h1>
          </div>
        </div>
      </div>

      {/* ===== CONTENT ===== */}
      <main className="flex-1 max-w-7xl mx-auto px-6 w-full space-y-8">
    
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Templates Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-300 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-600 rounded-full">Total</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-3xl font-bold text-gray-900">{templates.length}</h3>
              <p className="text-sm text-gray-500 font-medium">Exam Templates</p>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">Base for your exams</span>
              <Link to="/lecturer/exam-templates/create" className="text-sm font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1 group">
                New Template <Plus className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"/>
              </Link>
            </div>
          </div>

          {/* Sessions Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-300 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-600 rounded-full">Total</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-3xl font-bold text-gray-900">{sessions.length}</h3>
              <p className="text-sm text-gray-500 font-medium">Exam Sessions</p>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">Scheduled exams</span>
              <Link to="/lecturer/exam-sessions/create" className="text-sm font-medium text-primary hover:text-primary flex items-center gap-1 group">
                New Session <Plus className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"/>
              </Link>
            </div>
          </div>

          {/* Ongoing Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-300 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded-full animate-pulse">Live</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-3xl font-bold text-gray-900">{ongoingSessions.length}</h3>
              <p className="text-sm text-gray-500 font-medium">Ongoing Sessions</p>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">Active right now</span>
              <Link to="/lecturer/exam-sessions" className="text-sm font-medium text-green-600 hover:text-green-700 flex items-center gap-1">
                View All <Eye className="w-4 h-4"/>
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Links / Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {/* Recent Templates */}
           <div className="bg-white rounded-xl border border-gray-200 p-6">
             <div className="flex items-center justify-between mb-6">
               <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                 <FileText className="w-5 h-5 text-gray-500"/> Recent Templates
               </h3>
               <Link to="/lecturer/exam-templates">
                 <Button className="cursor-pointer" variant="outline" size="sm">View All</Button>
               </Link>
             </div>
             
             {templates.length === 0 ? (
               <div className="text-center py-8 text-gray-500">
                 No templates created yet.
               </div>
             ) : (
               <div className="space-y-3">
                 {templates.slice(0, 3).map((t: any) => (
                   <Link to={`/lecturer/exam-templates/${t._id}/edit`} key={t._id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition">
                     <div>
                       <p className="font-medium text-gray-900">{t.templateName}</p>
                       <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded text-white ${t.examType === 'OOP' ? 'bg-orange-500' : t.examType === 'DSA' ? 'bg-indigo-500' : 'bg-gray-500'}`}>
                            {t.examType}
                          </span>
                          <span className="text-xs text-gray-500">{t.examCodeCount || t.examCodes?.length || 0} codes</span>
                       </div>
                     </div>
                   </Link>
                 ))}
               </div>
             )}
           </div>

           {/* Recent Sessions */}
           <div className="bg-white rounded-xl border border-gray-200 p-6">
             <div className="flex items-center justify-between mb-6">
               <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                 <History className="w-5 h-5 text-gray-500"/> Recent Sessions
               </h3>
               <Link to="/lecturer/exam-sessions">
                 <Button className="cursor-pointer" variant="outline" size="sm">View All</Button>
               </Link>
             </div>

             {sessions.length === 0 ? (
               <div className="text-center py-8 text-gray-500">
                 No sessions created yet.
               </div>
             ) : (
               <div className="space-y-3">
                 {sessions.slice(0, 3).map((session: any) => (
                   <Link to={`/lecturer/exam-sessions/${session._id}`} key={session._id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition">
                     <div>
                       <p className="font-medium text-gray-900">{session.sessionName}</p>
                       <p className="text-xs text-gray-500 mt-1">
                         {new Date(session.startTime).toLocaleDateString()} • {new Date(session.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                       </p>
                     </div>
                     <span className={`text-xs px-2 py-1 rounded-full ${
                        session.status === 'ongoing' ? 'bg-green-100 text-green-700' :
                        session.status === 'ended' ? 'bg-gray-100 text-gray-600' :
                        'bg-blue-100 text-primary'
                     }`}>
                       {session.status}
                     </span>
                   </Link>
                 ))}
               </div>
             )}
           </div>
        </div>
      </main>
    </div>
  );
}
