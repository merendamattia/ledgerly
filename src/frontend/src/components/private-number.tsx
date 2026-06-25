"use client";

import { cn } from "@/lib/utils";
import { usePrivacyMode } from "@/components/privacy-mode";
import { useCallback, useMemo } from "react";

export const PRIVATE_NUMBER_PLACEHOLDER = "••••••";
export const PRIVATE_COMPACT_PLACEHOLDER = "••••";

export function PrivateNumber({
  text,
  placeholder = PRIVATE_NUMBER_PLACEHOLDER,
  className,
}: {
  text: string;
  placeholder?: string;
  className?: string;
}) {
  const { shouldHidePrivateNumbers } = usePrivacyMode();

  return (
    <span
      className={cn(
        "tabular-nums",
        shouldHidePrivateNumbers && "select-none blur-[3px]",
        className,
      )}
      aria-label={shouldHidePrivateNumbers ? "Hidden amount" : undefined}
      suppressHydrationWarning
    >
      {shouldHidePrivateNumbers ? placeholder : text}
    </span>
  );
}

export function usePrivateNumberFormatter() {
  const { shouldHidePrivateNumbers } = usePrivacyMode();
  const privateText = useCallback(
    (text: string, placeholder = PRIVATE_NUMBER_PLACEHOLDER) =>
      shouldHidePrivateNumbers ? placeholder : text,
    [shouldHidePrivateNumbers],
  );

  return useMemo(
    () => ({
      shouldHidePrivateNumbers,
      privateText,
    }),
    [shouldHidePrivateNumbers, privateText],
  );
}
