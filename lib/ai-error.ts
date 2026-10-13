import Anthropic from "@anthropic-ai/sdk";

// AI 호출 실패를 사용자(트레이너)에게 보여줄 한국어 문구로 바꾸고 서버 로그에 남긴다.
// 크레딧 소진·키 오류처럼 운영자가 조치해야 하는 경우와 잠시 후 재시도하면 되는
// 경우를 구분해서 안내한다.
export function describeAiError(error: unknown, context: string): {
  message: string;
  status: number;
} {
  console.error(`[AI error] ${context}`, error);

  if (error instanceof Anthropic.APIError) {
    const text = String(error.message ?? "").toLowerCase();
    if (text.includes("credit balance") || text.includes("billing")) {
      return {
        message:
          "AI 사용 크레딧이 부족해 요청을 처리하지 못했습니다. 운영자가 크레딧을 충전한 뒤 다시 시도해 주세요.",
        status: 503,
      };
    }
    if (error.status === 401 || error.status === 403) {
      return {
        message: "AI 서비스 인증에 문제가 있습니다. 운영자에게 API 키 설정 확인을 요청해 주세요.",
        status: 503,
      };
    }
    if (error.status === 429) {
      return {
        message: "AI 요청이 몰려 잠시 처리하지 못했습니다. 1분 정도 뒤에 다시 시도해 주세요.",
        status: 429,
      };
    }
    if (error.status === 529 || (error.status !== undefined && error.status >= 500)) {
      return {
        message: "AI 서비스가 일시적으로 불안정합니다. 잠시 후 다시 시도해 주세요.",
        status: 503,
      };
    }
  }

  return {
    message: "AI 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    status: 500,
  };
}
