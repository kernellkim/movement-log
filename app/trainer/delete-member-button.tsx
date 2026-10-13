"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ModalDanger } from "@/components/ui/modal";
import { deleteMember } from "./members/actions";

export function DeleteMemberButton({
  memberId,
  memberName,
}: {
  memberId: string;
  memberName?: string;
}) {
  return (
    <ConfirmDialog
      triggerLabel="삭제"
      title={memberName ? `${memberName} 회원을 삭제할까요?` : "이 회원을 삭제할까요?"}
      items={[
        "문진표·인바디·루틴·수업 기록이 모두 함께 삭제됩니다.",
        <>
          삭제한 정보는 <ModalDanger>되돌릴 수 없습니다.</ModalDanger>
        </>,
      ]}
      confirmLabel="삭제하기"
      confirmVariant="destructive"
      action={deleteMember.bind(null, memberId)}
    />
  );
}
