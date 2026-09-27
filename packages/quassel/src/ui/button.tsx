import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "./cn"

const buttonVariants = cva(
  "qsl:group/button qsl:inline-flex qsl:shrink-0 qsl:items-center qsl:justify-center qsl:rounded-lg qsl:border qsl:border-transparent qsl:bg-clip-padding qsl:text-sm qsl:font-medium qsl:whitespace-nowrap qsl:transition-all qsl:outline-none qsl:select-none qsl:focus-visible:border-ring qsl:focus-visible:ring-3 qsl:focus-visible:ring-ring/50 qsl:active:not-aria-[haspopup]:translate-y-px qsl:disabled:pointer-events-none qsl:disabled:opacity-50 qsl:aria-invalid:border-destructive qsl:aria-invalid:ring-3 qsl:aria-invalid:ring-destructive/20 qsl:dark:aria-invalid:border-destructive/50 qsl:dark:aria-invalid:ring-destructive/40 qsl:[&_svg]:pointer-events-none qsl:[&_svg]:shrink-0 qsl:[&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "qsl:bg-primary qsl:text-primary-foreground qsl:hover:bg-primary/80",
        outline:
          "qsl:border-border qsl:bg-background qsl:hover:bg-muted qsl:hover:text-foreground qsl:aria-expanded:bg-muted qsl:aria-expanded:text-foreground qsl:dark:border-input qsl:dark:bg-input/30 qsl:dark:hover:bg-input/50",
        secondary:
          "qsl:bg-secondary qsl:text-secondary-foreground qsl:hover:bg-[color-mix(in_oklch,var(--qsl-secondary),var(--qsl-foreground)_5%)] qsl:aria-expanded:bg-secondary qsl:aria-expanded:text-secondary-foreground",
        ghost:
          "qsl:hover:bg-muted qsl:hover:text-foreground qsl:aria-expanded:bg-muted qsl:aria-expanded:text-foreground qsl:dark:hover:bg-muted/50",
        destructive:
          "qsl:bg-destructive/10 qsl:text-destructive qsl:hover:bg-destructive/20 qsl:focus-visible:border-destructive/40 qsl:focus-visible:ring-destructive/20 qsl:dark:bg-destructive/20 qsl:dark:hover:bg-destructive/30 qsl:dark:focus-visible:ring-destructive/40",
        link: "qsl:text-primary qsl:underline-offset-4 qsl:hover:underline",
      },
      size: {
        default:
          "qsl:h-8 qsl:gap-1.5 qsl:px-2.5 qsl:has-data-[icon=inline-end]:pr-2 qsl:has-data-[icon=inline-start]:pl-2",
        xs: "qsl:h-6 qsl:gap-1 qsl:rounded-[min(--theme(--radius-md),10px)] qsl:px-2 qsl:text-xs qsl:in-data-[slot=button-group]:rounded-lg qsl:has-data-[icon=inline-end]:pr-1.5 qsl:has-data-[icon=inline-start]:pl-1.5 qsl:[&_svg:not([class*='size-'])]:size-3",
        sm: "qsl:h-7 qsl:gap-1 qsl:rounded-[min(--theme(--radius-md),12px)] qsl:px-2.5 qsl:text-[0.8rem] qsl:in-data-[slot=button-group]:rounded-lg qsl:has-data-[icon=inline-end]:pr-1.5 qsl:has-data-[icon=inline-start]:pl-1.5 qsl:[&_svg:not([class*='size-'])]:size-3.5",
        lg: "qsl:h-9 qsl:gap-1.5 qsl:px-2.5 qsl:has-data-[icon=inline-end]:pr-2 qsl:has-data-[icon=inline-start]:pl-2",
        icon: "qsl:size-8",
        "icon-xs":
          "qsl:size-6 qsl:rounded-[min(--theme(--radius-md),10px)] qsl:in-data-[slot=button-group]:rounded-lg qsl:[&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "qsl:size-7 qsl:rounded-[min(--theme(--radius-md),12px)] qsl:in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "qsl:size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-quassel=""
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
