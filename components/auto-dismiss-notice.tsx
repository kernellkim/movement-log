"use client";

import { useEffect, useState } from "react";

// 화면에 잠깐 떠 있다가 스스로 사라지는 안내 박스. 페이지를 열 때마다 다시 보인다.
export function AutoDismissNotice({
  children,
  className,
  visibleMs = 3000,
}: {
  children: React.ReactNode;
  className?: string;
  visibleMs?: number;
}) {
  const [phase, setPhase] = useState<"shown" | "fading" | "gone">("shown");

  useEffect(() => {
    const fade = setTimeout(() => setPhase("fading"), visibleMs);
    const remove = setTimeout(() => setPhase("gone"), visibleMs + 500);
    return () => {
      clearTimeout(fade);
      clearTimeout(remove);
    };
  }, [visibleMs]);

  if (phase === "gone") return null;

  return (
    <div
      role="alert"
      className={`${className ?? ""} transition-opacity duration-500 ${
        phase === "fading" ? "opacity-0" : "opacity-100"
      }`}
    >
      {children}
    </div>
  );
}
