import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button, buttonVariants } from "../../../app/components/ui/button";

describe("Button Component", () => {
  it("renders with default props", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
  });

  it("renders with different variants", () => {
    const variants = ["default", "destructive", "outline", "secondary", "ghost", "link"] as const;
    
    variants.forEach((variant) => {
      const { container } = render(<Button variant={variant}>Button</Button>);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  it("renders with different sizes", () => {
    const sizes = ["default", "sm", "lg", "icon", "icon-sm", "icon-lg"] as const;
    
    sizes.forEach((size) => {
      const { container } = render(<Button size={size}>Button</Button>);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  it("handles disabled state", () => {
    render(<Button disabled>Disabled Button</Button>);
    expect(screen.getByRole("button", { name: /disabled button/i })).toBeDisabled();
  });

  it("renders disabled variant", () => {
    render(<Button disabled>Disabled…</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("applies custom className", () => {
    const { container } = render(<Button className="custom-class">Custom</Button>);
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("handles click events", async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Clickable</Button>);
    
    const button = screen.getByRole("button", { name: /clickable/i });
    button.click();
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

describe("buttonVariants", () => {
  it("returns default variants", () => {
    const result = buttonVariants({});
    expect(result).toContain("inline-flex");
    expect(result).toContain("items-center");
  });

  it("applies variant classes", () => {
    expect(buttonVariants({ variant: "destructive" })).toContain("bg-destructive");
    expect(buttonVariants({ variant: "outline" })).toContain("border");
    expect(buttonVariants({ variant: "ghost" })).toContain("hover:bg-accent");
  });

  it("applies size classes", () => {
    expect(buttonVariants({ size: "sm" })).toContain("h-8");
    expect(buttonVariants({ size: "lg" })).toContain("h-10");
    expect(buttonVariants({ size: "icon" })).toContain("size-9");
  });
});
