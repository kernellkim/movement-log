import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatSetsReps } from "@/lib/format";
import type { SelfWorkoutLog } from "@/lib/types";

// 회원/트레이너 화면이 함께 쓰는 개인 운동 기록 목록. renderActions로 삭제 버튼 등을 끼워 넣는다.
export function SelfWorkoutList({
  logs,
  emptyText,
  renderActions,
}: {
  logs: SelfWorkoutLog[];
  emptyText: string;
  renderActions?: (log: SelfWorkoutLog) => React.ReactNode;
}) {
  if (logs.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {logs.map((log) => {
        const items = [...(log.self_workout_items ?? [])].sort(
          (a, b) => a.sort_order - b.sort_order,
        );
        return (
          <Card key={log.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>
                  {log.workout_date}
                  {log.ai_suggested && (
                    <Badge variant="outline" className="ml-2 align-middle">
                      AI 제안으로 시작
                    </Badge>
                  )}
                </CardTitle>
                {renderActions?.(log)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-1.5">
                {items.map((item) => (
                  <li key={item.id} className="text-sm text-foreground">
                    {item.exercise_name}
                    {(item.reps != null || item.duration_seconds != null) && (
                      <span className="ml-1.5 text-muted-foreground">
                        {formatSetsReps(
                          item.sets,
                          item.reps,
                          item.duration_seconds,
                          item.weight_kg,
                        )}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {log.memo && (
                <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  메모: {log.memo}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
