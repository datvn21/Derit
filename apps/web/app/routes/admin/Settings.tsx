import { useState, useEffect } from "react";
import { adminAPI } from "~/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { PageLoading } from "~/components/ui/page-loading";
import { useRequireRole } from "~/hooks/useAuth";
import { toast } from "sonner";
import {
  Settings,
  Clock,
  Shield,
  Loader2,
  Save,
  AlertTriangle,
  Mail,
} from "lucide-react";

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const user = useRequireRole("admin");

  const [formData, setFormData] = useState<any>({});

  // Fetch settings
  const { data: settingsData, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => adminAPI.getSettings(),
    enabled: !!user,
  });

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => adminAPI.updateSettings(data),
    onSuccess: () => {
      toast.success("Settings saved successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to save settings");
    },
  });

  // Update form when settings load
  useEffect(() => {
    if (settingsData?.data) {
      setFormData(settingsData.data);
    }
  }, [settingsData]);

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  if (!user) {
    return <PageLoading label="Loading settings…" />;
  }

  if (isLoading) {
    return <PageLoading label="Loading settings…" />;
  }

  if (!user.isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="rounded-xl border border-border bg-card p-8 text-center max-w-md">
          <Shield className="w-16 h-16 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-bold text-foreground mb-2">
            Super Admin Required
          </h2>
          <p className="text-muted-foreground">
            Only super admins can modify system settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
      {/* Page heading */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">
              System Settings
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configure system-wide settings and preferences
            </p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 text-sm"
        >
          {updateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Changes
        </Button>
      </header>

      {/* General Settings */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold text-foreground mb-5 flex items-center gap-2">
          <Mail className="w-4 h-4 text-muted-foreground" />
          General Settings
        </h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="systemName" className="text-sm text-foreground">
              System Name
            </Label>
            <Input
              id="systemName"
              value={formData.systemName || ""}
              onChange={(e) =>
                setFormData({ ...formData, systemName: e.target.value })
              }
              placeholder="DERIT - Online Exam System"
              className="mt-1.5"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="allowStudentReg"
              checked={formData.allowStudentRegistration || false}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  allowStudentRegistration: e.target.checked,
                })
              }
              className="rounded border-input text-primary focus:ring-ring"
            />
            <Label htmlFor="allowStudentReg" className="text-sm text-foreground">
              Allow Student Registration
            </Label>
          </div>

          {formData.allowStudentRegistration && (
            <div className="mt-4">
              <Label htmlFor="studentDomains" className="text-sm text-foreground">
                Allowed Student Email Domains
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Students can only register with emails from these domains. Enter
                one domain per line.
              </p>
              <textarea
                id="studentDomains"
                value={(formData.allowedStudentDomains || []).join("\n")}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    allowedStudentDomains: e.target.value
                      .split("\n")
                      .map((d: string) => d.trim())
                      .filter((d: string) => d),
                  })
                }
                rows={4}
                className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                placeholder="student.tdtu.edu.vn&#10;example.com"
              />
            </div>
          )}
        </div>
      </section>

      {/* Exam Settings */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold text-foreground mb-5 flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          Exam Execution Settings
        </h3>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <Label htmlFor="compileTimeout" className="text-sm text-foreground">
              Compile Timeout (ms)
            </Label>
            <Input
              id="compileTimeout"
              type="number"
              value={formData.defaultCompileTimeout || 10000}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  defaultCompileTimeout: parseInt(e.target.value),
                })
              }
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Maximum time allowed for code compilation
            </p>
          </div>
          <div>
            <Label htmlFor="runTimeout" className="text-sm text-foreground">
              Run Timeout (ms)
            </Label>
            <Input
              id="runTimeout"
              type="number"
              value={formData.defaultRunTimeout || 5000}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  defaultRunTimeout: parseInt(e.target.value),
                })
              }
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Maximum time allowed for program execution per test case
            </p>
          </div>
          <div>
            <Label htmlFor="maxConcurrent" className="text-sm text-foreground">
              Max Concurrent Submissions
            </Label>
            <Input
              id="maxConcurrent"
              type="number"
              value={formData.maxConcurrentSubmissions || 4}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maxConcurrentSubmissions: parseInt(e.target.value),
                })
              }
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Number of code executions allowed simultaneously
            </p>
          </div>
        </div>
      </section>

      {/* Security Settings */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold text-foreground mb-5 flex items-center gap-2">
          <Shield className="w-4 h-4 text-muted-foreground" />
          Security Settings
        </h3>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <Label htmlFor="sessionExpiry" className="text-sm text-foreground">
              Session Expiry (hours)
            </Label>
            <Input
              id="sessionExpiry"
              type="number"
              value={formData.sessionExpiryHours || 24}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  sessionExpiryHours: parseInt(e.target.value),
                })
              }
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="maxLoginAttempts" className="text-sm text-foreground">
              Max Login Attempts
            </Label>
            <Input
              id="maxLoginAttempts"
              type="number"
              value={formData.maxLoginAttempts || 5}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maxLoginAttempts: parseInt(e.target.value),
                })
              }
              className="mt-1.5"
            />
          </div>
        </div>
      </section>

      {/* Maintenance Mode */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold text-foreground mb-5 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          Maintenance Mode
        </h3>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="maintenanceMode"
              checked={formData.maintenanceMode || false}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maintenanceMode: e.target.checked,
                })
              }
              className="rounded border-input text-primary focus:ring-ring"
            />
            <Label htmlFor="maintenanceMode" className="text-sm text-foreground">
              Enable Maintenance Mode
            </Label>
          </div>
          {formData.maintenanceMode && (
            <div>
              <Label htmlFor="maintenanceMessage" className="text-sm text-foreground">
                Maintenance Message
              </Label>
              <Input
                id="maintenanceMessage"
                value={
                  formData.maintenanceMessage ||
                  "System is under maintenance. Please try again later."
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    maintenanceMessage: e.target.value,
                  })
                }
                className="mt-1.5"
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
