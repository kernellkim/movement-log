"use client";

import type { ReactNode, RefObject } from "react";
import { cn } from "@/lib/utils";

// 프로젝트 공용 팝업 디자인. 새 팝업은 반드시 이 컴포넌트(또는 ConfirmDialog)로 만든다.
// window.confirm / window.alert 같은 브라우저 기본 팝업은 쓰지 않는다.
//
// 열고 닫기: 호출하는 쪽에서 dialogRef.current?.showModal() / .close()
export function Modal({
  dialogRef,
  title,
  onClose,
  className,
  children,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  title: ReactNode;
  onClose?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl bg-card p-6 text-card-foreground ring-1 ring-foreground/10 backdrop:bg-black/70",
        className,
      )}
    >
      <div className="space-y-5">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

// 글머리표 목록 (팝업 본문용)
export function ModalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2.5 text-sm leading-relaxed text-foreground">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden>•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// 강조해야 하는 문구 (예: "복구할 수 없습니다.")
export function ModalDanger({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-destructive">{children}</strong>;
}

// 하단 버튼 영역: 같은 크기의 버튼을 나란히 배치
export function ModalActions({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}
