"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

// 같은 form 안의 필수 동의 체크박스가 모두 체크돼야 활성화되는 제출 버튼.
// (서버 액션에서도 다시 검증하므로 UI 편의 기능이다.)
export function ConsentSubmitButton({
  children,
  disabled,
  className,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [allChecked, setAllChecked] = useState(false);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const update = () => {
      const boxes = form.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"][required]',
      );
      setAllChecked(Array.from(boxes).every((box) => box.checked));
    };
    update();
    form.addEventListener("change", update);
    return () => form.removeEventListener("change", update);
  }, []);

  return (
    <Button
      ref={ref}
      type="submit"
      size="lg"
      className={className}
      disabled={disabled || !allChecked}
    >
      {children}
    </Button>
  );
}
