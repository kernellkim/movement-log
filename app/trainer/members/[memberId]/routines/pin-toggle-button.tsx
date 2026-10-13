"use client";

import { startTransition, useOptimistic, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalActions } from "@/components/ui/modal";
import { toggleRoutinePin } from "./actions";

export function PinToggleButton({
  memberId,
  routineId,
  isPinned,
}: {
  memberId: string;
  routineId: string;
  isPinned: boolean;
}) {
  const errorDialogRef = useRef<HTMLDialogElement>(null);
  const [optimisticPinned, setOptimisticPinned] = useOptimistic(
    isPinned,
    (_state, next: boolean) => next,
  );

  function handleClick() {
    const next = !isPinned;
    startTransition(async () => {
      setOptimisticPinned(next);
      try {
        await toggleRoutinePin(memberId, routineId, next);
      } catch (err) {
        console.error(err);
        errorDialogRef.current?.showModal();
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={optimisticPinned ? "default" : "ghost"}
        size="icon-sm"
        aria-label={optimisticPinned ? "고정 해제" : "상단 고정"}
        title={optimisticPinned ? "고정 해제" : "상단 고정"}
        onClick={handleClick}
      >
        📌
      </Button>
      <Modal dialogRef={errorDialogRef} title="고정 상태를 변경하지 못했어요">
        <p className="text-sm text-foreground">잠시 후 다시 시도해 주세요.</p>
        <ModalActions>
          <span />
          <Button
            type="button"
            size="lg"
            onClick={() => errorDialogRef.current?.close()}
          >
            확인
          </Button>
        </ModalActions>
      </Modal>
    </>
  );
}
