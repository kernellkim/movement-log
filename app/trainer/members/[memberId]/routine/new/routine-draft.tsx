"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { ROUTINE_CATEGORIES } from "@/lib/assessment";
import type { RoutineDraftItem } from "@/lib/routine-generate";
import type { Exercise } from "@/lib/types";
import { formatSetsReps, needsWeightInput } from "@/lib/format";
import { SessionChecklist, type ChecklistItem } from "../../session-checklist";
import { confirmRoutine } from "./actions";

type DraftItem = RoutineDraftItem & { exercise?: Exercise; key: string };

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function defaultUnitsFor(exercise: Exercise): {
  reps: number | null;
  durationSeconds: number | null;
} {
  return exercise.unit_type === "duration"
    ? { reps: null, durationSeconds: 30 }
    : { reps: 10, durationSeconds: null };
}

export function RoutineDraft({
  memberId,
  assessmentId,
  categories,
}: {
  memberId: string;
  assessmentId: string;
  categories: string[];
}) {
  const [originalDraft, setOriginalDraft] = useState<{
    items: RoutineDraftItem[];
    reasoning: string;
  } | null>(null);
  const [items, setItems] = useState<DraftItem[] | null>(null);
  const [bodyCompositionId, setBodyCompositionId] = useState<string | null>(null);
  const [swappingKey, setSwappingKey] = useState<string | null>(null);
  const [swapCategory, setSwapCategory] = useState("");
  const [swapExercises, setSwapExercises] = useState<Exercise[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [addCategory, setAddCategory] = useState("");
  const [addExercises, setAddExercises] = useState<Exercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [confirmedRoutine, setConfirmedRoutine] = useState<{
    routineId: string;
    items: ChecklistItem[];
  } | null>(null);

  useEffect(() => {
    generateWithAi();

    async function generateWithAi() {
      try {
        const res = await fetch("/api/generate-routine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId, assessmentId, categories }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error ?? "루틴 생성에 실패했습니다.");

        const rawItems: (RoutineDraftItem & { exercise?: Exercise })[] = result.items;
        setBodyCompositionId(result.bodyCompositionId ?? null);
        setWarnings(result.warnings ?? []);
        setOriginalDraft({
          items: rawItems.map(
            ({ exerciseId, sets, reps, durationSeconds, cautionNote, weightKg }) => ({
              exerciseId,
              sets,
              reps,
              durationSeconds,
              cautionNote,
              weightKg,
            }),
          ),
          reasoning: result.reasoning,
        });
        setItems(
          rawItems.map((item, i) => ({ ...item, key: `${item.exerciseId}-${i}` })),
        );
      } catch (e) {
        setError((e as Error).message);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((prev) =>
      prev ? prev.map((it) => (it.key === key ? { ...it, ...patch } : it)) : prev,
    );
  }

  function openSwap(item: DraftItem) {
    if (swappingKey === item.key) {
      closeSwap();
      return;
    }
    setSwappingKey(item.key);
    setSwapCategory("");
    setSwapExercises(null);
  }

  function closeSwap() {
    setSwappingKey(null);
    setSwapCategory("");
    setSwapExercises(null);
  }

  async function handleSwapCategoryChange(category: string) {
    setSwapCategory(category);
    setSwapExercises(null);
    if (!category) return;

    const supabase = createClient();
    const { data } = await supabase
      .from("exercise_library")
      .select("*")
      .eq("category", category)
      .returns<Exercise[]>();
    setSwapExercises(data ?? []);
  }

  function handleSwapSelect(key: string, newExerciseId: string, options: Exercise[]) {
    const newExercise = options.find((c) => c.id === newExerciseId);
    if (!newExercise) return;
    updateItem(key, {
      exerciseId: newExerciseId,
      exercise: newExercise,
      cautionNote: newExercise.default_caution ?? "",
      weightKg: null,
      ...defaultUnitsFor(newExercise),
    });
    closeSwap();
  }

  function handleDelete(key: string) {
    setItems((prev) => (prev ? prev.filter((it) => it.key !== key) : prev));
  }

  async function handleAddCategoryChange(category: string) {
    setAddCategory(category);
    setAddExercises(null);
    if (!category) return;

    const supabase = createClient();
    const { data } = await supabase
      .from("exercise_library")
      .select("*")
      .eq("category", category)
      .returns<Exercise[]>();
    setAddExercises(data ?? []);
  }

  function handleAddExercise(exerciseId: string) {
    const exercise = (addExercises ?? []).find((c) => c.id === exerciseId);
    if (!exercise) return;

    const newItem: DraftItem = {
      key: `${exercise.id}-${Date.now()}`,
      exerciseId: exercise.id,
      exercise,
      sets: 3,
      cautionNote: exercise.default_caution ?? "",
      weightKg: null,
      ...defaultUnitsFor(exercise),
    };
    setItems((prev) => (prev ? [...prev, newItem] : prev));
    setAdding(false);
    setAddCategory("");
    setAddExercises(null);
  }

  async function handleConfirm() {
    if (!items || !originalDraft) return;
    setConfirming(true);
    setError(null);

    const result = await confirmRoutine({
      memberId,
      assessmentId,
      categories,
      finalItems: items.map(
        ({ exerciseId, sets, reps, durationSeconds, cautionNote, weightKg }) => ({
          exerciseId,
          sets,
          reps,
          durationSeconds,
          cautionNote,
          weightKg,
        }),
      ),
      aiSnapshot: originalDraft,
      bodyCompositionId,
    });

    if (!result.ok) {
      setConfirming(false);
      setError(result.error ?? "루틴 확정에 실패했습니다.");
      return;
    }

    setConfirmedRoutine({
      routineId: result.routineId,
      items: items.map((it, i) => ({
        id: result.itemIds[i],
        exerciseId: it.exerciseId,
        exercise: it.exercise ?? null,
        sets: it.sets,
        reps: it.reps,
        durationSeconds: it.durationSeconds,
        cautionNote: it.cautionNote,
        weightKg: it.weightKg,
      })),
    });
  }

  if (confirmedRoutine) {
    return (
      <SessionChecklist
        memberId={memberId}
        routineId={confirmedRoutine.routineId}
        items={confirmedRoutine.items}
        justConfirmed
        latestAssessmentId={assessmentId}
      />
    );
  }

  if (error && !items) {
    return (
      <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (!items) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        AI가 루틴을 구성하는 중...
      </div>
    );
  }

  const usedExerciseIds = new Set(items.map((it) => it.exerciseId));
  const addableExercises = (addExercises ?? []).filter(
    (c) => !usedExerciseIds.has(c.id),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Badge variant="outline">초안 - 아직 저장되지 않음</Badge>
      </div>

      {originalDraft?.reasoning && (
        <p className="text-sm text-muted-foreground">{originalDraft.reasoning}</p>
      )}

      {warnings.length > 0 && (
        <div className="space-y-1 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => {
          const swapOptions = (swapExercises ?? []).filter(
            (c) => c.id === item.exerciseId || !usedExerciseIds.has(c.id),
          );

          return (
            <Card key={item.key}>
              <CardHeader>
                <CardTitle>
                  {item.exercise?.name_ko ?? item.exercise?.name_en ?? "알 수 없는 운동"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {formatSetsReps(item.sets, item.reps, item.durationSeconds, item.weightKg)}
                </p>

                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">세트</label>
                    <Input
                      type="number"
                      min={1}
                      value={item.sets}
                      onChange={(e) =>
                        updateItem(item.key, { sets: Number(e.target.value) || 1 })
                      }
                      className="w-16"
                    />
                  </div>

                  {needsWeightInput(item.exercise?.equipment) && (
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">무게(kg)</label>
                      <Input
                        type="number"
                        min={0}
                        step="0.5"
                        value={item.weightKg ?? ""}
                        onChange={(e) =>
                          updateItem(item.key, {
                            weightKg: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="w-20"
                      />
                    </div>
                  )}

                  {item.durationSeconds != null ? (
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        유지 시간(초)
                      </label>
                      <Input
                        type="number"
                        min={1}
                        value={item.durationSeconds}
                        onChange={(e) =>
                          updateItem(item.key, {
                            durationSeconds: Number(e.target.value) || 1,
                          })
                        }
                        className="w-20"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">횟수</label>
                      <Input
                        type="number"
                        min={1}
                        value={item.reps ?? 1}
                        onChange={(e) =>
                          updateItem(item.key, { reps: Number(e.target.value) || 1 })
                        }
                        className="w-20"
                      />
                    </div>
                  )}
                </div>

                {needsWeightInput(item.exercise?.equipment) && item.weightKg == null && (
                  <p className="text-xs text-destructive/70">⚠️ 무게가 입력되지 않았습니다</p>
                )}

                {item.cautionNote && (
                  <p className="text-xs text-muted-foreground">
                    주의: {item.cautionNote}
                  </p>
                )}

                {swappingKey === item.key ? (
                  <div className="space-y-2">
                    <select
                      autoFocus
                      value={swapCategory}
                      onChange={(e) => handleSwapCategoryChange(e.target.value)}
                      className={selectClass}
                    >
                      <option value="" disabled>
                        카테고리
                      </option>
                      {ROUTINE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>

                    {swapCategory &&
                      (swapExercises === null ? (
                        <p className="text-xs text-muted-foreground">불러오는 중...</p>
                      ) : swapOptions.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          선택할 수 있는 운동이 없습니다.
                        </p>
                      ) : (
                        <select
                          value=""
                          onChange={(e) =>
                            handleSwapSelect(item.key, e.target.value, swapOptions)
                          }
                          className={selectClass}
                        >
                          <option value="" disabled>
                            운동 선택
                          </option>
                          {swapOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name_ko ?? c.name_en}
                            </option>
                          ))}
                        </select>
                      ))}

                    <div>
                      <Button type="button" variant="outline" size="sm" onClick={closeSwap}>
                        취소
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openSwap(item)}
                    >
                      다른 운동으로 교체
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(item.key)}
                    >
                      삭제
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="space-y-3">
          {!adding ? (
            <Button type="button" variant="outline" onClick={() => setAdding(true)}>
              운동 추가
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">카테고리</label>
                <select
                  value={addCategory}
                  onChange={(e) => handleAddCategoryChange(e.target.value)}
                  className={selectClass}
                >
                  <option value="" disabled>
                    선택
                  </option>
                  {ROUTINE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {addCategory &&
                (addExercises === null ? (
                  <p className="text-xs text-muted-foreground">불러오는 중...</p>
                ) : addableExercises.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    추가할 수 있는 운동이 없습니다.
                  </p>
                ) : (
                  <select
                    value=""
                    onChange={(e) => handleAddExercise(e.target.value)}
                    className={selectClass}
                  >
                    <option value="" disabled>
                      운동 선택
                    </option>
                    {addableExercises.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name_ko ?? c.name_en}
                      </option>
                    ))}
                  </select>
                ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setAdding(false);
                  setAddCategory("");
                  setAddExercises(null);
                }}
              >
                취소
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        size="lg"
        className="w-full"
        disabled={confirming || items.length === 0}
        onClick={handleConfirm}
      >
        {confirming ? "저장 중..." : "이 루틴으로 진행"}
      </Button>
    </div>
  );
}
