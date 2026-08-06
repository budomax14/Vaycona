import { useEffect, useState } from "react";

// Tracks the live rendered box size of the element a ref is attached to.
export function useResizeObserver(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    function measure() {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
