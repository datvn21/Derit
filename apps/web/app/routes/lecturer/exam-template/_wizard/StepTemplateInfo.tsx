/**
 * Step 1 - Template info: name, exam type, language, duration.
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
    <section className="rounded-xl border border-border bg-card p-6 flex flex-col gap-6">
      <header className="flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl bg-muted shrink-0 text-foreground">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground leading-tight">
            Template information
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure exam name, category type, programming language, and time
            limit.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
        <Field
          id="templateName"
          label="Template name"
          help="Shown to students. Pick something they'll recognize."
        >
          <Input
            id="templateName"
            value={meta.templateName}
            onChange={(e) => setMeta({ templateName: e.target.value })}
            placeholder="e.g., OOP Midterm 2024"
          />
        </Field>

        <Field id="examType" label="Exam type">
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
  help,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </Label>
      {children}
      {help && <p className="text-xs text-muted-foreground mt-0.5">{help}</p>}
    </div>
  );
}
