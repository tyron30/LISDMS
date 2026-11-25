import { TriangleAlert } from "lucide-react";
import { Button } from "./button";

// Shown when a page's data couldn't be loaded. Deliberately not sample data.
export function ErrorState({ message, onRetry }: { message?: string | null; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-critical/30 bg-critical/5 py-14 text-center">
      <TriangleAlert className="h-5 w-5 text-critical" aria-hidden />
      <p className="text-sm font-medium text-text">Couldn&apos;t load this page</p>
      {message && <p className="max-w-md text-sm text-muted">{message}</p>}
      <Button size="sm" variant="secondary" className="mt-2" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
