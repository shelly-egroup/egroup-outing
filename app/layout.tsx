import type { Metadata } from "next";
import { OutingProvider } from "@/components/outing-provider";
import "./globals.css";
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
