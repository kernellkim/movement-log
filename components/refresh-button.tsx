"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// 홈 화면에 추가한 앱(PWA)은 새로고침 버튼이 없어서 최신 데이터를 보려면 앱을 껐다 켜야 한다.
// 1) 누르면 현재 화면의 데이터를 다시 불러오는 버튼
// 2) 앱을 잠시 떠났다가 돌아오면(기본 30초 이상) 자동으로 한 번 갱신
// 입력 중인 폼이 있는 화면에서는 자동 갱신이 방해될 수 있어 목록/홈 화면에만 둔다.
export function RefreshButton({ autoAfterSeconds = 30 }: { autoAfterSeconds?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const hiddenAt = useRef<number | null>(null);

  function refresh() {
    startTransition(() => router.refresh());
  }

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      const away = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
      hiddenAt.current = null;
      if (away >= autoAfterSeconds * 1000) {
        startTransition(() => router.refresh());
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [autoAfterSeconds, router]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={refresh}
      disabled={pending}
      aria-label="새로고침"
    >
      <span aria-hidden className={pending ? "inline-block animate-spin" : "inline-block"}>
        ↻
      </span>
      {pending ? "갱신 중" : "새로고침"}
    </Button>
  );
}
