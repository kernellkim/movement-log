"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalDanger, ModalList } from "@/components/ui/modal";

export function ResetPasswordButton({
  memberId,
  memberName,
  joined,
}: {
  memberId: string;
  memberName: string;
  joined: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function issue() {
    setLoading(true);
    setError(null);
    setCopied(false);
    setUrl(null);
    dialogRef.current?.showModal();

    const res = await fetch("/api/members/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    const result = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(result.error ?? "링크 발급에 실패했습니다.");
      return;
    }
    setUrl(result.resetUrl);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={issue}>
        {joined ? "비밀번호 재설정" : "초대 링크 재발급"}
      </Button>
      <Modal
        dialogRef={dialogRef}
        title={`${memberName}님 ${joined ? "비밀번호 재설정" : "초대 링크 재발급"}`}
      >
        {loading && <p className="text-sm text-muted-foreground">링크 생성 중...</p>}

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {url && (
          <>
            <ModalList
              items={[
                "회원에게 이 링크를 전달해 주세요. 링크를 연 회원이 새 비밀번호를 설정할 수 있어요.",
                "한 번 사용하거나 일정 시간이 지나면 만료됩니다.",
                <>
                  <ModalDanger>다른 사람에게 노출되지 않게</ModalDanger> 주의해 주세요.
                </>,
              ]}
            />
            <div className="flex gap-2">
              <Input readOnly value={url} className="flex-1" />
              <Button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                }}
              >
                {copied ? "복사됨" : "복사"}
              </Button>
            </div>
          </>
        )}

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => {
            dialogRef.current?.close();
            setUrl(null);
          }}
        >
          닫기
        </Button>
      </Modal>
    </>
  );
}
