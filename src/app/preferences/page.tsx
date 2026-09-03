import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";

export default function PreferencesPage() {
  return (
    <AppShell title="Preferences">
      <div className="mx-auto max-w-2xl">
        <Card className="p-8 text-center text-sm text-muted">
          Preferences (notification settings, default views, etc.) — scaffolded, not yet wired.
          Dark mode is already live via the toggle in the top nav.
        </Card>
      </div>
    </AppShell>
  );
}
