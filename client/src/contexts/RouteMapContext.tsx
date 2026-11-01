import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { RouteSelection } from "@/lib/routeSelection";

interface RouteMapState {
  selection: RouteSelection | null;
  selectedOptionId: string;
  showRoute: (route: RouteSelection, optionId?: string) => void;
  selectOption: (id: string) => void;
  clearSelection: () => void;
}

const RouteMapContext = createContext<RouteMapState | null>(null);

export function RouteMapProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<RouteSelection | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState("base");
  const showRoute = useCallback((route: RouteSelection, optionId = "base") => {
    setSelection(route);
    setSelectedOptionId(
      route.options.some(option => option.id === optionId) ? optionId : "base"
    );
  }, []);
  const clearSelection = useCallback(() => setSelection(null), []);
  const value = useMemo(
    () => ({
      selection,
      selectedOptionId,
      showRoute,
      selectOption: setSelectedOptionId,
      clearSelection,
    }),
    [selection, selectedOptionId, showRoute, clearSelection]
  );
  return (
    <RouteMapContext.Provider value={value}>
      {children}
    </RouteMapContext.Provider>
  );
}

export function useRouteMap() {
  const context = useContext(RouteMapContext);
  if (!context) throw new Error("RouteMapProvider is required.");
  return context;
}
