import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { PARQ_QUESTIONS } from "@/lib/parq";
import type { ParqAnswer, RiskLevel } from "@/lib/types";

const RiskSchema = z.object({
  risk_level: z.enum(["low", "mid", "high"]),
  reasoning: z.string(),
});

const RISK_ORDER: Record<RiskLevel, number> = { low: 0, mid: 1, high: 2 };

// PAR-Q 규칙상 최소 위험도: 하나라도 "예"면 mid, 심장질환/흉통 관련 항목이 "예"면 high.
// 안전 관련 로직이므로 프롬프트 지시뿐 아니라 서버에서도 하한선을 강제한다.
export function parqFloor(answers: ParqAnswer[]): RiskLevel {
  const yes = answers.filter((a) => a.answer);
  if (yes.length === 0) return "low";
  const cardiacYes = yes.some(
    (a) => PARQ_QUESTIONS.find((q) => q.id === a.id)?.cardiac,
  );
  return cardiacYes ? "high" : "mid";
}

export async function classifyRisk(input: {
  parqAnswers: ParqAnswer[];
  injuryHistory: string;
  surgeryHistory: string;
  chronicCondition: string;
  healthUpdatesText?: string;
}): Promise<{ riskLevel: RiskLevel; reasoning: string }> {
  const floor = parqFloor(input.parqAnswers);

  const parqSummary = input.parqAnswers
    .map((a) => {
      const q = PARQ_QUESTIONS.find((q) => q.id === a.id);
      return `${a.id}. ${q?.text} -> ${a.answer ? "예" : "아니오"}${q?.cardiac ? " (심장질환/흉통 관련)" : ""}`;
    })
    .join("\n");

  const client = new Anthropic();
  const response = await client.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 2048,
    system: `당신은 피트니스 트레이너를 보조하는 위험도 분류 도우미입니다. 회원의 PAR-Q 응답과 부상/수술/지병 이력을 보고 운동 시작 전 위험도를 low, mid, high 중 하나로 분류하세요.

규칙:
- PAR-Q 7문항 중 하나라도 "예"가 있으면 최소 mid 이상으로 분류합니다.
- 심장질환/흉통 관련 항목(심장질환 진단, 활동 중 흉통, 안정 시 흉통, 혈압/심장약 복용)에 "예"가 있으면 반드시 high로 분류합니다.
- 부상/수술/지병 이력에 심각한 내용이 있으면 위 규칙보다 위험도를 더 높일 수 있지만, 낮출 수는 없습니다.
- 건강 상태 업데이트 이력(문진표 제출 이후 회원이 추가로 알려온 내용)에 통증 재발, 새로운 부상 등 악화된 내용이 있으면 위험도를 더 높이는 데 반영하세요. 반대로 호전됐다는 내용이 있어도 원 문진표 기반 위험도보다 낮출 수는 없습니다.
- reasoning은 한국어로 2~3문장으로 간결하게 작성하세요.`,
    messages: [
      {
        role: "user",
        content: `[PAR-Q 응답]\n${parqSummary}\n\n[부상 이력]\n${input.injuryHistory || "없음"}\n\n[수술 이력]\n${input.surgeryHistory || "없음"}\n\n[지병]\n${input.chronicCondition || "없음"}\n\n[건강 상태 업데이트 이력]\n${input.healthUpdatesText || "없음"}`,
      },
    ],
    output_config: { format: zodOutputFormat(RiskSchema) },
  });

  const parsed = response.parsed_output;
  const modelLevel = parsed?.risk_level ?? floor;

  // 모델이 하한선보다 낮게 분류하더라도 규칙상 하한선을 절대 하회하지 않도록 보정
  const riskLevel =
    RISK_ORDER[modelLevel] >= RISK_ORDER[floor] ? modelLevel : floor;

  return {
    riskLevel,
    reasoning: parsed?.reasoning ?? "PAR-Q 규칙에 따른 자동 분류",
  };
}
