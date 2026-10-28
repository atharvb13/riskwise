import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** Keep JavaScript-driven chart animations in sync with the user's preference. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia(QUERY).matches
  );
  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}
