import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/lib/toast-context";
import { SettingsProvider } from "@/lib/settings-context";
import { CommandPaletteProvider } from "@/lib/command-palette-context";
import { CommandPalette } from "@/components/command-palette/command-palette";

// Uses a system font stack tuned to match Inter's metrics (see tailwind.config.ts)
// instead of next/font/google, so the build never depends on reaching Google Fonts
// (some office/government networks block it). Drop in next/font/google or a
// self-hosted Inter file later if you want the exact typeface.

// Runs before first paint so a saved dark/system theme doesn't flash light.
const THEME_SCRIPT = `try{var p=JSON.parse(localStorage.getItem("lisdms:prefs")||"null"),l=localStorage.getItem("lisdms-theme"),t=(p&&p.theme)||(l==="dark"||l==="light"?l:"system");document.documentElement.classList.toggle("dark",t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches))}catch(e){}`;

export const metadata: Metadata = {
  title: "LISDMS",
  description: "LGU IT Support & Deployment Monitoring System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <SettingsProvider>
          <ToastProvider>
            <CommandPaletteProvider>
              {children}
              <CommandPalette />
            </CommandPaletteProvider>
          </ToastProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
