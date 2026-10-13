"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cancelDeletionRequest, requestDeletion } from "./actions";

export function DeletionRequestCard({
  requestedAtLabel,
}: {
  requestedAtLabel: string | null;
}) {
  if (requestedAtLabel) {
    return (
      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm text-foreground">
            탈퇴 요청이 접수되었습니다 ({requestedAtLabel})
          </p>
          <p className="text-xs text-muted-foreground">
            담당 트레이너가 확인한 뒤 요청일로부터 7일 이내에 모든 개인정보와 기록을 삭제합니다.
            삭제 전에는 요청을 취소할 수 있습니다.
          </p>
          <form action={cancelDeletionRequest} className="flex justify-end">
            <Button type="submit" variant="outline" size="sm">
              탈퇴 요청 취소
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          더 이상 서비스를 이용하지 않으시거나 개인정보 수집·이용 동의를 철회하시려면 탈퇴를 요청해 주세요. 동의를 철회하면 서비스를 이용할 수 없습니다. 담당 트레이너가 확인한 뒤
          요청일로부터 7일 이내에 문진표·인바디·수업 기록을 포함한 모든 정보를 삭제하며, 삭제된
          정보는 복구할 수 없습니다.
        </p>
        <form
          action={requestDeletion}
          className="flex justify-end"
          onSubmit={(e) => {
            if (
              !confirm(
                "탈퇴를 요청하시겠습니까?\n담당 트레이너가 확인한 뒤 모든 정보가 삭제되며 복구할 수 없습니다.\n삭제 전에는 요청을 취소할 수 있습니다.",
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <Button type="submit" variant="destructive" size="sm">
            탈퇴 요청
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
