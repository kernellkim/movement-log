"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteMemberButton } from "./delete-member-button";
import { ResetPasswordButton } from "./reset-password-button";

export type MemberRow = {
  id: string;
  name: string | null;
  email: string | null;
  risk: "low" | "mid" | "high" | null;
  joined: boolean;
  passwordSet: boolean;
  lastSessionAt: string | null; // ISO, 정렬용
  lastSessionLabel: string | null; // 서버에서 포맷한 표시 문구
  deletionRequestedLabel: string | null;
  selfWorkoutLabel: string | null;
  needsReview: boolean;
  actionHref: string;
  actionLabel: string;
};

const RISK_LABEL = { low: "낮음", mid: "중간", high: "높음" } as const;
const RISK_ORDER = { high: 0, mid: 1, low: 2 } as const;

type FilterKey = "all" | "review" | "deletion" | "high" | "invited";
type SortKey = "name" | "recent" | "risk";

const FILTERS: {
  key: FilterKey;
  label: string;
  match: (m: MemberRow) => boolean;
}[] = [
  { key: "all", label: "전체", match: () => true },
  { key: "review", label: "재검토 필요", match: (m) => m.needsReview },
  {
    key: "deletion",
    label: "탈퇴 요청",
    match: (m) => Boolean(m.deletionRequestedLabel),
  },
  { key: "high", label: "위험도 높음", match: (m) => m.risk === "high" },
  { key: "invited", label: "가입 전", match: (m) => !m.joined },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "name", label: "이름순" },
  { key: "recent", label: "최근 수업순" },
  { key: "risk", label: "위험도 높은 순" },
];

function compareByName(a: MemberRow, b: MemberRow) {
  return (a.name ?? "").localeCompare(b.name ?? "", "ko");
}

export function MemberList({ members }: { members: MemberRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("name");

  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((f) => [f.key, members.filter(f.match).length]),
      ),
    [members],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchFilter = FILTERS.find((f) => f.key === filter)!.match;
    const list = members.filter(
      (m) =>
        matchFilter(m) &&
        (!q ||
          (m.name ?? "").toLowerCase().includes(q) ||
          (m.email ?? "").toLowerCase().includes(q)),
    );
    return [...list].sort((a, b) => {
      if (sort === "recent") {
        // 수업 기록이 없는 회원은 맨 뒤로 보낸다.
        if (a.lastSessionAt && b.lastSessionAt) {
          return b.lastSessionAt.localeCompare(a.lastSessionAt);
        }
        if (a.lastSessionAt) return -1;
        if (b.lastSessionAt) return 1;
      } else if (sort === "risk") {
        const ra = a.risk ? RISK_ORDER[a.risk] : 3;
        const rb = b.risk ? RISK_ORDER[b.risk] : 3;
        if (ra !== rb) return ra - rb;
      }
      return compareByName(a, b);
    });
  }, [members, query, filter, sort]);

  return (
    <div className="space-y-3">
      {members.length > 0 && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름 또는 이메일 검색"
              aria-label="회원 검색"
              className="flex-1"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="정렬"
              className="h-8 shrink-0 rounded-lg border border-input bg-card px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <Button
                key={f.key}
                type="button"
                size="sm"
                variant={filter === f.key ? "default" : "outline"}
                onClick={() => setFilter(f.key)}
              >
                {f.label} {counts[f.key]}
              </Button>
            ))}
          </div>
        </div>
      )}

      {members.length === 0 && (
        <Card className="px-4 py-6">
          <p className="text-sm text-muted-foreground">담당 회원이 없습니다.</p>
        </Card>
      )}
      {members.length > 0 && visible.length === 0 && (
        <Card className="px-4 py-6">
          <p className="text-sm text-muted-foreground">
            조건에 맞는 회원이 없습니다.
          </p>
        </Card>
      )}

      {visible.map((member) => (
        <Card key={member.id} className="gap-3 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {member.name ?? "이름 없음"}
                {member.email && (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    ({member.email})
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                마지막 진행: {member.lastSessionLabel ?? "아직 진행 안 함"}
              </p>
              {member.joined && (
                <p className="mt-1 text-xs text-muted-foreground">
                  자율 운동: {member.selfWorkoutLabel ?? "기록 없음"}
                </p>
              )}
              {member.deletionRequestedLabel && (
                <p className="mt-1 text-xs font-medium text-destructive">
                  🗑️ 탈퇴 요청 ({member.deletionRequestedLabel}) - 확인 후
                  삭제해 주세요
                </p>
              )}
              {member.risk === "high" && (
                <p className="mt-1 text-xs font-medium text-destructive">
                  ⚠️ 의료진 상담 권장 대상입니다
                </p>
              )}
              {member.needsReview && (
                <p className="mt-1 text-xs font-medium text-amber-400">
                  🔔 건강정보 업데이트 - 재검토 필요
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <Badge variant={member.joined ? "info" : "outline"}>
                {member.joined ? "가입완료" : "초대됨"}
              </Badge>
              {member.joined && (
                <Badge
                  variant={
                    member.risk === "high"
                      ? "riskHigh"
                      : member.risk === "mid"
                        ? "riskMid"
                        : member.risk === "low"
                          ? "riskLow"
                          : "outline"
                  }
                  render={
                    member.risk ? (
                      <Link
                        href={`/trainer/members/${member.id}/questionnaire`}
                      />
                    ) : undefined
                  }
                >
                  {member.risk ? RISK_LABEL[member.risk] : "문진표 없음"}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-2">
              {member.joined && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={member.actionHref} />}
                  >
                    {member.actionLabel}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={
                      <Link
                        href={`/trainer/members/${member.id}/body-composition`}
                      />
                    }
                  >
                    인바디
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={
                      <Link
                        href={`/trainer/members/${member.id}/self-workouts`}
                      />
                    }
                  >
                    자율 운동
                  </Button>
                </>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <ResetPasswordButton
                memberId={member.id}
                memberName={member.name ?? "회원"}
                joined={member.passwordSet}
              />
              <DeleteMemberButton
                memberId={member.id}
                memberName={member.name ?? undefined}
              />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
