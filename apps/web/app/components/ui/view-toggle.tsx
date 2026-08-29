/* Hallmark · component: view-toggle · genre: modern-minimal · theme: design.md
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass
 */
import { LayoutGrid, List as ListIcon } from "lucide-react";
import { cn } from "~/lib/utils";

export type ViewMode = "grid" | "list";

export function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="View mode"
      className="inline-flex w-fit items-center rounded-md bg-muted/50 p-1"
    >
      <ViewToggleButton
        active={value === "grid"}
        label="Grid view"
        onClick={() => onChange("grid")}
      >
        <LayoutGrid className="h-4 w-4" />
      </ViewToggleButton>
      <ViewToggleButton
        active={value === "list"}
        label="List view"
        onClick={() => onChange("list")}
      >
        <ListIcon className="h-4 w-4" />
      </ViewToggleButton>
    </div>
  );
}

function ViewToggleButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]",
        active
          ? "bg-card text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
