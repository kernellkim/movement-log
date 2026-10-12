import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Movement.log",
  description: "트레이너-회원 운동 기록 서비스",
  icons: { apple: "/apple-touch-icon.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="dark h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
