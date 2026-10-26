import { useEffect, useState } from "react";

/**
 * The current time, re-read every second while `isTicking` so a timer visibly
 * runs. Between a start and the first tick it may be up to a second old.
 */
export const useNow = (isTicking: boolean, getNow: () => number): number => {
  const [now, setNow] = useState(getNow);

  useEffect(() => {
    if (!isTicking) {
      return undefined;
    }

    const timer = setInterval(() => {
      setNow(getNow());
    }, 1_000);

    return () => {
      clearInterval(timer);
    };
  }, [isTicking, getNow]);

  return now;
};
