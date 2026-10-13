"use client";

import { useRef } from "react";
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

  return <RequestForm />;
}

function RequestForm() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <Card>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          더 이상 서비스를 이용하지 않으시거나 개인정보 수집·이용 동의를 철회하시려면 탈퇴를
          요청해 주세요. 동의를 철회하면 서비스를 이용할 수 없습니다. 담당 트레이너가 확인한 뒤
          요청일로부터 7일 이내에 문진표·인바디·수업 기록을 포함한 모든 정보를 삭제하며, 삭제된
          정보는 복구할 수 없습니다.
        </p>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => dialogRef.current?.showModal()}
          >
            탈퇴 요청
          </Button>
        </div>

        <dialog
          ref={dialogRef}
          className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl bg-card p-6 text-card-foreground ring-1 ring-foreground/10 backdrop:bg-black/70"
        >
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-foreground">탈퇴를 요청할까요?</h2>

            <ul className="space-y-2.5 text-sm leading-relaxed text-foreground">
              <li className="flex gap-2">
                <span aria-hidden>•</span>
                <span>담당 트레이너가 확인한 뒤 모든 정보가 삭제됩니다.</span>
              </li>
              <li className="flex gap-2">
                <span aria-hidden>•</span>
                <span>
                  문진표·인바디·수업 기록이 함께 삭제되며{" "}
                  <strong className="font-semibold text-destructive">복구할 수 없습니다.</strong>
                </span>
              </li>
              <li className="flex gap-2">
                <span aria-hidden>•</span>
                <span>삭제되기 전에는 언제든 요청을 취소할 수 있어요.</span>
              </li>
            </ul>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => dialogRef.current?.close()}
              >
                취소
              </Button>
              <form action={requestDeletion} className="contents">
                <Button type="submit" variant="default" size="lg">
                  탈퇴 요청하기
                </Button>
              </form>
            </div>
          </div>
        </dialog>
      </CardContent>
    </Card>
  );
}
