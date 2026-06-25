"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "ledgerly:privacy-mode";
const STORAGE_CHANGE_EVENT = "ledgerly:privacy-mode-change";

type PrivacyModeContextValue = {
  isPrivacyMode: boolean;
  isPrivacyModeReady: boolean;
  shouldHidePrivateNumbers: boolean;
  togglePrivacyMode: () => void;
};

const PrivacyModeContext = createContext<PrivacyModeContextValue | null>(null);

/** Reads the persisted privacy mode value from local storage on the client. */
function getPrivacyModeSnapshot(): boolean | null {
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

/** Returns the server snapshot used before client storage is available. */
function getPrivacyModeServerSnapshot() {
  return null;
}

/** Subscribes React to local and cross-tab privacy mode changes. */
function subscribeToPrivacyMode(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(STORAGE_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(STORAGE_CHANGE_EVENT, onStoreChange);
  };
}

/** Provides privacy-mode state and hides private numbers until hydration finishes. */
export function PrivacyModeProvider({ children }: { children: React.ReactNode }) {
  const privacyModeSnapshot = useSyncExternalStore(
    subscribeToPrivacyMode,
    getPrivacyModeSnapshot,
    getPrivacyModeServerSnapshot,
  );
  const isPrivacyModeReady = privacyModeSnapshot !== null;
  const isPrivacyMode = privacyModeSnapshot ?? false;

  const value = useMemo<PrivacyModeContextValue>(() => {
    const setPersisted = (next: boolean) => {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      window.dispatchEvent(new Event(STORAGE_CHANGE_EVENT));
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

/** Reads the privacy-mode context for components that render sensitive values. */
export function usePrivacyMode() {
  const context = useContext(PrivacyModeContext);
  if (!context) {
    throw new Error("usePrivacyMode must be used inside PrivacyModeProvider");
  }
  return context;
}
