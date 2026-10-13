import { needsWeightInput } from "@/lib/format";
import type { Exercise, RiskLevel } from "@/lib/types";

// 개인 운동 기록 규칙 - 루틴 생성(lib/routine-generate.ts)과 같은 안전 기준을 따른다.
// - 문진표가 없으면 위험도를 알 수 없어 개인 기록을 열지 않는다.
// - 위험도가 낮음(low)이 아니면(높음 포함) 무게 장비와 고충격 운동은 고를 수 없고,
//   맨몸·밴드 중심의 안전한 운동만 기록할 수 있다.
// - 위험도가 높음이면 새 운동을 고르거나 AI 제안을 받을 수 없고, 지난 수업에서 한 운동만
//   불러와 기록할 수 있다(highRisk).
export type SelfWorkoutAccess =
  | { allowed: true; weighted: boolean; highRisk: boolean }
  | { allowed: false; reason: "no_questionnaire" };

export function getSelfWorkoutAccess(
  risk: RiskLevel | null | undefined,
  hasQuestionnaire: boolean,
): SelfWorkoutAccess {
  if (!hasQuestionnaire) return { allowed: false, reason: "no_questionnaire" };
  return { allowed: true, weighted: risk === "low", highRisk: risk === "high" };
}

export function filterExercisesForSelfWorkout(
  exercises: Exercise[],
  weighted: boolean,
): Exercise[] {
  return weighted
    ? exercises
    : exercises.filter((e) => !needsWeightInput(e.equipment) && !e.high_impact);
}

// 한국 시간 기준 오늘 날짜(YYYY-MM-DD)
export function todayKst(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );
}
