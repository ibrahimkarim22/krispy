import { useEffect, useState } from "react";
function measure() {
  const viewport = window.visualViewport;
  return {
    width: Math.floor(viewport?.width || window.innerWidth || 1024),
    height: Math.floor(viewport?.height || window.innerHeight || 768),
  };
}
export default function useViewport() {
  const [size, setSize] = useState(measure);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => setSize(measure());
    window.addEventListener("resize", update);
    viewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      viewport?.removeEventListener("resize", update);
    };
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--viewport-height",
      size.height + "px",
    );
    document.documentElement.style.setProperty(
      "--viewport-width",
      size.width + "px",
    );
  }, [size]);
  return size;
}
