# 운영 적용 체크리스트 (트레이너 캘린더 DB + 권한)

대상: 브랜치 `feat/schedule-calendar`의 마이그레이션 `20261028000100` ~ `20261028000700` 7개 (baseline `20260830000000` 제외)와 앱 코드 변경(서버 경로 3곳, 6-1단계).
범위: 트레이너용 단순 캘린더(`schedule_events`)와 회원 읽기 전용 뷰(`member_schedule`)뿐입니다. 사인·출력·신청서·요금·아파트 주민은 이 앱에 없습니다.
(이전 브랜치 `feat/schedule-db`의 10개 마이그레이션은 로컬 외에는 어디에도 적용된 적이 없고, 이 7개로 대체되었습니다. 둘을 섞어 적용하지 마세요.)
현재 상태: **로컬 검증 완료, 운영 미적용.** 아래 순서를 건너뛰거나 바꾸지 마세요.

> **순서에 대한 메모 (확정됨)**: 요청된 순서는 "트레이너 스니펫 → 마이그레이션 적용"이었지만,
> 스니펫이 넣는 `public.trainers` 테이블은 마이그레이션 `…000300`이 만들기 때문에 그 전에는 실행할 수 없습니다.
> 그래서 5단계(마이그레이션 적용) 바로 다음 6단계에서 실행합니다(소유자 확정). 그 사이의 틈은 안전합니다.
> 앱은 `members`를 service role로만 INSERT하고(`app/api/members/invite/route.ts`), 캘린더 UI는 아직 앱에 없기 때문입니다.

## 1. 백업 + 복원 연습 완료

- [ ] 운영 DB 전체 덤프(스키마 + 데이터)를 받아 **암호화해서 저장소 밖에** 보관했다.
- [ ] 그 덤프를 **로컬 DB에 복원**해 보았고, 테이블 14개와 행 수가 운영과 같다.
- [ ] 복원한 DB에서 `members`, `session_logs`를 몇 건 조회해 정상임을 확인했다.

백업 없이는 다음 단계로 가지 않습니다. (설계 문서 D19, 2단계)

## 2. baseline migration repair (baseline과 seed는 운영에서 절대 실행하지 않음)

운영의 마이그레이션 기록에는 옛 이름의 22개 버전이 있고, 레포에는 그 파일이 없습니다.
`supabase db push`는 이 불일치를 에러로 막으므로, **기록만** 정리합니다(스키마는 건드리지 않음).

```bash
supabase link --project-ref kkwlfrmrtatfmozewzxa
supabase migration list     # 먼저 현재 상태를 눈으로 확인

# 옛 기록 22개를 "되돌림"으로 표시 (기록 테이블의 행만 지워짐)
supabase migration repair --status reverted \
  20260830063400 20260830063520 20260830063613 20260830064109 20260831075849 20260831083126 \
  20260831090024 20260901112208 20260902005450 20260902055440 20260905042812 20260905050605 \
  20260916071647 20260918084115 20260918134345 20260930010103 20260930015347 20261012235804 \
  20261013005055 20261013014922 20261013033223 20261013040126

# baseline은 "이미 적용됨"으로만 표시. baseline SQL 자체는 실행하지 않는다
supabase migration repair --status applied 20260830000000

supabase migration list     # 로컬과 원격이 baseline까지 일치하는지 확인
```

- [ ] `supabase/seed.sql`은 **로컬 전용**입니다. 운영에서 실행하지 않고, `db push`에 `--include-seed`를 붙이지 않습니다(운영에는 이미 78행이 있음).
- [ ] 이 단계의 동작은 이 레포 환경에서 직접 확인하지 못했습니다. **3단계 리허설에서 같은 명령으로 먼저 확인**합니다.

## 3. 별도 Supabase 프로젝트에서 리허설 (가짜 데이터만)

- [ ] 새 Supabase 프로젝트를 만든다. **운영 프로젝트가 아니며 실제 회원 데이터는 넣지 않는다.**
- [ ] 운영 스키마를 재현한다: 1단계 덤프에서 **스키마만** 가져오거나, 빈 프로젝트에 `20260830000000_baseline.sql`만 실행한다. 그 뒤 `exercise_library`는 `seed.sql`로 채워도 된다(리허설 프로젝트에서만).
- [ ] 가짜 트레이너 계정 1개, 가짜 회원 계정 1개를 만들고(회원은 `members`에 연결) 가짜 캘린더 일정을 넣는다.
- [ ] 2단계(repair 포함, 옛 기록 22개가 있는 상태를 흉내 낸 뒤)부터 6단계까지 **똑같은 명령으로** 수행한다.
- [ ] 7단계 스모크 테스트를 리허설 프로젝트의 앱(Vercel 프리뷰 + 해당 프로젝트 키)에서 통과시킨다.
- [ ] 리허설에서 막힌 점과 걸린 시간을 이 문서에 적어 둔다.

### 3-1. 리허설에서 반드시 확인할 것 (운영에서는 확인하지 못한 것들)

이 레포 환경에서는 운영 프로젝트에 `supabase link` 하지 않았고(읽기 전용 SQL 조회만 했음), 로컬 스택에서는 마이그레이션 기록 테이블이
비어 있어서 **2단계(baseline repair)는 한 번도 실행해 보지 못했습니다.** 아래는 제가 직접 확인한 것과 아직 모르는 것의 구분입니다.

확인한 것 (로컬, 운영 카탈로그 조회):
- 운영의 마이그레이션 기록에는 옛 이름 22개 버전이 있다 (`list_migrations`로 조회, 2단계 목록과 같음).
- baseline 파일은 운영 스키마와 테이블·컬럼·제약·인덱스·정책·권한이 일치한다 (해시 비교).
- `supabase db reset`으로 빈 DB에서 baseline부터 끝까지 적용되고 pgTAP 97개가 통과한다.
- `postgres`는 운영·로컬 모두 슈퍼유저가 아니며, 로컬에서 `alter default privileges for role postgres`가 성공했다.

리허설에서 직접 확인해야 하는 것 (하나라도 다르면 2단계 명령을 고치고 이 문서에 적는다):
- [ ] **`supabase migration list`가 옛 기록 22개를 어떻게 보여 주는가.** 예상: 원격에만 있는 22개가 "Remote only"로 나오고, `db push`는
      "Remote migration versions not found in local migrations directory" 오류로 멈춘다. 예상과 다르면(오류 없이 진행 등) 즉시 중단.
- [ ] **옛 22개를 `repair --status reverted`로 표시하면** `supabase_migrations.schema_migrations`에서 그 행들만 사라지고 **스키마는 그대로**인가
      (`\dt public.*`, 행 수 비교로 확인). 이것이 "옛 22개를 어떻게 처리하는가"에 대한 이 문서의 답이다. 대안(`supabase db pull`로 새 파일 생성)은 쓰지 않는다.
- [ ] **`repair --status applied 20260830000000` 이후** `migration list`에서 baseline이 로컬·원격 양쪽에 "applied"로 보이는가.
- [ ] **`supabase db push --dry-run`이 정확히 7개 파일(`…000100` ~ `…000700`)만 보여 주는가.** baseline이나 `seed.sql`이 목록에 있으면 중단.
- [ ] 만약 baseline이 실행 대상에 들어가 버리면 첫 `create table`에서 "already exists"로 실패해야 한다 (마이그레이션 파일 하나는 한 트랜잭션이라
      중간까지 적용되지 않는다고 알고 있으나 **확인하지 못함**). 실제로 일부만 적용되는지 리허설에서 본다.
- [ ] `db push`가 시드를 실행하지 않는가 (`--include-seed`를 붙이지 않은 기본 동작).
- [ ] 적용 후 `select current_user;`가 `postgres`이고, `pg_default_acl`에서 `postgres`의 public 기본 권한에서 anon·authenticated가 빠졌는가
      (`supabase_admin` 항목은 그대로 남는 것이 정상).
- [ ] 같은 CLI 버전으로 확인한다 (이 레포에서 쓴 버전: 2.122.0).

> **참고: SQL 레벨 리허설(운영 복원본을 plain Postgres 컨테이너에 올린 것)은 운영과 롤 속성이 다릅니다.** 그 복원본에서는 `postgres`가 **슈퍼유저**이고(운영은 아님), `service_role`에 **BYPASSRLS가 없습니다**(운영 Supabase에는 있음). 그래서 위 체크리스트의 "`postgres`는 슈퍼유저가 아니다"·`alter default privileges for role postgres` 성공·`pg_default_acl` 확인 항목과 service_role 흐름(초대 INSERT, 회원 삭제)은 이 복원본으로는 증명되지 않고, **Supabase 리허설 프로젝트에서만** 의미가 있습니다. 복원본에서는 service_role 테스트를 위해 롤백되는 트랜잭션 안에서 `alter role service_role bypassrls`로 흉내 냈습니다.

## 4. (건너뜀: 스니펫은 6단계로 이동. 위 메모 참고)

## 5. 마이그레이션 적용

**적용 전 확인: anon 사용처 점검.** `…000100`은 anon에서 11개 테이블의 모든 권한을 회수하고, 3개 테이블(`exercise_library`, `members`, `routines`)은 SELECT만 남깁니다. 세션 없이 실행되는 코드가 그 밖의 테이블을 읽거나 쓰면 운영에서 `permission denied`(42501)로 깨집니다. 적용 전에 아래를 확인합니다.

```bash
# anon 키로 클라이언트를 만드는 곳 (현재: lib/supabase/{server,client,middleware}.ts 3곳뿐이어야 함)
grep -rn "NEXT_PUBLIC_SUPABASE_ANON_KEY" app lib components proxy.ts
# 세션 없이 통과시키는 경로 (현재: /login, /auth, /terms, /privacy, /api/health)
grep -n "isAuthRoute" -A6 lib/supabase/middleware.ts
```

- [ ] 세션 없이 도달하는 경로가 `/api/health`(3개 테이블 SELECT)뿐이다. 새 공개 경로가 생겼다면 그 경로의 테이블·동작을 `…000100` 허용 목록과 비교했다.
- (2026-10-29 점검 결과: 위 조건을 만족함. 상세는 감사 메모 `anon-audit.md` 참고, 레포 밖.)

```bash
supabase db push --dry-run   # 적용될 파일이 …000100 ~ …000700 7개뿐인지 확인
supabase db push
```

- [ ] dry-run 목록에 baseline(`…000000`)이나 다른 파일이 없다.
- [ ] 적용 후 `supabase migration list`가 로컬과 일치한다.
- [ ] 새 테이블/뷰/함수에는 더 이상 기본 권한이 붙지 않습니다(`…000200`). 앞으로 만드는 테이블은 마이그레이션 안에서 `grant`를 직접 써야 합니다.

## 6. 트레이너 계정 등록 (ops 스니펫)

기존 트레이너 계정마다 한 번 실행합니다. 같은 계정에 다시 실행해도 안전합니다.
Supabase 대시보드 → Authentication → Users에서 트레이너의 **User UID**를 복사해 사용합니다.

```bash
psql "$DATABASE_URL" -v trainer_user_id='<User UID>' -f supabase/ops/register_trainer.sql
```

- [ ] 트레이너 2~3명 모두 등록했다. 회원 로그인 계정은 등록되지 않는다(스니펫이 거부함).
- [ ] `select user_id, created_at from public.trainers;`로 등록 결과를 확인했다.

## 6-1. 앱 코드 배포 (트레이너 판정을 `trainers` 행으로 변경)

> **main에는 마이그레이션 적용(5단계)과 트레이너 등록(6단계)이 모두 끝난 뒤에만 배포합니다.**
> main에 머지하면 Vercel이 바로 운영에 배포하는데, 변경된 서버 경로 3곳(초대, 비밀번호 재설정 링크, 회원 삭제)은 `public.trainers`에 행이 있는 사용자만 허용합니다.
> 그 전에 배포하면 기존 트레이너도 `trainers` 행이 없어(테이블이 없어도 마찬가지) **초대·비밀번호 재설정·회원 삭제가 모두 "권한이 없습니다."(403 또는 안내 문구)로 막힙니다.**

- **트레이너 등록은 필수입니다.** 초대·비밀번호 재설정·회원 삭제 3개 경로와 캘린더 RLS 모두 `trainers` 행으로 트레이너를 판정합니다. 등록하지 않은 계정은 이 기능을 쓸 수 없습니다.
- 대상 파일: `app/api/members/invite/route.ts`, `app/api/members/reset-password/route.ts`, `app/trainer/members/actions.ts`(회원 삭제), `lib/auth.ts`(`isTrainer` 추가).
- 커밋 제목: `Require a trainers row to create member invites`, `Require a trainers row for reset-password and member deletion`.
- 브랜치 push로 생기는 Vercel **프리뷰**는 운영 URL이 아니지만, 프리뷰가 운영 Supabase 키를 쓰고 있다면 위 이유로 프리뷰에서 초대·비밀번호 재설정·회원 삭제가 막힙니다(정상).
- [ ] 5·6단계 완료 후에 머지했다.
- [ ] 같은 시점에 7단계의 "새 회원 추가", "비밀번호 재설정 링크 발급", "회원 삭제"를 바로 확인한다.

## 7. 스모크 테스트 (운영, 각각 직접 눌러 본다)

- [ ] `GET /api/health` → `{"ok":true,"queries":3}` (anon으로 3개 테이블을 읽는다. 500이면 `…000100`의 anon 권한을 점검)
- [ ] 트레이너 로그인 → 회원 목록이 보인다
- [ ] 트레이너가 새 회원 추가(초대 링크 발급)가 된다 (service role INSERT 경로)
- [ ] 초대받은 회원이 비밀번호를 설정한다 (`members.password_set_at` 갱신: 회원 UPDATE 경로)
- [ ] 회원이 문진표를 제출한다 (`birth_date`, `gender` 갱신)
- [ ] 회원이 탈퇴 요청을 켰다 끈다 (`deletion_requested_at` 갱신)
- [ ] 트레이너가 비밀번호 재설정 링크를 발급한다 (`trainers` 행 확인 경로)
- [ ] 트레이너가 회원 삭제를 한다 (테스트 회원으로. `auth` 계정까지 지워짐)
- [ ] 회원이 다른 회원 데이터를 볼 수 없다 (URL 직접 입력으로 확인)
- [ ] (DB만, 캘린더 UI 배포 전) 리허설 프로젝트에서 SQL로 확인: 트레이너 JWT로 `schedule_events` INSERT/SELECT가 되고, 회원 JWT로 `member_schedule`에 본인의 공개 일정만 보이며 `schedule_events` 직접 조회는 0행이다

하나라도 실패하면 8단계의 해당 롤백을 하고 원인을 찾은 뒤 다시 시작합니다.

## 8. 롤백 메모 (마이그레이션별, 최신부터)

롤백은 새 마이그레이션 파일이나 SQL 에디터로 하며, 적용된 파일을 수정하지 않습니다.
**위험도**: 🟢 쉬움 / 🟡 앱 코드와 함께 되돌려야 함 / 🔴 데이터가 사라질 수 있음.

| 마이그레이션 | 롤백 | 위험도 |
| --- | --- | --- |
| `…000700` members 가드 (self-update 제한, user_id 고정, INSERT 제한) | `drop policy members_insert_requires_trainer on public.members; drop trigger trg_members_self_update_guard on public.members; drop function private.members_self_update_guard();` (보안이 느슨해짐) | 🟢 |
| `…000600` `member_schedule` 뷰 | `drop view public.member_schedule;` (회원의 일정 조회 화면만 멈춤) | 🟡 |
| `…000500` `schedule_events` RLS·권한 | `drop policy evt_trainer_select on public.schedule_events; drop policy evt_trainer_insert on public.schedule_events; drop policy evt_trainer_update on public.schedule_events;` 정책 삭제 후 RLS를 켠 채 두면 접근이 모두 막혀 안전함. 완전 해제는 `alter table … disable row level security` (권장하지 않음) | 🟢 |
| `…000400` `schedule_events` 테이블 + 쓰기 트리거 | `drop table public.schedule_events; drop function private.sched_before_write();` — **일정이 쌓인 뒤에는 데이터가 모두 사라짐. 먼저 이 테이블을 덤프할 것.** 뷰(`…000600`)를 먼저 지워야 함 | 🔴 |
| `…000300` `trainers` + `private.is_trainer()` | `drop function private.is_trainer(); drop table public.trainers;` — **앱 서버 경로 3곳(6-1단계)이 `trainers` 행을 요구하므로 앱 코드를 먼저 되돌릴 것.** 이후 `schedule_events` 정책과 `members_insert_requires_trainer`(`…000700`)도 이 함수를 쓰므로 `…000700`/`…000500`/`…000400`을 먼저 롤백(아니면 `drop function`이 의존성 오류로 실패) | 🔴 |
| `…000200` 기본 권한 | 아래 4줄을 그대로 실행 (이전 상태 복원, 미래 객체에만 영향). 리허설에서 이 4줄로 `pg_default_acl`이 베이스라인과 동일하게 복원됨을 확인함 | 🟢 |
| `…000100` 권한 회수 | `grant truncate, trigger, references on all tables in schema public to anon, authenticated; grant all on all tables in schema public to anon;` (보안은 느슨해짐) | 🟢 |
| baseline repair (2단계) | `supabase migration repair --status`로 기록만 되돌릴 수 있음. 스키마에는 영향 없음 | 🟢 |

`…000200` 롤백 SQL (4줄 전체):

```sql
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated;
alter default privileges for role postgres grant execute on functions to public;
```

**롤백 순서는 반드시 `…000700` → `…000100` (최신부터).** 의존성 때문입니다: `members_insert_requires_trainer`(`…000700`)와 `schedule_events` 정책(`…000500`)이 `private.is_trainer()`(`…000300`)를 쓰고, 뷰(`…000600`)가 `schedule_events`(`…000400`)를 읽습니다. 순서를 바꾸면 `drop function`/`drop table`이 의존성 오류로 막힙니다.
리허설(`drill2`)에서 이 순서와 위 SQL로 롤백한 뒤 스키마 덤프가 베이스라인과 의미상 동일함을 확인했습니다(`GRANT` 줄의 나열 순서만 다름).

앱 코드(6-1단계)를 되돌릴 때는 main에서 해당 커밋을 revert합니다. DB 롤백과는 독립적이며, 트레이너 등록 행(`trainers`)은 그대로 두어도 무해합니다.

### 알려진 제약

- **일정이 있는 트레이너의 `auth.users` 행은 삭제할 수 없습니다.** `schedule_events.trainer_id`가 `auth.users(id)`를 참조하고 `ON DELETE` 동작이 없어서, 그런 계정을 지우면 FK 오류(`23503`)가 납니다(리허설에서 확인). 트레이너 계정 삭제 절차가 생기면 그 트레이너의 `schedule_events`를 먼저 정리해야 합니다. (회원 삭제는 영향 없음: 회원을 지우면 일정은 남고 `member_id`만 NULL이 됩니다.)

### 파괴적이거나 되돌리기 어려운 것

- 🔴 `…000400`: `schedule_events`는 실데이터(트레이너의 일정)가 쌓이는 순간부터 롤백이 곧 데이터 손실이다. 먼저 덤프한다.
- 🔴 `…000300`: `trainers`를 지우면 서버 경로 3곳이 모두 403이 된다. 앱 코드를 먼저 되돌린다.
- 🟡 `…000600`: 뷰를 지우면 회원 화면만 멈춘다. 데이터는 그대로다.
- `…000100`, `…000200`, `…000700`은 데이터를 건드리지 않지만, 되돌리면 보안이 약해진다(`TRUNCATE`는 RLS를 우회한다).
