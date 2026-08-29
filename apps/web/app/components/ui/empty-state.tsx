import { type ComponentType, type ReactNode, type SVGProps } from "react";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";

export interface EmptyStateProps {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  withCard?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  withCard = true,
}: EmptyStateProps) {
  const content = (
    <div className={cn("p-12 text-center flex flex-col items-center justify-center", className)}>
      {Icon && (
        <Icon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
      )}
      <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );

  if (withCard) {
    return <Card className="overflow-hidden shadow-none">{content}</Card>;
  }

  return content;
}
