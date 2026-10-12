import { formatSetsReps } from "@/lib/format";
import type { Exercise } from "@/lib/types";

export type RoutineItemListEntry = {
  id: string;
  exercise: Exercise | null;
  sets: number | null;
  reps: number | null;
  durationSeconds: number | null;
  weightKg: number | null;
  isStale?: boolean;
};

// 활성 루틴 카드와 지난 수업 기록 카드가 함께 쓰는 운동 목록 렌더러.
// sets/reps/duration/weight는 호출부가 넘겨주는 값을 그대로 표시할 뿐이다 -
// 지난 기록 쪽에서는 이 값이 session_log_items 스냅샷이어야 한다.
export function RoutineItemList({
  items,
  emptyText = "기록된 운동이 없습니다.",
}: {
  items: RoutineItemListEntry[];
  emptyText?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const hasDetail = item.reps != null || item.durationSeconds != null;
        return (
          <li key={item.id} className="space-y-1 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-foreground">
                {item.exercise?.name_ko ?? item.exercise?.name_en ?? "알 수 없는 운동"}
                {hasDetail && (
                  <span className="ml-1.5 text-muted-foreground">
                    {formatSetsReps(item.sets, item.reps, item.durationSeconds, item.weightKg)}
                  </span>
                )}
              </span>
              {item.exercise?.video_url && (
                <a
                  href={item.exercise.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-medium text-primary underline underline-offset-2"
                >
                  참고 영상 보기
                </a>
              )}
            </div>
            {item.isStale && (
              <p className="text-xs text-amber-400">
                이 운동은 이후 루틴이 수정되어 정확한 기록이 남아있지 않습니다
                (현재 루틴 상태를 참고용으로 표시 중)
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
