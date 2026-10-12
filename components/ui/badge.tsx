import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border-[color-mix(in_oklab,var(--primary)_80%,black)] [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground border-[color-mix(in_oklab,var(--secondary)_75%,black)] [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive border-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        info: "bg-sky-500/15 text-sky-300 border-sky-400/40 [a]:hover:bg-sky-500/25",
        riskLow:
          "bg-emerald-500/15 text-emerald-300 border-emerald-400/50 [a]:hover:bg-emerald-500/25",
        riskMid:
          "bg-amber-500/15 text-amber-300 border-amber-400/50 [a]:hover:bg-amber-500/25",
        riskHigh:
          "bg-red-500/20 text-red-300 border-red-400/60 [a]:hover:bg-red-500/30",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-accent-foreground underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
