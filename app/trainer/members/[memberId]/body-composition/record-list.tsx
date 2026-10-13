"use client";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ModalDanger } from "@/components/ui/modal";
import type { BodyComposition } from "@/lib/types";
import { deleteBodyCompositionRecord } from "./actions";

export function BodyCompositionRecordList({
  memberId,
  records,
}: {
  memberId: string;
  records: BodyComposition[];
}) {
  const newestFirst = [...records].reverse();

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-foreground">전체 기록 관리</h2>
      <div className="space-y-3">
        {newestFirst.map((record) => (
          <Card key={record.id}>
            <CardHeader>
              <CardTitle>{record.measured_at}</CardTitle>
              <CardAction>
                <ConfirmDialog
                  triggerLabel="삭제"
                  title="이 기록을 삭제할까요?"
                  items={[
                    `${record.measured_at} 인바디 기록이 삭제됩니다.`,
                    <>
                      삭제한 기록은 <ModalDanger>되돌릴 수 없습니다.</ModalDanger>
                    </>,
                  ]}
                  confirmLabel="삭제하기"
                  confirmVariant="destructive"
                  action={deleteBodyCompositionRecord.bind(null, memberId, record.id)}
                />
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span>체중 {record.weight_kg ?? "-"}kg</span>
                <span>체지방량 {record.body_fat_mass_kg ?? "-"}kg</span>
                <span>골격근량 {record.skeletal_muscle_mass_kg ?? "-"}kg</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
