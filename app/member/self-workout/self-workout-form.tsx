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

export function SelfWorkoutForm({
  exercises,
  today,
}: {
  exercises: Exercise[];
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

  const categories = useMemo(
    () => [
      "전체",
      ...Array.from(
        new Set(exercises.map((e) => e.category).filter(Boolean) as string[]),
      ),
    ],
    [exercises],
  );

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
                조건에 맞는 운동이 없어요. 내 건강 상태에 맞는 안전한 운동만
                보여드려요.
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

        {items.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              ② 세트·횟수 입력
            </p>
            <ul className="space-y-3">
              {items.map((item) => {
                const isDuration = item.exercise.unit_type === "duration";
                const showWeight = needsWeightInput(item.exercise.equipment);
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
              : "③ 기록 저장"}
        </Button>
      </CardContent>
    </Card>
  );
}
