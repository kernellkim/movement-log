import { needsWeightInput } from "@/lib/format";
import type { Exercise, RiskLevel } from "@/lib/types";

// 개인 운동 기록 규칙 - 루틴 생성(lib/routine-generate.ts)과 같은 안전 기준을 따른다.
// - 문진표가 없거나 위험도가 높음이면 개인 기록을 열지 않는다(트레이너 상담이 먼저).
// - 위험도가 낮음(low)이 아니면 무게 장비와 고충격 운동은 고를 수 없다.
export type SelfWorkoutAccess =
  | { allowed: true; weighted: boolean }
  | { allowed: false; reason: "no_questionnaire" | "high_risk" };

export function getSelfWorkoutAccess(risk: RiskLevel | null | undefined, hasQuestionnaire: boolean): SelfWorkoutAccess {
  if (!hasQuestionnaire) return { allowed: false, reason: "no_questionnaire" };
  if (risk === "high") return { allowed: false, reason: "high_risk" };
  return { allowed: true, weighted: risk === "low" };
}

export function filterExercisesForSelfWorkout(exercises: Exercise[], weighted: boolean): Exercise[] {
  return weighted
    ? exercises
    : exercises.filter((e) => !needsWeightInput(e.equipment) && !e.high_impact);
}

// 한국 시간 기준 오늘 날짜(YYYY-MM-DD)
export function todayKst(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
}
