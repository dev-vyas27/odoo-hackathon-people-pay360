import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import { ltWave } from "@/lib/fonts";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "PeoplePay360 — HR & Payroll",
  description:
    "Integrated HR and payroll operations: employees, contracts, attendance, time off, and payroll processing.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${ltWave.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {

}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        {children}
        {
}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--card)",
              color: "var(--card-foreground)",
              border: "1px solid var(--border)",
              fontSize: "0.875rem",
            },
          }}
        />
      </body>
    </html>
  );
}
