import * as React from "react"
import { cn } from "@/lib/utils"

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { 
    variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive'
    size?: 'default' | 'sm' | 'lg' | 'icon'
  }
>(({ className, variant = 'primary', size = 'default', ...props }, ref) => {
  const variants = {
    primary: "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90",
    secondary: "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:opacity-80",
    ghost: "bg-transparent hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]",
    outline: "border border-[var(--border)] bg-transparent hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]",
    destructive: "bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:opacity-90",
  }

  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-8 px-3 text-xs",
    lg: "h-12 px-8",
    icon: "h-10 w-10",
  }

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
        variants[variant],
        sizes[size],
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button }
