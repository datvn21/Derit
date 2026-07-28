import { useEffect, useRef, useState, type RefObject } from "react";

interface UseSplitPaneArgs {
  containerRef?: RefObject<HTMLElement>;
  horizontalBounds?: { min: number; max: number };
  verticalBounds?: { min: number; max: number };
}

/**
 * Two-pane split with both horizontal (left/right column) and vertical
 * (top/bottom row) drag handles. Returns:
 *  - `splitPosition` (0-100, percent of width for the left pane)
 *  - `testCaseHeight` (px)
 *  - drag toggle handlers to wire to the divider elements
 *  - `rightPaneRef` to attach to the right pane for measurement
 */
export function useSplitPane({
  containerRef,
  horizontalBounds = { min: 25, max: 75 },
  verticalBounds = { min: 40, maxOffset: 130 },
}: UseSplitPaneArgs = {}) {
  const [splitPosition, setSplitPosition] = useState(50);
  const [testCaseHeight, setTestCaseHeight] = useState(256);
  const [isDragging, setIsDragging] = useState(false);
  const [isVerticalDragging, setIsVerticalDragging] = useState(false);
  const rightPaneRef = useRef<HTMLDivElement>(null);

  // Horizontal drag
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const p = (e.clientX / window.innerWidth) * 100;
      setSplitPosition(Math.min(Math.max(p, horizontalBounds.min), horizontalBounds.max));
    };
    const onUp = () => setIsDragging(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, horizontalBounds.min, horizontalBounds.max]);

  // Vertical drag
  useEffect(() => {
    if (!isVerticalDragging) return;
    const onMove = (e: MouseEvent) => {
      const target = (containerRef?.current ?? rightPaneRef.current) as HTMLElement | null;
      if (!target) return;
      const paneRect = target.getBoundingClientRect();
      const newHeight = paneRect.bottom - e.clientY;
      setTestCaseHeight(
        Math.min(Math.max(newHeight, verticalBounds.min), paneRect.height - verticalBounds.maxOffset),
      );
    };
    const onUp = () => setIsVerticalDragging(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isVerticalDragging, containerRef, verticalBounds.min, verticalBounds.maxOffset]);

  return {
    splitPosition,
    setSplitPosition,
    testCaseHeight,
    setTestCaseHeight,
    startHorizontalDrag: () => setIsDragging(true),
    startVerticalDrag: () => setIsVerticalDragging(true),
    isDragging,
    isVerticalDragging,
    rightPaneRef,
  };
}