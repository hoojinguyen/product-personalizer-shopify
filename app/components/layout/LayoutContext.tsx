import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SaveBar {
  isDirty: boolean;
  onSave: () => void;
  onDiscard: () => void;
  isSaving?: boolean;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface LayoutContextValue {
  saveBar: SaveBar | undefined;
  updateSaveBar: (saveBar: SaveBar | undefined) => void;
}

const LayoutContext = createContext<LayoutContextValue>({
  saveBar: undefined,
  updateSaveBar: () => {},
});

// ─── Provider ────────────────────────────────────────────────────────────────

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [saveBar, setSaveBar] = useState<SaveBar | undefined>(undefined);

  const updateSaveBar = useCallback((next: SaveBar | undefined) => {
    setSaveBar(next);
  }, []);

  return (
    <LayoutContext.Provider value={{ saveBar, updateSaveBar }}>
      {children}
    </LayoutContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useLayoutContext() {
  return useContext(LayoutContext);
}
