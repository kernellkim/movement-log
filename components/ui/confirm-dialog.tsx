"use client";

import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalActions, ModalList } from "@/components/ui/modal";

type Variant = "default" | "destructive" | "outline";

// 확인이 필요한 동작(삭제, 요청 등)용 공용 팝업: 트리거 버튼 + 확인 팝업.
// window.confirm 대신 이것을 쓴다. action은 서버 액션(form action)이다.
export function ConfirmDialog({
  triggerLabel,
  triggerVariant = "destructive",
  triggerSize = "sm",
  title,
  items,
  confirmLabel,
  confirmVariant = "default",
  action,
}: {
  triggerLabel: ReactNode;
  triggerVariant?: Variant;
  triggerSize?: "default" | "sm" | "lg";
  title: ReactNode;
  items: ReactNode[];
  confirmLabel: ReactNode;
  confirmVariant?: Variant;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        onClick={() => dialogRef.current?.showModal()}
      >
        {triggerLabel}
      </Button>

      <Modal dialogRef={dialogRef} title={title}>
        <ModalList items={items} />
        <ModalActions>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => dialogRef.current?.close()}
          >
            취소
          </Button>
          <form
            action={action}
            className="contents"
            onSubmit={() => dialogRef.current?.close()}
          >
            <Button type="submit" variant={confirmVariant} size="lg">
              {confirmLabel}
            </Button>
          </form>
        </ModalActions>
      </Modal>
    </>
  );
}
