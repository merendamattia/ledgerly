"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "ledgerly:privacy-mode";

type PrivacyModeContextValue = {
  isPrivacyMode: boolean;
  isPrivacyModeReady: boolean;
  shouldHidePrivateNumbers: boolean;
  togglePrivacyMode: () => void;
};

const PrivacyModeContext = createContext<PrivacyModeContextValue | null>(null);

export function PrivacyModeProvider({ children }: { children: React.ReactNode }) {
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [isPrivacyModeReady, setIsPrivacyModeReady] = useState(false);

  useEffect(() => {
    setIsPrivacyMode(window.localStorage.getItem(STORAGE_KEY) === "1");
    setIsPrivacyModeReady(true);
  }, []);

  const value = useMemo<PrivacyModeContextValue>(() => {
    const setPersisted = (next: boolean) => {
      setIsPrivacyMode(next);
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    };

    return {
      isPrivacyMode,
      isPrivacyModeReady,
      shouldHidePrivateNumbers: !isPrivacyModeReady || isPrivacyMode,
      togglePrivacyMode: () => setPersisted(!isPrivacyMode),
    };
  }, [isPrivacyMode, isPrivacyModeReady]);

  return <PrivacyModeContext.Provider value={value}>{children}</PrivacyModeContext.Provider>;
}

export function usePrivacyMode() {
  const context = useContext(PrivacyModeContext);
  if (!context) {
    throw new Error("usePrivacyMode must be used inside PrivacyModeProvider");
  }
  return context;
}
