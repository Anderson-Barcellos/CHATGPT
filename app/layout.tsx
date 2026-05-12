import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "sonner";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  title: "GPT - Cliente IA Multi-Modal",
  description: "GPT - Cliente pessoal de IA com controle total",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GPT",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `if("serviceWorker"in navigator){navigator.serviceWorker.register("${process.env.NEXT_PUBLIC_BASE_PATH||""}/sw.js")}`,
          }}
        />
      </head>
      <body className="antialiased">
        <QueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
