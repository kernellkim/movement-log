import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { SERVICE_NAME } from "@/lib/legal";

export const metadata = { title: `이용약관 | ${SERVICE_NAME}` };

export default function TermsPage() {
  return (
    <LegalPage title="이용약관">
      <LegalSection title="1. 서비스 소개">
        <p>
          {SERVICE_NAME}는 PT 회원이 수업에서 배운 운동을 복습하고, 트레이너가 회원의 몸 상태에
          맞는 운동 루틴을 관리하도록 돕는 웹 서비스입니다.
        </p>
      </LegalSection>

      <LegalSection title="2. 의학적 진단이 아닙니다">
        <p>
          서비스가 제공하는 위험도, 검사 항목, 운동 루틴은 AI가 만든 참고용 제안이며 의학적
          진단이나 처방이 아닙니다. 모든 운동은 담당 트레이너의 지도 하에 진행해 주세요. 통증이나
          이상 증상이 있으면 즉시 운동을 중단하고 의료진과 상담하세요.
        </p>
      </LegalSection>

      <LegalSection title="3. 계정">
        <ul className="list-disc space-y-1 pl-5">
          <li>회원 계정은 담당 트레이너의 초대로 생성되며, 본인만 사용해야 합니다.</li>
          <li>비밀번호는 직접 관리해야 하며, 타인에게 공유해서는 안 됩니다.</li>
          <li>회원 정보 삭제(탈퇴)는 담당 트레이너를 통해 요청할 수 있습니다.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. 이용자의 책임">
        <p>
          문진표와 건강 상태 업데이트는 사실대로 작성해야 합니다. 부정확하거나 누락된 정보로
          발생한 결과에 대해서는 서비스가 책임지기 어렵습니다.
        </p>
      </LegalSection>

      <LegalSection title="5. 서비스의 변경과 중단">
        <p>
          서비스는 기능 개선 등을 위해 내용을 변경하거나 일시 중단할 수 있으며, 중요한 변경은
          서비스 내에서 알립니다.
        </p>
      </LegalSection>

      <LegalSection title="6. 개인정보">
        <p>
          개인정보의 수집·이용과 처리에 관한 내용은{" "}
          <Link href="/privacy" className="text-accent-foreground underline underline-offset-2">
            개인정보처리방침
          </Link>
          을 따릅니다.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
