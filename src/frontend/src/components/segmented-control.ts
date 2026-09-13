export const SEGMENTED_CONTROL_CLASS =
  "inline-flex w-max max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-white/80 bg-muted p-0.5";

export const SEGMENTED_CONTROL_ITEM_CLASS =
  "shrink-0 rounded-lg border border-transparent px-3 py-2 text-center text-xs font-semibold whitespace-nowrap outline-none transition-[background-color,color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring";

/** Keeps a two-option control inside narrow cards while preserving its compact desktop width. */
export const SEGMENTED_CONTROL_EQUAL_WIDTH_CLASS =
  "grid w-full grid-cols-2 overflow-hidden sm:inline-flex sm:w-auto";

export const SEGMENTED_CONTROL_EQUAL_WIDTH_ITEM_CLASS = "min-w-0 w-full sm:w-auto";

export const SEGMENTED_CONTROL_ACTIVE_CLASS =
  "border-white/90 bg-card text-foreground shadow-sm";

export const SEGMENTED_CONTROL_INACTIVE_CLASS =
  "text-muted-foreground hover:bg-card/65 hover:text-foreground";
