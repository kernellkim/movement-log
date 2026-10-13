"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { needsWeightInput } from "@/lib/format";
import type { Exercise } from "@/lib/types";
import { saveSelfWorkout } from "./actions";

type DraftItem = {
  key: string;
  exercise: Exercise;
  sets: string;
  reps: string; // reps 또는 유지 시간(초)
  weight: string;
};

const toNumber = (v: string): number | null =>
  v.trim() === "" ? null : Number(v);

export type SessionTemplate = {
  id: string;
  date: string;
  excluded: number; // 안전 기준상 제외된 운동 수
  items: {
    exerciseId: string;
    sets: number | null;
    reps: number | null;
    durationSeconds: number | null;
    weightKg: number | null;
  }[];
};

export type LastValue = {
  exerciseId: string;
  sets: number | null;
  reps: number | null;
  durationSeconds: number | null;
  weightKg: number | null;
  lastDate: string;
};

const MAX_RECOMMENDED = 6;

export function SelfWorkoutForm({
  exercises,
  templates,
  lastValues,
  recentCategories,
  recommendedCategories,
  needsTrainerCheck,
  today,
}: {
  exercises: Exercise[];
  templates: SessionTemplate[];
  lastValues: LastValue[];
  recentCategories: string[];
  recommendedCategories: string[];
  needsTrainerCheck: boolean;
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(today);
  const [memo, setMemo] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // 시작 방식: 먼저 "지난 수업 루틴 불러오기"와 "새로 만들기" 중 고른다.
  const [step, setStep] = useState<
    "choose" | "pick-session" | "recommend" | "edit"
  >("choose");
  const [pickedCategories, setPickedCategories] = useState<string[]>(
    recommendedCategories,
  );
  const [recommendError, setRecommendError] = useState<string | null>(null);
  // 운동 고르기 목록은 "직접 만들기"일 때만 보여준다(불러오기·추천 구성은 이미 운동이 채워져 있음).
  const [canPick, setCanPick] = useState(false);
  const [loadedNotice, setLoadedNotice] = useState<string | null>(null);

  const categories = useMemo(
    () => [
      "전체",
      ...Array.from(
        new Set(exercises.map((e) => e.category).filter(Boolean) as string[]),
      ),
    ],
    [exercises],
  );

  const categoryOptions = categories.filter((c) => c !== "전체");

  // 검색어를 입력하지 않아도 카테고리별로 훑어볼 수 있게 항상 목록을 보여준다.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter(
      (e) =>
        (category === "전체" || e.category === category) &&
        (!q ||
          (e.name_ko ?? e.name_en).toLowerCase().includes(q) ||
          e.name_en.toLowerCase().includes(q)),
    );
  }, [exercises, query, category]);

  function loadTemplate(template: SessionTemplate) {
    const byId = new Map(exercises.map((e) => [e.id, e]));
    setItems(
      template.items.flatMap((t, index) => {
        const exercise = byId.get(t.exerciseId);
        if (!exercise) return [];
        return [
          {
            key: `${exercise.id}-${Date.now()}-${index}`,
            exercise,
            sets: t.sets != null ? String(t.sets) : "",
            reps:
              exercise.unit_type === "duration"
                ? t.durationSeconds != null
                  ? String(t.durationSeconds)
                  : ""
                : t.reps != null
                  ? String(t.reps)
                  : "",
            weight: t.weightKg != null ? String(t.weightKg) : "",
          },
        ];
      }),
    );
    setLoadedNotice(
      template.excluded > 0
        ? `내 건강 상태에 맞지 않는 운동 ${template.excluded}개는 제외하고 불러왔어요.`
        : null,
    );
    setCanPick(false);
    setSaved(false);
    setStep("edit");
  }

  // 규칙 기반 추천 구성: 고른 부위의 운동 중 트레이너와 최근에 한 운동부터 최대 6개를
  // 부위별로 번갈아 담고, 세트·횟수·무게는 마지막 수업 값을 따른다(3세트 이상이면
  // 개인 운동용으로 1세트 줄임).
  function buildRecommendation() {
    setRecommendError(null);
    const lastById = new Map(lastValues.map((v) => [v.exerciseId, v]));
    const byCategory = pickedCategories.map((c) =>
      exercises
        .filter((e) => e.category === c && lastById.has(e.id))
        .sort((a, b) =>
          (lastById.get(b.id)?.lastDate ?? "").localeCompare(
            lastById.get(a.id)?.lastDate ?? "",
          ),
        ),
    );
    const picked: Exercise[] = [];
    for (let round = 0; picked.length < MAX_RECOMMENDED; round++) {
      let added = false;
      for (const list of byCategory) {
        if (round < list.length && picked.length < MAX_RECOMMENDED) {
          picked.push(list[round]);
          added = true;
        }
      }
      if (!added) break;
    }
    if (picked.length === 0) {
      setRecommendError(
        "고른 부위에서 트레이너와 함께 해 본 운동이 없어요. 다른 부위를 골라 주세요.",
      );
      return;
    }
    setItems(
      picked.map((exercise, index) => {
        const v = lastById.get(exercise.id)!;
        const sets = v.sets != null && v.sets >= 3 ? v.sets - 1 : v.sets;
        const amount =
          exercise.unit_type === "duration" ? v.durationSeconds : v.reps;
        return {
          key: `${exercise.id}-rec-${Date.now()}-${index}`,
          exercise,
          sets: sets != null ? String(sets) : "",
          reps: amount != null ? String(amount) : "",
          weight: v.weightKg != null ? String(v.weightKg) : "",
        };
      }),
    );
    setLoadedNotice(
      `${pickedCategories.join("·")} 추천 구성이에요. 트레이너와 함께 한 마지막 수업 기준이고, 3세트 이상이던 운동은 한 세트씩 줄였어요. 몸 상태에 맞게 고쳐서 쓰세요.`,
    );
    setCanPick(false);
    setSaved(false);
    setStep("edit");
  }

  function startFresh() {
    setCanPick(true);
    setItems([]);
    setLoadedNotice(null);
    setSaved(false);
    setStep("edit");
  }

  function addExercise(exercise: Exercise) {
    setItems((prev) => [
      ...prev,
      {
        key: `${exercise.id}-${Date.now()}`,
        exercise,
        sets: "",
        reps: "",
        weight: "",
      },
    ]);
    setSaved(false);
  }

  function update(key: string, patch: Partial<DraftItem>) {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, ...patch } : i)),
    );
    setSaved(false);
  }

  function submit() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveSelfWorkout({
        date,
        memo,
        items: items.map((i) => ({
          exerciseId: i.exercise.id,
          sets: toNumber(i.sets),
          reps: i.exercise.unit_type === "duration" ? null : toNumber(i.reps),
          durationSeconds:
            i.exercise.unit_type === "duration" ? toNumber(i.reps) : null,
          weightKg: needsWeightInput(i.exercise.equipment)
            ? toNumber(i.weight)
            : null,
        })),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setItems([]);
      setMemo("");
        setSaved(true);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>오늘 한 운동 기록하기</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === "choose" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">어떻게 시작할까요?</p>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              disabled={templates.length === 0}
              onClick={() => setStep("pick-session")}
            >
              지난 수업 루틴 불러오기
            </Button>
            {templates.length === 0 && (
              <p className="text-xs text-muted-foreground">
                불러올 수 있는 지난 수업 기록이 아직 없어요.
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              disabled={exercises.length === 0 || needsTrainerCheck}
              onClick={() => setStep("recommend")}
            >
              오늘의 추천 구성 받기
            </Button>
            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={exercises.length === 0}
              onClick={startFresh}
            >
              직접 만들기
            </Button>
            <p className="text-xs text-muted-foreground">
              {exercises.length === 0
                ? "트레이너와 함께 수업한 운동이 생기면 개인 운동을 기록할 수 있어요."
                : needsTrainerCheck
                  ? "마지막 수업 이후 건강 상태·인바디가 바뀌어서, 트레이너가 확인하기 전에는 추천 구성을 받을 수 없어요."
                  : "트레이너와 함께 해 본 운동만 고를 수 있어요."}
            </p>
          </div>
        )}

        {step === "recommend" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              트레이너와 함께 해 본 운동으로 오늘 구성을 만들어 드려요. 최근
              운동한 부위는 빼고 추천 부위를 미리 골라 뒀어요. 바꿔도 돼요.
            </p>
            {recentCategories.length > 0 && (
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                최근 {recentCategories.join("·")} 운동을 했어요. 오늘은{" "}
                {recommendedCategories.join("·")}를 추천해요.
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {categoryOptions.map((c) => (
                <Button
                  key={c}
                  type="button"
                  size="sm"
                  variant={pickedCategories.includes(c) ? "default" : "outline"}
                  onClick={() =>
                    setPickedCategories((prev) =>
                      prev.includes(c)
                        ? prev.filter((x) => x !== c)
                        : [...prev, c],
                    )
                  }
                >
                  {c}
                </Button>
              ))}
            </div>
            {recommendError && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {recommendError}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep("choose")}
              >
                ← 뒤로
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={pickedCategories.length === 0}
                onClick={buildRecommendation}
              >
                추천 구성 만들기
              </Button>
            </div>
          </div>
        )}

        {step === "pick-session" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              불러올 수업을 골라 주세요. 세트·횟수·무게는 그대로 가져오고,
              이어서 고칠 수 있어요.
            </p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <span className="text-sm text-foreground">
                    {t.date}
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      운동 {t.items.length}개
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => loadTemplate(t)}
                  >
                    불러오기
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStep("choose")}
            >
              ← 뒤로
            </Button>
          </div>
        )}

        {step === "edit" && (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {loadedNotice ??
                  "트레이너와 함께 해 본 운동을 골라 기록해요."}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep("choose")}
              >
                ← 뒤로
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="workout-date">운동한 날짜</Label>
              <Input
                id="workout-date"
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {canPick && (
              <div className="space-y-2">
                <Label htmlFor="exercise-search">① 운동 고르기</Label>
                <Input
                  id="exercise-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="운동 이름 검색 (예: 데드버그)"
                />
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c) => (
                    <Button
                      key={c}
                      type="button"
                      size="sm"
                      variant={category === c ? "default" : "outline"}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </Button>
                  ))}
                </div>
                <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                  {matches.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-muted-foreground">
                      조건에 맞는 운동이 없어요. 트레이너와 함께 해 본 운동 중
                      내 건강 상태에 맞는 운동만 보여드려요.
                    </li>
                  ) : (
                    matches.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <span className="text-sm text-foreground">
                          {e.name_ko ?? e.name_en}
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            {e.category ?? ""}
                          </span>
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => addExercise(e)}
                        >
                          추가
                        </Button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}

            {items.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {canPick ? "② 세트·횟수 입력" : "세트·횟수 확인·수정"}
                </p>
                <ul className="space-y-3">
                  {items.map((item) => {
                    const isDuration = item.exercise.unit_type === "duration";
                    const showWeight = needsWeightInput(
                      item.exercise.equipment,
                    );
                    return (
                      <li
                        key={item.key}
                        className="space-y-2 rounded-lg border border-border p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {item.exercise.name_ko ?? item.exercise.name_en}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setItems((prev) =>
                                prev.filter((i) => i.key !== item.key),
                              )
                            }
                          >
                            빼기
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              세트
                            </Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={30}
                              value={item.sets}
                              onChange={(e) =>
                                update(item.key, { sets: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              {isDuration ? "유지 시간(초)" : "횟수"}
                            </Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              value={item.reps}
                              onChange={(e) =>
                                update(item.key, { reps: e.target.value })
                              }
                            />
                          </div>
                          {showWeight && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">
                                무게(kg)
                              </Label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step="0.5"
                                value={item.weight}
                                onChange={(e) =>
                                  update(item.key, { weight: e.target.value })
                                }
                              />
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="workout-memo">메모 (선택)</Label>
              <Textarea
                id="workout-memo"
                rows={2}
                maxLength={500}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="오늘 몸 상태나 느낌을 간단히 남겨 보세요"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            {saved && (
              <p className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                ✅ 기록했어요. 담당 트레이너도 볼 수 있어요.
              </p>
            )}

            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={pending || items.length === 0}
              onClick={submit}
            >
              {pending
                ? "저장 중..."
                : items.length === 0
                  ? "운동을 추가하면 저장할 수 있어요"
                  : canPick
                    ? "③ 기록 저장"
                    : "기록 저장"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
