import { Suspense } from "react";
import { HeatmapEditor } from "@/components/HeatmapEditor";

function EditorFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-[var(--text-muted)]">
      Loading editor...
    </div>
  );
}

export default function Home() {
  return (
    <main>
      <Suspense fallback={<EditorFallback />}>
        <HeatmapEditor />
      </Suspense>
    </main>
  );
}
