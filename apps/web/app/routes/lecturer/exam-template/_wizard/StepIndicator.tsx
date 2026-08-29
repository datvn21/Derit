/**
 * Wizard step indicator — shows progress and lets the user click any
 * step to jump to it (forward jumps only become available once prior
 * steps are valid). Also displays per-step validation state.
 */
import { Check } from "lucide-react";
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
      className="rounded-xl border border-border bg-card p-2 sm:p-3"
    >
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
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
                  "h-full min-h-[82px] w-full rounded-lg border p-3 text-left transition-[background-color,border-color,box-shadow] duration-(--motion-fast) ease-(--motion-ease) sm:p-4",
                  "border border-transparent",
                  canJump && !isActive && "cursor-pointer hover:bg-muted",
                  !canJump && "cursor-not-allowed",
                  isActive && "border-primary bg-primary/5",
                  isActive &&
                    validation.ok &&
                    "border-primary bg-primary/5 shadow-sm",
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
                        "text-sm font-semibold leading-5",
                        isActive ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {step.label}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-muted-foreground">
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
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-[background-color,color,border-color] duration-(--motion-fast) ease-(--motion-ease)";
  if (valid && !active) {
    return (
      <div className={cn(base, "border-success bg-success text-white")}>
        <Check className="h-4 w-4" />
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
