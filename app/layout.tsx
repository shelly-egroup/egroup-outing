import type { Metadata } from "next";
import { OutingProvider } from "@/components/outing-provider";
import { TRAILER_IMAGES } from "@/lib/opening-assets";
import { OPENING_SEEN_KEY } from "@/lib/opening-history";
import "./globals.css";
import "./showdown.css";
import "./opening-film.css";
import "./showdown-page.css";
import "./mission-hero.css";
import "./mission-page.css";

// Runs with the HTML, before any bundle: the trailer cover's poster (the vertical one on portrait phones, first visit only)
// and the key visual start downloading ahead of the Chinese font slices.
const preloadOpening = `try{if(location.pathname==="/"){const add=(href,priority)=>{const l=document.createElement("link");l.rel="preload";l.as="image";l.href=href;l.fetchPriority=priority;document.head.appendChild(l)};const tall=matchMedia("(max-aspect-ratio: 4/5)").matches;add(${JSON.stringify(TRAILER_IMAGES.keyArt)},tall?"auto":"high");if(tall&&localStorage.getItem(${JSON.stringify(OPENING_SEEN_KEY)})!=="1")add(${JSON.stringify(TRAILER_IMAGES.keyArtTall)},"high")}}catch{}`;
export const metadata: Metadata = {
  title: "秋遊特務｜10.29 秋季員工旅遊",
  description:
    "10.29 秋季員工旅遊：六度空間雷射對戰，戰後飯店下午茶。",
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
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=JetBrains+Mono:wght@400;600&family=Marcellus&family=Noto+Sans+TC:wght@300;400;500;700;900&family=Noto+Serif+TC:wght@900&family=Oswald:wght@200;300;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <OutingProvider>{children}</OutingProvider>
      </body>
    </html>
  );
}
