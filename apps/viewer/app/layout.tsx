import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "OpenTrace",
  description: "Sentry for AI agents — capture every LLM call and tool invocation, replay any run with edits.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <header className="header">
            <a href="/" className="logo">
              Open<span>Trace</span>
            </a>
            <a href="https://github.com/nxcodeio/opentrace" className="muted">
              GitHub
            </a>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
