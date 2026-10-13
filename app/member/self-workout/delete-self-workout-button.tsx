"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ModalDanger } from "@/components/ui/modal";
import { deleteSelfWorkout } from "./actions";

export function DeleteSelfWorkoutButton({
  logId,
  dateLabel,
}: {
  logId: string;
  dateLabel: string;
}) {
  return (
    <ConfirmDialog
      triggerLabel="삭제"
      title={`${dateLabel} 운동 기록을 삭제할까요?`}
      items={[
        "이 날 기록한 운동과 메모가 함께 삭제됩니다.",
        <>
          삭제한 기록은 <ModalDanger>되돌릴 수 없습니다.</ModalDanger>
        </>,
      ]}
      confirmLabel="삭제하기"
      confirmVariant="destructive"
      action={deleteSelfWorkout.bind(null, logId)}
    />
  );
}
