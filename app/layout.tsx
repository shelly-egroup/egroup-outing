import type { Metadata } from "next";
import { OutingProvider } from "@/components/outing-provider";
import "./globals.css";
export const metadata: Metadata = {
  title: "秋季員旅｜雙方案對決",
  description:
    "10/29 秋季員工旅遊：走讀大稻埕，還是按摩下午茶？登入投票，即時看戰況。",
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
