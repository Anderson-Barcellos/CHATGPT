import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeColorMeta } from "@/components/ui/theme-color-meta";
import { Toaster } from "sonner";
import "./globals.css";

const METADATA_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#edf5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#030812" },
  ],
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
    icon: `${METADATA_BASE_PATH}/icons/icon-192.png`,
    apple: `${METADATA_BASE_PATH}/icons/icon-192.png`,
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
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `if("serviceWorker"in navigator){navigator.serviceWorker.getRegistrations().then(function(registrations){registrations.forEach(function(registration){if(registration.scope.indexOf(location.origin+"${basePath}/")===0){registration.unregister();}});});}`,
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
            <ThemeColorMeta />
            {children}
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
