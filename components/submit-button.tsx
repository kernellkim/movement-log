"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

// 서버 액션이 끝날 때까지(AI 분류 등으로 몇 초 걸릴 수 있음) 버튼을 잠그고
// "처리 중" 문구를 보여준다. 화면이 멈춘 것처럼 보여 여러 번 누르는 것도 막는다.
export function SubmitButton({
  children,
  pendingLabel = "처리 중...",
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
