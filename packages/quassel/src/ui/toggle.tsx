import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "./cn"

const toggleVariants = cva(
  "qsl:group/toggle qsl:inline-flex qsl:items-center qsl:justify-center qsl:gap-1 qsl:rounded-lg qsl:text-sm qsl:font-medium qsl:whitespace-nowrap qsl:transition-all qsl:outline-none qsl:hover:bg-muted qsl:hover:text-foreground qsl:focus-visible:border-ring qsl:focus-visible:ring-[3px] qsl:focus-visible:ring-ring/50 qsl:disabled:pointer-events-none qsl:disabled:opacity-50 qsl:aria-invalid:border-destructive qsl:aria-invalid:ring-destructive/20 qsl:aria-pressed:bg-muted qsl:data-[state=on]:bg-muted qsl:dark:aria-invalid:ring-destructive/40 qsl:[&_svg]:pointer-events-none qsl:[&_svg]:shrink-0 qsl:[&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "qsl:bg-transparent",
        outline: "qsl:border qsl:border-input qsl:bg-transparent qsl:hover:bg-muted",
      },
      size: {
        default:
          "qsl:h-8 qsl:min-w-8 qsl:px-2.5 qsl:has-data-[icon=inline-end]:pr-2 qsl:has-data-[icon=inline-start]:pl-2",
        sm: "qsl:h-7 qsl:min-w-7 qsl:rounded-[min(--theme(--radius-md),12px)] qsl:px-2.5 qsl:text-[0.8rem] qsl:has-data-[icon=inline-end]:pr-1.5 qsl:has-data-[icon=inline-start]:pl-1.5 qsl:[&_svg:not([class*='size-'])]:size-3.5",
        lg: "qsl:h-9 qsl:min-w-9 qsl:px-2.5 qsl:has-data-[icon=inline-end]:pr-2 qsl:has-data-[icon=inline-start]:pl-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-quassel=""
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
