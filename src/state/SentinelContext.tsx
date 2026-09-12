import {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";

export type SentinelState =
  | "initialising"
  | "idle"
  | "thinking"
  | "streaming"
  | "listening"
  | "offline";

type SentinelContextType = {
  state: SentinelState;
  setState: (state: SentinelState) => void;
};

const SentinelContext =
  createContext<SentinelContextType | null>(null);

export function SentinelProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] =
    useState<SentinelState>("idle");

  return (
    <SentinelContext.Provider
      value={{
        state,
        setState,
      }}
    >
      {children}
    </SentinelContext.Provider>
  );
}

export function useSentinel() {
  const context = useContext(SentinelContext);

  if (!context) {
    throw new Error(
      "useSentinel must be used inside SentinelProvider."
    );
  }

  return context;
}
