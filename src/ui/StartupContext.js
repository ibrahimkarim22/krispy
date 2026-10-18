import { createContext, useContext } from "react";

export const StartupReadyContext = createContext(true);
export const StartupReplayContext = createContext(() => {});

export function useStartupReady() {
  return useContext(StartupReadyContext);
}

export function useReplayIntro() {
  return useContext(StartupReplayContext);
}
