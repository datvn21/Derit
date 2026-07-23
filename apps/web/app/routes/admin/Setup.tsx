import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useUserStore } from "~/stores/userStore";
import { authAPI } from "~/lib/api";
import { Button } from "~/components/ui/button";
import {
  Shield,
  Crown,
  Users,
  Settings,
  CheckCircle,
  ArrowRight,
  Loader2,
} from "lucide-react";

export default function Setup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, setUser } = useUserStore();
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState<"welcome" | "done">("welcome");

  const isSetupComplete = searchParams.get("setup") === "true";

  useEffect(() => {
    authAPI
      .getUser()
      .then((res) => {
        setUser(res.data);
        setIsLoading(false);
        
        // Check if user is admin
        if (res.data.role !== "admin" && !res.data.isSuperAdmin) {
          navigate("/");
        }
      })
      .catch(() => {
        navigate("/");
      });
  }, [navigate, setUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {step === "welcome" && (
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-8 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-full mb-4">
                <Crown className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Welcome, {user?.name}!
              </h1>
              <p className="text-white/80 text-lg">
                You're now a Super Admin of DERIT
              </p>
            </div>

            {/* Content */}
            <div className="p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">
                As a Super Admin, you can:
              </h2>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Manage Users
                    </h3>
                    <p className="text-sm text-gray-500">
                      Create, edit, and manage lecturer and student accounts
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Shield className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      System Security
                    </h3>
                    <p className="text-sm text-gray-500">
                      Control access permissions and user roles
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Settings className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      System Settings
                    </h3>
                    <p className="text-sm text-gray-500">
                      Configure exam timeouts, maintenance mode, and more
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setStep("done")}
                className="w-full h-12 text-lg font-semibold"
                size="lg"
              >
                Get Started
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Success Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-full mb-4">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Setup Complete!
              </h1>
              <p className="text-white/80 text-lg">
                Your admin panel is ready to use
              </p>
            </div>

            {/* Quick Actions */}
            <div className="p-8">
              <p className="text-center text-gray-600 mb-6">
                What would you like to do next?
              </p>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <Button
                  onClick={() => navigate("/admin/users")}
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                >
                  <Users className="w-8 h-8" />
                  <span className="font-semibold">Manage Users</span>
                </Button>
                <Button
                  onClick={() => navigate("/admin/settings")}
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                >
                  <Settings className="w-8 h-8" />
                  <span className="font-semibold">Settings</span>
                </Button>
              </div>

              <Button
                onClick={() => navigate("/lecturer")}
                className="w-full"
                size="lg"
              >
                Go to Dashboard
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>

              <p className="text-center text-sm text-gray-500 mt-4">
                You can always access the admin panel at{" "}
                <a
                  href="/admin"
                  className="text-blue-600 hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/admin");
                  }}
                >
                  /admin
                </a>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
