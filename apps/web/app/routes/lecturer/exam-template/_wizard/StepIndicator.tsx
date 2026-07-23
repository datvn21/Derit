/**
 * Wizard step indicator — shows progress and lets the user click any
 * step to jump to it (forward jumps only become available once prior
 * steps are valid). Also displays per-step validation state.
 */
import { Check, type LucideIcon } from "lucide-react";
import { STEPS, type StepValidation, type WizardStepId } from "./steps";
import { cn } from "~/lib/utils";

export interface StepIndicatorProps {
  activeStep: WizardStepId;
  visited: Set<WizardStepId>;
  validations: Record<WizardStepId, StepValidation>;
  onStepClick: (id: WizardStepId) => void;
}

export function StepIndicator({
  activeStep,
  visited,
  validations,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <nav
      aria-label="Wizard progress"
      className="rounded-xl border border-border bg-card p-3"
    >
      <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {STEPS.map((step, idx) => {
          const validation = validations[step.id];
          const isActive = step.id === activeStep;
          const isVisited = visited.has(step.id);
          // Allow click if visited OR active (forward jumps need step-1 valid)
          const canJump =
            isActive ||
            isVisited ||
            canReachStep(step.id, validations, visited);

          return (
            <li key={step.id} className="min-w-0">
              <button
                type="button"
                disabled={!canJump}
                onClick={() => canJump && onStepClick(step.id)}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "h-full w-full text-left p-4 rounded-lg transition-[background-color,border-color] duration-(--motion-fast) ease-(--motion-ease)",
                  "border border-transparent",
                  canJump && !isActive && "hover:bg-muted cursor-pointer",
                  !canJump && "opacity-60 cursor-not-allowed",
                  isActive && "border-primary bg-primary/5",
                  isActive &&
                    validation.ok &&
                    "border-success bg-success/5",
                )}
              >
                <div className="flex items-center gap-3">
                  <StepBadge
                    index={idx + 1}
                    active={isActive}
                    valid={validation.ok && (isActive || isVisited)}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-semibold truncate",
                        isActive ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {step.description}
                    </p>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepBadge({
  index,
  active,
  valid,
}: {
  index: number;
  active: boolean;
  valid: boolean;
}) {
  const base =
    "shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-[background-color,color,border-color] duration-(--motion-fast) ease-(--motion-ease)";
  if (valid && !active) {
    return (
      <div className={cn(base, "bg-success text-success-foreground border-success")}>
        <Check className="w-4 h-4" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        base,
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-muted text-muted-foreground border-border",
      )}
    >
      {index}
    </div>
  );
}

/** Forward navigation rule: a step is reachable if every prior step is valid. */
function canReachStep(
  target: WizardStepId,
  validations: Record<WizardStepId, StepValidation>,
  visited: Set<WizardStepId>,
): boolean {
  const order: WizardStepId[] = ["info", "codes", "review"];
  const targetIdx = order.indexOf(target);
  for (let i = 0; i < targetIdx; i++) {
    const id = order[i];
    if (!visited.has(id) && !validations[id].ok) return false;
  }
  return true;
}