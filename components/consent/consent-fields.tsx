import Link from "next/link";
import { CONSENT_FIELD } from "@/lib/consent";

const checkboxClass =
  "mt-0.5 size-4 shrink-0 cursor-pointer accent-primary";

// 일반 개인정보 + 이용약관 동의. 사전 체크 없이 사용자가 직접 체크해야 한다.
export function TermsPrivacyConsentField() {
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <label className="flex items-start gap-2.5 text-sm text-foreground">
        <input
          type="checkbox"
          name={CONSENT_FIELD.terms_privacy}
          required
          className={checkboxClass}
        />
        <span>
          <span className="font-medium text-accent-foreground">[필수]</span> 이용약관 및
          개인정보 수집·이용에 동의합니다.
        </span>
      </label>
      <details className="pl-6.5 text-xs text-muted-foreground">
        <summary className="cursor-pointer">수집 내용 보기</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>항목: 이름, 이메일, 비밀번호(암호화), 생년월일, 성별, 수업·운동 기록</li>
          <li>목적: 회원 식별·로그인, 수업 기록 제공, 맞춤 운동 루틴 제공</li>
          <li>보유 기간: 회원 삭제(탈퇴) 시까지</li>
          <li>동의를 거부할 수 있으나, 거부 시 서비스를 이용할 수 없습니다.</li>
        </ul>
      </details>
      <p className="pl-6.5 text-xs">
        <Link href="/terms" target="_blank" className="text-accent-foreground underline underline-offset-2">
          이용약관
        </Link>
        {" · "}
        <Link href="/privacy" target="_blank" className="text-accent-foreground underline underline-offset-2">
          개인정보처리방침
        </Link>
      </p>
    </div>
  );
}

// 민감정보(건강정보) 별도 동의. 일반 동의와 반드시 분리된 체크박스로 받는다.
export function SensitiveHealthConsentField() {
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <label className="flex items-start gap-2.5 text-sm text-foreground">
        <input
          type="checkbox"
          name={CONSENT_FIELD.sensitive_health}
          required
          className={checkboxClass}
        />
        <span>
          <span className="font-medium text-accent-foreground">[필수]</span> 건강에 관한 정보
          (민감정보) 수집·이용 및 AI 분석을 위한 국외 전송에 동의합니다.
        </span>
      </label>
      <ul className="list-disc space-y-1 pl-10 text-xs text-muted-foreground">
        <li>항목: PAR-Q 응답, 상해력, 수술력, 기저질환, 건강 상태 업데이트, 체성분 수치</li>
        <li>목적: 위험도 분류, 검사 항목 추천, 몸 상태에 맞는 안전한 운동 루틴 생성</li>
        <li>보유 기간: 회원 삭제(탈퇴) 시까지</li>
        <li>
          위 정보는 AI 분석을 위해 외부 AI 서비스(Anthropic, 미국)로 전송됩니다. AI는 진단이나
          처방을 하지 않으며 트레이너가 결과를 확인합니다.
        </li>
        <li>
          동의를 거부할 수 있으나, 거부하면 문진표를 작성할 수 없어 위험도 분류와 맞춤 루틴을
          제공받을 수 없습니다.
        </li>
      </ul>
      <p className="pl-6.5 text-xs">
        <Link href="/privacy" target="_blank" className="text-accent-foreground underline underline-offset-2">
          개인정보처리방침 자세히 보기
        </Link>
      </p>
    </div>
  );
}
