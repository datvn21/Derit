/**
 * Step 1 — Template info: name, exam type, language, duration.
 *
 * Pure presentation; all state lives in `useTemplateState`.
 */
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { FileText, Clock, BookOpen, Code2 } from "lucide-react";
import type { UseTemplateStateResult } from "./useTemplateState";
import { LANGUAGES_FOR_GENERAL } from "./types";

export function StepTemplateInfo({ state }: { state: UseTemplateStateResult }) {
  const { meta, setMeta } = state;
  // Language is locked for OOP/DSA (always Java)
  const languageLocked = meta.examType === "OOP" || meta.examType === "DSA";

  return (
    <section className="rounded-xl border border-border bg-card p-6 flex flex-col gap-5">
      <header>
        <h2 className="text-lg font-semibold text-foreground">
          Template information
        </h2>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field
          id="templateName"
          label="Template name"
          icon={FileText}
          help="Shown to students. Pick something they'll recognize."
        >
          <Input
            id="templateName"
            value={meta.templateName}
            onChange={(e) => setMeta({ templateName: e.target.value })}
            placeholder="e.g., OOP Midterm 2024"
          />
        </Field>

        <Field id="examType" label="Exam type" icon={BookOpen}>
          <Select
            value={meta.examType}
            onValueChange={(v) =>
              setMeta({
                examType: v as typeof meta.examType,
                language: v === "OOP" || v === "DSA" ? "java" : meta.language,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OOP">OOP</SelectItem>
              <SelectItem value="DSA">DSA</SelectItem>
              <SelectItem value="General">General</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field
          id="language"
          label="Language"
          icon={Code2}
          help={
            languageLocked
              ? "Locked to Java for OOP/DSA exams."
              : "Pick the language students will write in."
          }
        >
          <Select
            value={meta.language}
            onValueChange={(v) =>
              setMeta({ language: v as typeof meta.language })
            }
            disabled={languageLocked}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languageLocked ? (
                <SelectItem value="java">Java</SelectItem>
              ) : (
                LANGUAGES_FOR_GENERAL.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </Field>

        <Field
          id="duration"
          label="Duration (minutes)"
          icon={Clock}
          help="Time students have once they join the session."
        >
          <Input
            id="duration"
            type="number"
            min={1}
            value={meta.duration}
            onChange={(e) =>
              setMeta({ duration: parseInt(e.target.value || "0", 10) })
            }
          />
        </Field>
      </div>
    </section>
  );
}

function Field({
  id,
  label,
  icon: Icon,
  help,
  children,
}: {
  id: string;
  label: string;
  icon: typeof FileText;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="flex items-center gap-1.5 text-sm">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        {label}
      </Label>
      {children}
      {help && <p className="text-xs text-muted-foreground mt-0.5">{help}</p>}
    </div>
  );
}
