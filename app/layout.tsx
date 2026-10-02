import type { Metadata } from "next";
import { OutingProvider } from "@/components/outing-provider";
import { OPENING_IMAGES } from "@/lib/opening-assets";
import { OPENING_SEEN_KEY } from "@/lib/opening-history";
import "./globals.css";

// Runs with the HTML, before any bundle: first-time visitors start the opening shots at once,
// ahead of the Chinese font slices, so START unlocks sooner. Returning visitors skip the download.
const preloadOpening = `try{if(location.pathname==="/"&&localStorage.getItem(${JSON.stringify(OPENING_SEEN_KEY)})!=="1")for(const src of ${JSON.stringify(Object.values(OPENING_IMAGES))}){const l=document.createElement("link");l.rel="preload";l.as="image";l.href=src;l.fetchPriority="high";document.head.appendChild(l)}}catch{}`;
export const metadata: Metadata = {
  title: "揪是要對決｜秋遊投票",
  description:
    "秋季員工旅遊提案：瀏覽行程、登入投票，即時看戰況。",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <head>
        <script dangerouslySetInnerHTML={{ __html: preloadOpening }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <OutingProvider>{children}</OutingProvider>
      </body>
    </html>
  );
}
