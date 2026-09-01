"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { EmojiPicker } from "frimousse";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Renders a compact emoji picker button backed by the frimousse popover picker.
 */
export function EmojiPickerField({
  value,
  onChange,
  id,
  className,
}: {
  value?: string | null;
  onChange: (emoji: string) => void;
  id?: string;
  className?: string;
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        type="button"
        aria-label={t("pickEmoji")}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md border bg-card text-lg leading-none transition-colors hover:bg-secondary",
          className,
        )}
      >
        <span aria-hidden>{value || "🏷️"}</span>
      </PopoverTrigger>
      <PopoverContent className="w-[296px] p-0" align="start">
        <EmojiPicker.Root
          className="isolate flex h-[342px] w-full flex-col"
          onEmojiSelect={({ emoji }) => {
            onChange(emoji);
            setOpen(false);
          }}
        >
          <EmojiPicker.Search className="z-10 mx-2.5 mt-2.5 appearance-none rounded-md bg-secondary px-2.5 py-2 text-sm outline-hidden" />
          <EmojiPicker.Viewport className="relative flex-1 outline-hidden">
            <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              {t("loading")}
            </EmojiPicker.Loading>
            <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              {t("noEmoji")}
            </EmojiPicker.Empty>
            <EmojiPicker.List
              className="select-none pb-1.5"
              components={{
                CategoryHeader: ({ category, ...props }) => (
                  <div
                    className="bg-popover px-3 pt-3 pb-1.5 text-xs font-medium text-muted-foreground"
                    {...props}
                  >
                    {category.label}
                  </div>
                ),
                Row: ({ children, ...props }) => (
                  <div className="scroll-my-1.5 px-1.5" {...props}>
                    {children}
                  </div>
                ),
                Emoji: ({ emoji, ...props }) => (
                  <button
                    className="flex size-8 items-center justify-center rounded-md text-lg data-[active]:bg-secondary"
                    {...props}
                  >
                    {emoji.emoji}
                  </button>
                ),
              }}
            />
          </EmojiPicker.Viewport>
        </EmojiPicker.Root>
      </PopoverContent>
    </Popover>
  );
}
