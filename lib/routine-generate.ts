import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { needsWeightInput } from "@/lib/format";
import type { AssessmentResultRow, BodyComposition, Exercise, Questionnaire } from "@/lib/types";

export type RoutineDraftItem = {
  exerciseId: string;
  sets: number;
  reps: number | null;
  durationSeconds: number | null;
  cautionNote: string;
  weightKg: number | null;
};

export type RoutineDraft = {
  items: RoutineDraftItem[];
  reasoning: string;
  warnings?: string[];
};

export async function generateRoutine(input: {
  questionnaire: Questionnaire;
  assessmentResults: AssessmentResultRow[];
  bodyComposition: BodyComposition | null;
  categories: string[];
  candidates: Exercise[];
  healthUpdatesText?: string;
}): Promise<RoutineDraft> {
  // 고위험군(mid/high)은 바벨/덤벨/머신처럼 무게가 들어가는 운동과 점프
  // 스쿼트/버피 같은 고충격(high_impact) 운동을 후보에서 제외하고 맨몸/밴드
  // 운동만 사용한다 - "AI는 라이브러리 안에서만 루틴 구성" 원칙과 "고위험군은
  // 안전 우선" 원칙을 장비 확장 이후에도 그대로 적용한 것.
  const isLowRisk = input.questionnaire.risk_level === "low";
  const candidates = isLowRisk
    ? input.candidates
    : input.candidates.filter((c) => !needsWeightInput(c.equipment) && !c.high_impact);

  const warnings: string[] = [];
  if (!isLowRisk) {
    for (const category of input.categories) {
      const hadAny = input.candidates.some((c) => c.category === category);
      const hasAfterFilter = candidates.some((c) => c.category === category);
      if (hadAny && !hasAfterFilter) {
        const msg = `"${category}" 카테고리는 고위험군에 안전한 맨몸/밴드 운동이 없어 후보에서 제외되었습니다.`;
        warnings.push(msg);
        console.warn(`[routine-generate] ${msg}`);
      }
    }
  }

  const candidateIds = candidates.map((c) => c.id);
  if (candidateIds.length === 0) {
    return {
      items: [],
      reasoning: "선택한 카테고리에 해당하는 운동이 없습니다.",
      warnings: warnings.length ? warnings : undefined,
    };
  }

  const RoutineItemSchema = z.object({
    exerciseId: z.enum(candidateIds as [string, ...string[]]),
    sets: z.number().int().min(1).max(6),
    reps: z.number().int().min(1).max(50).nullable(),
    durationSeconds: z.number().int().min(5).max(300).nullable(),
    cautionNote: z.string(),
  });
  const RoutineSchema = z.object({
    items: z.array(RoutineItemSchema).min(3).max(8),
    reasoning: z.string(),
  });

  const candidateList = candidates
    .map(
      (c) =>
        `- id: ${c.id} | ${c.name_ko ?? c.name_en} (${c.category}, ${c.equipment ?? "맨몸"}, unit_type: ${c.unit_type})${c.default_caution ? ` | 기본 주의사항: ${c.default_caution}` : ""}`,
    )
    .join("\n");

  const assessmentSummary = input.assessmentResults.length
    ? input.assessmentResults
        .map(
          (r) =>
            `- ${r.item_name}: ${r.result ?? "미기록"}${r.trainer_note ? ` (트레이너 메모: ${r.trainer_note})` : ""}`,
        )
        .join("\n")
    : "검사 결과 없음";

  const bc = input.bodyComposition;
  const bodyCompositionSummary = bc
    ? `측정일 ${bc.measured_at} 기준 - 체중 ${bc.weight_kg ?? "미측정"}kg, 체지방량 ${bc.body_fat_mass_kg ?? "미측정"}kg, 골격근량 ${bc.skeletal_muscle_mass_kg ?? "미측정"}kg`
    : "인바디 기록 없음";

  const client = new Anthropic();
  const response = await client.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 4096,
    system: `당신은 피트니스 트레이너를 보조하는 운동 루틴 생성 도우미입니다. 아래 [후보 운동 목록]에 있는 운동만 사용해서 오늘 세션의 운동 루틴을 구성하세요. 목록에 없는 운동을 지어내면 절대 안 됩니다. exerciseId는 반드시 후보 목록의 id 값을 그대로 사용하세요.

규칙:
- 회원의 위험도(risk_level)가 high면 강도를 보수적으로(세트/반복 수를 낮게) 구성하고, 부상·수술·지병 이력과 검사 결과에서 "뚜렷한 문제"가 나온 부위는 피하거나 강도를 크게 낮추세요.
- 건강 상태 업데이트 이력(문진표 제출 이후 회원이 추가로 알려온 내용)도 반드시 반영하세요 - 새로 생긴 통증·부상 부위는 피하거나 강도를 낮추고, 호전됐다는 내용이 있으면 그 부위의 과도한 제한은 완화해도 됩니다.
- 인바디(체성분) 기록이 있다면 참고하세요: 골격근량이 낮은 편이면 저강도(가벼운 세트/반복 수)부터 시작하도록 구성하세요.
- 각 후보 운동에는 unit_type이 표시되어 있습니다. unit_type이 reps인 운동은 reps에 적절한 반복 횟수를 채우고 durationSeconds는 반드시 null로 두세요. unit_type이 duration인 운동은 durationSeconds에 적절한 유지 시간(초)을 채우고 reps는 반드시 null로 두세요. 두 값을 동시에 채우거나 둘 다 비우지 마세요.
- cautionNote에는 유지 시간이나 횟수를 다시 적지 마세요 - 그 값은 reps/durationSeconds 필드로만 표현합니다. cautionNote는 그 운동의 기본 주의사항과 이 회원의 개인 상황(병력, 검사 결과)을 반영한 자세·동작 관련 주의사항만 한국어 1문장으로 작성하세요.
- reasoning은 전체 루틴 구성 이유를 한국어 2~3문장으로 작성하세요.`,
    messages: [
      {
        role: "user",
        content: `[회원 위험도] ${input.questionnaire.risk_level ?? "미분류"}

[부상 이력] ${input.questionnaire.injury_history || "없음"}
[수술 이력] ${input.questionnaire.surgery_history || "없음"}
[지병] ${input.questionnaire.chronic_condition || "없음"}

[건강 상태 업데이트 이력]
${input.healthUpdatesText || "없음"}

[검사 결과]
${assessmentSummary}

[인바디(체성분)]
${bodyCompositionSummary}

[선택된 포커스 카테고리] ${input.categories.join(", ")}

[후보 운동 목록]
${candidateList}`,
      },
    ],
    output_config: { format: zodOutputFormat(RoutineSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    return {
      items: [],
      reasoning: "루틴 생성에 실패했습니다.",
      warnings: warnings.length ? warnings : undefined,
    };
  }

  // exerciseId가 후보 목록에 있는지 다시 한번 코드 레벨에서 검증 - zod enum이 이미
  // 강제하지만, 존재하지 않는 운동은 절대 안 된다는 요구사항이라 이중으로 방어한다.
  const candidateById = new Map(candidates.map((c) => [c.id, c]));
  const items = parsed.items
    .filter((item) => candidateById.has(item.exerciseId))
    // reps/durationSeconds는 모델이 어느 필드를 채웠는지가 아니라 운동의 실제
    // unit_type을 기준으로 확정한다 - 모델이 필드를 잘못 채우거나 둘 다
    // 채우거나 둘 다 비워도 항상 정답 필드에만 값이 남는다.
    .map((item) => {
      const isDuration = candidateById.get(item.exerciseId)?.unit_type === "duration";
      const magnitude = item.reps ?? item.durationSeconds ?? (isDuration ? 30 : 10);
      return {
        ...item,
        reps: isDuration ? null : magnitude,
        durationSeconds: isDuration ? magnitude : null,
        // AI는 무게를 정하지 않는다 - 무게가 필요한 운동이면 트레이너가 초안
        // 화면에서 직접 입력한다.
        weightKg: null,
      };
    });

  return { items, reasoning: parsed.reasoning, warnings: warnings.length ? warnings : undefined };
}
