import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { cn } from "./cn"

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverContent({
  className,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 8,
  anchor,
  collisionPadding,
  keepMounted,
  portalContainer,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "anchor" | "collisionPadding"
  > & Pick<PopoverPrimitive.Portal.Props, "keepMounted"> & { portalContainer?: HTMLElement | ShadowRoot }) {
  return (
    <PopoverPrimitive.Portal container={portalContainer} keepMounted={keepMounted}>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        collisionPadding={collisionPadding}
        side={side}
        sideOffset={sideOffset}
        className="qsl:isolate qsl:z-[110]"
      >
        <PopoverPrimitive.Popup
          data-quassel=""
          data-quassel-popover=""
          data-slot="popover-content"
          className={cn(
            "qsl:z-[110] qsl:flex qsl:w-72 qsl:origin-(--transform-origin) qsl:flex-col qsl:gap-2.5 qsl:rounded-lg qsl:bg-popover qsl:p-2.5 qsl:text-sm qsl:text-popover-foreground qsl:shadow-md qsl:ring-1 qsl:ring-foreground/10 qsl:outline-hidden qsl:duration-100 qsl:data-[side=bottom]:slide-in-from-top-2 qsl:data-[side=inline-end]:slide-in-from-left-2 qsl:data-[side=inline-start]:slide-in-from-right-2 qsl:data-[side=left]:slide-in-from-right-2 qsl:data-[side=right]:slide-in-from-left-2 qsl:data-[side=top]:slide-in-from-bottom-2 qsl:data-open:animate-in qsl:data-open:fade-in-0 qsl:data-open:zoom-in-95 qsl:data-closed:animate-out qsl:data-closed:fade-out-0 qsl:data-closed:zoom-out-95",
            className
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverContent }
