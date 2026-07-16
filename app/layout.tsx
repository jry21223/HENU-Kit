import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "河大新生手册｜HENU Kit",
  description: "河南大学新生校园生活攻略：报到清单、校园工具、校区美食与真实地图。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "河大新生手册｜把日子过明白",
    description: "从报到第一天，到找到你的深夜食堂。校园生活攻略、工具入口和真实美食地图。",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
