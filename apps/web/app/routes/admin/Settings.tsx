/* Hallmark · pre-emit critique: P4 H5 E4 S4 R4 V4
 * genre: modern-minimal · macrostructure: App Dashboard · design-system: design.md · designed-as-app
 */
import { useState, useEffect } from "react";
import { adminAPI } from "~/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
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
    <div className="settings-page mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <header className="settings-header flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            System settings
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Control registration, execution limits, and access policies for the
            entire exam system.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="w-full shrink-0 sm:w-auto"
        >
          {updateMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {updateMutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </header>

      <div className="flex gap-6 w-full">
        <div className="flex min-w-0 flex-col gap-6 w-full">
          <section
            id="settings-general"
            className="settings-card rounded-xl border border-border bg-card"
          >
            <div className="settings-card-heading flex items-start gap-3 border-b border-border px-5 py-4 sm:px-6">
              <span className="settings-icon mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Mail className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  General
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Identity and access defaults for new students.
                </p>
              </div>
            </div>
            <div className="space-y-6 p-5 sm:p-6">
              <div>
                <Label
                  htmlFor="systemName"
                  className="text-sm font-medium text-foreground"
                >
                  System name
                </Label>
                <Input
                  id="systemName"
                  value={formData.systemName || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, systemName: e.target.value })
                  }
                  placeholder="DERIT - Online Exam System"
                  className="mt-2"
                />
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
                <Checkbox
                  id="allowStudentReg"
                  checked={formData.allowStudentRegistration || false}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      allowStudentRegistration: checked === true,
                    })
                  }
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <Label
                    htmlFor="allowStudentReg"
                    className="text-sm font-medium text-foreground"
                  >
                    Allow student registration
                  </Label>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Students can create accounts when this setting is enabled.
                  </p>
                </div>
              </div>

              {formData.allowStudentRegistration && (
                <div>
                  <Label
                    htmlFor="studentDomains"
                    className="text-sm font-medium text-foreground"
                  >
                    Allowed student email domains
                  </Label>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Enter one domain per line. Registration stays limited to
                    these domains.
                  </p>
                  <Textarea
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
                    className="mt-2 min-h-28 resize-y"
                    placeholder="student.tdtu.edu.vn\nexample.com"
                  />
                </div>
              )}
            </div>
          </section>

          <section
            id="settings-execution"
            className="settings-card rounded-xl border border-border bg-card"
          >
            <div className="settings-card-heading flex items-start gap-3 border-b border-border px-5 py-4 sm:px-6">
              <span className="settings-icon mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Clock className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Exam execution
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Set safe limits for compilation and code execution.
                </p>
              </div>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <div>
                <Label
                  htmlFor="compileTimeout"
                  className="text-sm text-foreground"
                >
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
                  className="mt-2"
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
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum time allowed for program execution per test case
                </p>
              </div>
              <div className="sm:col-span-2">
                <Label
                  htmlFor="maxConcurrent"
                  className="text-sm text-foreground"
                >
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
                  className="mt-2 max-w-md"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Number of code executions allowed simultaneously
                </p>
              </div>
            </div>
          </section>

          <section
            id="settings-security"
            className="settings-card rounded-xl border border-border bg-card"
          >
            <div className="settings-card-heading flex items-start gap-3 border-b border-border px-5 py-4 sm:px-6">
              <span className="settings-icon mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Shield className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Security
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Manage session lifetime and failed-login protection.
                </p>
              </div>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <div>
                <Label
                  htmlFor="sessionExpiry"
                  className="text-sm text-foreground"
                >
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
                  className="mt-2"
                />
              </div>
              <div>
                <Label
                  htmlFor="maxLoginAttempts"
                  className="text-sm text-foreground"
                >
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
                  className="mt-2"
                />
              </div>
            </div>
          </section>

          <section
            id="settings-maintenance"
            className="settings-card settings-card-warning rounded-xl border border-warning/30 bg-warning/5"
          >
            <div className="settings-card-heading flex items-start gap-3 border-b border-warning/20 px-5 py-4 sm:px-6">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <AlertTriangle className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Maintenance mode
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Temporarily prevent access while the system is being updated.
                </p>
              </div>
            </div>
            <div className="space-y-5 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="maintenanceMode"
                  checked={formData.maintenanceMode || false}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      maintenanceMode: checked === true,
                    })
                  }
                  className="mt-0.5"
                />
                <div>
                  <Label
                    htmlFor="maintenanceMode"
                    className="text-sm font-medium text-foreground"
                  >
                    Enable maintenance mode
                  </Label>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Students and lecturers will see the maintenance message
                    instead of the app.
                  </p>
                </div>
              </div>
              {formData.maintenanceMode && (
                <div>
                  <Label
                    htmlFor="maintenanceMessage"
                    className="text-sm text-foreground"
                  >
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
                    className="mt-2"
                  />
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
