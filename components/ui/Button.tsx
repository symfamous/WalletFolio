import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Linear-style button. Single indigo accent for primary; everything else is
 * hairline/ghost. Radius 10px, 4px-grid padding, 150ms transitions.
 */
const button = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-[10px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:text-text-lo",
  {
    variants: {
      variant: {
        primary: "bg-accent text-white hover:bg-accent-hover",
        ghost: "border border-border bg-transparent text-text-hi hover:bg-surface-raised hover:border-border-strong",
        subtle: "bg-surface-raised text-text-mid hover:bg-surface-overlay hover:text-text-hi",
        danger: "bg-danger/12 text-danger hover:bg-danger/20",
      },
      size: {
        sm: "h-7 px-2.5 text-xs",
        md: "h-8 px-4 text-sm",
        lg: "h-10 px-5 text-sm",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(button({ variant, size }), className)}
      {...props}
    />
  )
);
Button.displayName = "Button";
