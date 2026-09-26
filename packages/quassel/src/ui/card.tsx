import * as React from "react"
import { cn } from "./cn"

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-quassel=""
      data-slot="card"
      data-size={size}
      className={cn(
        "qsl:group/card qsl:flex qsl:flex-col qsl:gap-(--qsl-card-spacing) qsl:overflow-hidden qsl:rounded-panel qsl:border qsl:border-border qsl:bg-card qsl:py-(--qsl-card-spacing) qsl:text-sm qsl:text-card-foreground qsl:shadow-bar qsl:[--qsl-card-spacing:--spacing(4)] qsl:has-data-[slot=card-footer]:pb-0 qsl:has-[>img:first-child]:pt-0 qsl:data-[size=sm]:[--qsl-card-spacing:--spacing(3)] qsl:data-[size=sm]:has-data-[slot=card-footer]:pb-0 qsl:*:[img:first-child]:rounded-t-xl qsl:*:[img:last-child]:rounded-b-xl",
        className
      )}
      {...props}
    />
  )
}

export { Card }
