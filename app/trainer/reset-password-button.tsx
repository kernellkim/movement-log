"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResetPasswordButton({
  memberId,
  memberName,
}: {
  memberId: string;
  memberName: string;
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
        비밀번호 재설정
      </Button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-card p-5 text-card-foreground ring-1 ring-foreground/10 backdrop:bg-black/60"
      >
        <div className="space-y-4">
          <h2 className="text-base font-semibold">{memberName}님 비밀번호 재설정</h2>

          {loading && <p className="text-sm text-muted-foreground">링크 생성 중...</p>}

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {url && (
            <>
              <p className="text-sm text-muted-foreground">
                회원에게 이 링크를 전달해 주세요. 링크를 연 회원이 새 비밀번호를 설정할 수 있고,
                일정 시간이 지나거나 한 번 사용하면 만료됩니다. 다른 사람에게 노출되지 않게
                주의해 주세요.
              </p>
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
            className="w-full"
            onClick={() => {
              dialogRef.current?.close();
              setUrl(null);
            }}
          >
            닫기
          </Button>
        </div>
      </dialog>
    </>
  );
}
