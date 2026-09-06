import { createContext, useContext, useState, type ReactNode } from "react";

interface FocusModeContextValue {
  isFocusMode: boolean;
  setFocusMode: (active: boolean) => void;
}

const FocusModeContext = createContext<FocusModeContextValue>({
  isFocusMode: false,
  setFocusMode: () => {},
});

export function FocusModeProvider({ children }: { children: ReactNode }) {
  const [isFocusMode, setFocusMode] = useState(false);

  return (
    <FocusModeContext.Provider value={{ isFocusMode, setFocusMode }}>
      {children}
    </FocusModeContext.Provider>
  );
}

export function useFocusMode() {
  return useContext(FocusModeContext);
}
