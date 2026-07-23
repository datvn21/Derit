import { useState, useEffect, useRef, useCallback } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { BACKEND_URL } from "~/lib/api";

interface PDFViewerProps {
  pdfUrl: string;
  className?: string;
}

const ZOOM_STEP = 0.15;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.5;
const A4_WIDTH = 794; // reference width at 100%

export default function PDFViewer({ pdfUrl, className = "" }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [PDFComponents, setPDFComponents] = useState<any>(null);
  const [scale, setScale] = useState<number>(1);
  // fitWidth=true  → page fills container width (default)
  // fitWidth=false → manual scale via zoom buttons
  const [fitWidth, setFitWidth] = useState<boolean>(true);
  const [containerW, setContainerW] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef<boolean>(false);
  const workerInitialized = useRef<boolean>(false);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Load react-pdf once
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      try {
        const { Document, Page, pdfjs } = await import("react-pdf");
        await import("react-pdf/dist/Page/AnnotationLayer.css");
        if (!workerInitialized.current) {
          pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
          workerInitialized.current = true;
        }
        setPDFComponents({ Document, Page });
      } catch (err) {
        console.error("PDF library load error:", err);
        setError("Failed to load PDF library");
      }
    })();
  }, []);

  // Measure container width so fit-width always fills the panel
  useEffect(() => {
    if (!scrollRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerW(entry.contentRect.width);
    });
    ro.observe(scrollRef.current);
    return () => ro.disconnect();
  }, [PDFComponents]); // re-attach after scroll div mounts

  // Reset when URL changes
  useEffect(() => {
    setNumPages(0);
    setCurrentPage(1);
    setError("");
  }, [pdfUrl]);

  // IntersectionObserver → track which page is currently visible
  useEffect(() => {
    if (!scrollRef.current || numPages === 0) return;
    const root = scrollRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (top) {
          const idx = pageRefs.current.indexOf(top.target as HTMLDivElement);
          if (idx >= 0) setCurrentPage(idx + 1);
        }
      },
      { root, threshold: 0.4 },
    );
    pageRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [numPages]);

  // Computed page pixel width
  const pageWidth = fitWidth
    ? Math.max(containerW - 32, 100) // 32 = px-4 × 2 padding
    : Math.round(A4_WIDTH * scale);

  const zoomIn = useCallback(() => {
    setFitWidth(false);
    setScale((s) => Math.min(+(s + ZOOM_STEP).toFixed(2), ZOOM_MAX));
  }, []);

  const zoomOut = useCallback(() => {
    setFitWidth(false);
    setScale((s) => Math.max(+(s - ZOOM_STEP).toFixed(2), ZOOM_MIN));
  }, []);

  const resetFit = useCallback(() => setFitWidth(true), []);

  const fullPdfUrl = pdfUrl.startsWith("http")
    ? pdfUrl
    : `${BACKEND_URL}${pdfUrl}`;

  if (!PDFComponents) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 ${className}`}
      >
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-4 border-blue-100 border-t-blue-500 animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-red-50 ${className}`}
      >
        <p className="text-sm text-red-600 px-4 text-center">{error}</p>
      </div>
    );
  }

  const { Document, Page } = PDFComponents;

  return (
    <div className={`flex flex-col overflow-hidden ${className}`}>
      {/* ── Toolbar ── */}
      <div className="shrink-0 flex items-center justify-between px-3 h-10  bg-[#2d2d2d] text-white text-xs select-none">
        {/* Page indicator */}
        <span className="tabular-nums text-gray-400 w-16 text-center">
          {numPages > 0 ? `${currentPage} / ${numPages}` : ""}
        </span>

        {/* Zoom cluster */}
        <div className="flex items-center gap-0.5 bg-gray-700 rounded-md px-1 py-0.5">
          <button
            onClick={zoomOut}
            disabled={!fitWidth && scale <= ZOOM_MIN}
            title="Zoom out"
            className="p-1 rounded hover:bg-gray-600 disabled:opacity-30 disabled:cursor-default transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          {/* Shows current zoom %; click to snap back to Fit Width */}
          <button
            onClick={resetFit}
            title={fitWidth ? "Fit Width (active)" : "Click to reset Fit Width"}
            className={`px-2 py-0.5 rounded text-xs font-medium min-w-[52px] text-center transition-colors ${
              fitWidth
                ? "text-blue-400 cursor-default"
                : "text-gray-200 hover:bg-gray-600"
            }`}
          >
            {fitWidth ? (
              <span className="flex items-center gap-1 justify-center">
                <Maximize2 className="w-3 h-3" /> Fit
              </span>
            ) : (
              `${Math.round(scale * 100)}%`
            )}
          </button>

          <button
            onClick={zoomIn}
            disabled={!fitWidth && scale >= ZOOM_MAX}
            title="Zoom in"
            className="p-1 rounded hover:bg-gray-600 disabled:opacity-30 disabled:cursor-default transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right spacer */}
        <span className="w-16" />
      </div>

      {/* ── Scrollable page stack ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-2 py-2"
        style={{
          background: "#e5e7eb",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <Document
          file={fullPdfUrl}
          onLoadSuccess={({ numPages: n }: { numPages: number }) =>
            setNumPages(n)
          }
          onLoadError={(err: any) => setError(err.message || "Cannot load PDF")}
          loading={
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 rounded-full border-4 border-blue-100 border-t-blue-500 animate-spin" />
            </div>
          }
        >
          {Array.from({ length: numPages }, (_, i) => (
            <div
              key={i}
              ref={(el) => {
                pageRefs.current[i] = el;
              }}
              className="mb-2 flex justify-center "
            >
              <Page
                pageNumber={i + 1}
                width={pageWidth > 0 ? pageWidth : undefined}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
}
