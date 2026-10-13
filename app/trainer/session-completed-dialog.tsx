"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export function SessionCompletedDialog({
  show,
  closePath = "/trainer",
}: {
  show: boolean;
  closePath?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (show) dialogRef.current?.showModal();
  }, [show]);

  function handleClose() {
    // router.replace would re-fetch the server component (e.g. /trainer loops
    // admin.auth.admin.getUserById per member, N+1) - just clean up the URL instead.
    window.history.replaceState(null, "", closePath);
  }

  if (!show) return null;

  return (
    <Modal dialogRef={dialogRef} title="✅ 수업 완료" onClose={handleClose}>
      <p className="text-sm text-foreground">오늘 수업 기록이 저장되었습니다.</p>
      <Button size="lg" className="w-full" onClick={() => dialogRef.current?.close()}>
        확인
      </Button>
    </Modal>
  );
}
