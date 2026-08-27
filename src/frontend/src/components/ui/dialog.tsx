"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

/** Renders the dialog root state container. */
function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

/** Renders the trigger that opens a dialog. */
function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

/** Renders the dialog portal host. */
function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

/** Renders a control that closes the dialog. */
function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

/** Renders the dialog backdrop overlay. */
function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/25 duration-150 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

/** Renders centered dialog content and its close button. */
function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 grid max-h-[92dvh] w-full gap-4 overflow-y-auto rounded-t-2xl border border-white/80 bg-popover/98 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-sm text-popover-foreground shadow-2xl duration-200 outline-none sm:top-1/2 sm:left-1/2 sm:bottom-auto sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:pb-4 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-4 sm:data-open:zoom-in-95 sm:data-open:slide-in-from-bottom-0 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-4 sm:data-closed:zoom-out-95 sm:data-closed:slide-out-to-bottom-0",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

/** Renders the dialog header layout. */
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("-mx-4 -mt-4 flex flex-col gap-1.5 border-b bg-muted/35 px-4 py-4 pr-12", className)}
      {...props}
    />
  )
}

/** Renders the dialog footer action area. */
function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col-reverse gap-2 border-t bg-muted/50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:-mb-4 sm:flex-row sm:justify-end sm:rounded-b-2xl sm:pb-4",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

/** Renders the accessible dialog title. */
function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-display text-lg leading-tight font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  )
}

/** Renders the accessible dialog description text. */
function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm leading-relaxed text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
