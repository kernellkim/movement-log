import { LegalPage, LegalSection, LegalTable } from "@/components/legal/legal-page";
import { CONTACT_EMAIL, SERVICE_NAME } from "@/lib/legal";

export const metadata = { title: `개인정보처리방침 | ${SERVICE_NAME}` };

export default function PrivacyPage() {
  return (
    <LegalPage title="개인정보처리방침">
      <p>
        {SERVICE_NAME}(이하 &quot;서비스&quot;)는 PT 회원이 트레이너의 지도 하에 안전하게 운동을
        복습하도록 돕는 서비스입니다. 서비스는 이용자의 개인정보를 소중히 다루며, 아래와 같이
        처리합니다.
      </p>

      <LegalSection title="1. 수집하는 개인정보 항목과 목적">
        <LegalTable
          head={["구분", "항목", "목적"]}
          rows={[
            [
              "일반 개인정보 (필수)",
              "이름, 이메일(로그인 ID), 비밀번호(암호화 저장), 생년월일, 성별, 수업·운동 기록",
              "회원 식별 및 로그인, 수업 기록 제공, 맞춤 운동 루틴 제공",
            ],
            [
              "민감정보 – 건강에 관한 정보 (별도 동의)",
              "PAR-Q 설문 응답, 상해력, 수술력, 기저질환, 건강 상태 업데이트 내용, 체성분(체중·체지방량·골격근량·체지방률·기초대사량)",
              "위험도 분류, 검사 항목 추천, 회원 상태에 맞는 안전한 운동 루틴 생성",
            ],
          ]}
        />
        <p>
          체성분 값은 트레이너가 직접 입력하거나, 업로드한 인바디 결과지 사진에서 AI가 읽어
          추출합니다. 업로드한 사진 자체는 서비스 데이터베이스에 저장하지 않습니다.
        </p>
      </LegalSection>

      <LegalSection title="2. 보유 및 이용 기간">
        <p>
          수집한 개인정보는 회원 삭제(탈퇴) 시 지체 없이 파기합니다. 담당 트레이너가 회원을
          삭제하면 문진표, 체성분, 루틴, 수업 기록이 함께 삭제됩니다. 다만 법령에 따라 보존해야
          하는 정보는 해당 기간 동안 보관합니다.
        </p>
      </LegalSection>

      <LegalSection title="3. 동의 거부 권리와 불이익">
        <p>
          이용자는 개인정보 수집·이용에 동의하지 않을 권리가 있습니다. 다만 일반 개인정보 동의를
          거부하면 서비스를 이용할 수 없고, 민감정보(건강정보) 동의를 거부하면 문진표 작성이
          불가능하여 위험도 분류와 맞춤 루틴 제공을 받을 수 없습니다.
        </p>
      </LegalSection>

      <LegalSection title="4. AI 분석과 개인정보 처리 위탁·국외 이전">
        <p>
          서비스는 문진 내용과 체성분 정보를 바탕으로 위험도 분류, 검사 항목 추천, 루틴 생성을
          위해 외부 AI 서비스를 이용합니다. AI는 의학적 진단이나 처방을 하지 않으며, 모든 결과는
          트레이너가 확인하는 &quot;권유·제안&quot; 단계입니다.
        </p>
        <LegalTable
          head={["수탁자", "국가", "위탁·이전 항목", "목적"]}
          rows={[
            [
              "Anthropic (Claude API)",
              "미국",
              "문진 응답, 상해력·수술력·기저질환, 건강 상태 업데이트, 체성분 수치, 인바디 결과지 사진",
              "AI 위험도 분류, 검사 추천, 루틴 생성, 인바디 값 추출",
            ],
            [
              "Supabase",
              "싱가포르",
              "서비스에서 처리하는 모든 개인정보",
              "데이터 저장 및 인증",
            ],
            [
              "Vercel",
              "한국(서울) 등",
              "서비스 이용 중 전송되는 정보",
              "웹 서비스 호스팅",
            ],
          ]}
        />
        <p>
          위 정보는 서비스를 이용하는 시점에 네트워크를 통해 전송되며, 각 수탁자의 정책에 따라
          보관됩니다. 국외 이전을 원하지 않으시면 서비스 이용 및 민감정보 동의가 제한될 수
          있습니다.
        </p>
      </LegalSection>

      <LegalSection title="5. 이용자의 권리">
        <p>
          이용자는 언제든지 자신의 개인정보를 열람·정정·삭제하거나 처리 정지 및 동의 철회를
          요청할 수 있습니다. 담당 트레이너 또는 아래 문의처로 요청해 주세요.
        </p>
      </LegalSection>

      <LegalSection title="6. 안전성 확보 조치">
        <ul className="list-disc space-y-1 pl-5">
          <li>비밀번호는 암호화되어 저장되며 서비스 운영자도 확인할 수 없습니다.</li>
          <li>회원 정보는 본인과 담당 트레이너만 열람할 수 있도록 접근 권한을 분리합니다.</li>
          <li>모든 통신은 HTTPS로 암호화됩니다.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. 문의처">
        <p>
          개인정보 관련 문의는{" "}
          {CONTACT_EMAIL ? (
            <a className="text-accent-foreground underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
          ) : (
            "담당 트레이너를 통해"
          )}{" "}
          요청해 주세요.
        </p>
      </LegalSection>

      <LegalSection title="8. 방침의 변경">
        <p>
          이 방침이 변경되면 서비스 내 공지하고, 변경된 내용에 대해 다시 동의를 받을 수 있습니다.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
