"use client";

import { useRef, useState } from "react";
import { FileImage } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function BodyCompositionForm({
  action,
  today,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  today: string;
  submitLabel: string;
}) {
  const [measuredAt, setMeasuredAt] = useState(today);
  const [weightKg, setWeightKg] = useState("");
  const [bodyFatMassKg, setBodyFatMassKg] = useState("");
  const [skeletalMuscleMassKg, setSkeletalMuscleMassKg] = useState("");
  const [bodyFatPercentage, setBodyFatPercentage] = useState("");
  const [basalMetabolicRateKcal, setBasalMetabolicRateKcal] = useState("");
  const [aiFilled, setAiFilled] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isConvertingHeic, setIsConvertingHeic] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setSelectedFileName(file.name);

    if (file.size > MAX_FILE_SIZE) {
      setExtractError("파일 크기가 너무 큽니다. 10MB 이하 사진을 올려주세요.");
      return;
    }
    const isHeic =
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      /\.(heic|heif)$/i.test(file.name);
    if (!isHeic && file.type !== "image/jpeg" && file.type !== "image/png") {
      setExtractError("JPEG, PNG, HEIC 사진만 업로드할 수 있습니다.");
      return;
    }

    setExtractError(null);
    setIsExtracting(true);
    try {
      let fileForApi: Blob = file;
      let mediaType: "image/jpeg" | "image/png" = file.type === "image/png" ? "image/png" : "image/jpeg";

      if (isHeic) {
        setIsConvertingHeic(true);
        try {
          const heic2any = (await import("heic2any")).default;
          const converted = await heic2any({ blob: file, toType: "image/jpeg" });
          fileForApi = Array.isArray(converted) ? converted[0] : converted;
          mediaType = "image/jpeg";
        } catch {
          setExtractError(
            "이 사진 형식은 지원하지 않아요. 아이폰이면 카메라 설정에서 포맷을 '높은 호환성'으로 바꾸거나, 스크린샷으로 찍어서 올려주세요.",
          );
          return;
        } finally {
          setIsConvertingHeic(false);
        }
      }

      // Vercel의 4.5MB 요청 본문 제한을 넘지 않도록, base64 인코딩 전에 긴 변을
      // 2000px로 축소한다. HEIC->JPEG 변환 결과가 원본보다 커지는 경우가 있어
      // HEIC 여부와 상관없이 모든 사진에 적용한다.
      let bitmap: ImageBitmap | undefined;
      try {
        bitmap = await createImageBitmap(fileForApi);
        const longestEdge = Math.max(bitmap.width, bitmap.height);
        if (longestEdge > 2000) {
          const scale = 2000 / longestEdge;
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(bitmap.width * scale);
          canvas.height = Math.round(bitmap.height * scale);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const resizedBlob = await new Promise<Blob | null>((resolve) =>
              canvas.toBlob(resolve, "image/jpeg", 0.85),
            );
            if (resizedBlob) {
              fileForApi = resizedBlob;
              mediaType = "image/jpeg";
            }
          }
        }
      } catch {
        // 리사이즈 실패 시 원본 fileForApi 그대로 업로드를 진행한다.
      } finally {
        bitmap?.close();
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(fileForApi);
      });
      const imageBase64 = dataUrl.split(",")[1] ?? "";

      const res = await fetch("/api/extract-body-composition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mediaType }),
      });
      const data = await res.json();

      if (!res.ok) {
        setExtractError(data.error ?? "사진에서 값을 읽지 못했습니다.");
        return;
      }

      const fillIfPresent = (value: unknown, setter: (v: string) => void) => {
        if (value !== null && value !== undefined) setter(String(value));
      };
      if (data.measured_at) setMeasuredAt(data.measured_at);
      fillIfPresent(data.weight_kg, setWeightKg);
      fillIfPresent(data.body_fat_mass_kg, setBodyFatMassKg);
      fillIfPresent(data.skeletal_muscle_mass_kg, setSkeletalMuscleMassKg);
      fillIfPresent(data.body_fat_percentage, setBodyFatPercentage);
      fillIfPresent(data.basal_metabolic_rate_kcal, setBasalMetabolicRateKcal);
      setAiFilled(true);
    } catch {
      setExtractError("사진에서 값을 읽지 못했습니다.");
    } finally {
      setIsExtracting(false);
    }
  }

  return (
    <form action={action} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>인바디 사진으로 자동 입력</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif"
            disabled={isExtracting}
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={isExtracting}
              onClick={() => fileInputRef.current?.click()}
            >
              {isConvertingHeic ? "변환 중..." : isExtracting ? "분석 중..." : "사진 선택"}
            </Button>
            {selectedFileName ? (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <FileImage className="size-4" />
                {selectedFileName}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground/60">선택된 파일 없음</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            표가 화면에 꽉 차도록 가까이서, 정면으로, 빛 반사 없이 촬영해주세요
          </p>
          {isExtracting && (
            <p className="text-sm text-muted-foreground">
              {isConvertingHeic ? "HEIC 변환 중..." : "사진에서 값을 읽는 중..."}
            </p>
          )}
          {extractError && <p className="text-sm text-destructive">{extractError}</p>}
          {aiFilled && !isExtracting && (
            <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-300">
              AI가 사진에서 읽은 값이에요. 저장 전에 꼭 확인해 주세요.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>측정값 입력</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="measured_at">측정일</Label>
            <Input
              id="measured_at"
              name="measured_at"
              type="date"
              required
              value={measuredAt}
              onChange={(e) => setMeasuredAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="weight_kg">체중(kg)</Label>
            <Input
              id="weight_kg"
              name="weight_kg"
              type="number"
              step="0.1"
              min="0"
              required
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skeletal_muscle_mass_kg">골격근량(kg)</Label>
            <Input
              id="skeletal_muscle_mass_kg"
              name="skeletal_muscle_mass_kg"
              type="number"
              step="0.1"
              min="0"
              required
              value={skeletalMuscleMassKg}
              onChange={(e) => setSkeletalMuscleMassKg(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="body_fat_mass_kg">체지방량(kg)</Label>
            <Input
              id="body_fat_mass_kg"
              name="body_fat_mass_kg"
              type="number"
              step="0.1"
              min="0"
              required
              value={bodyFatMassKg}
              onChange={(e) => setBodyFatMassKg(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="body_fat_percentage">체지방률(%)</Label>
            <Input
              id="body_fat_percentage"
              name="body_fat_percentage"
              type="number"
              step="0.1"
              min="0"
              value={bodyFatPercentage}
              onChange={(e) => setBodyFatPercentage(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="basal_metabolic_rate_kcal">기초대사량(kcal)</Label>
            <Input
              id="basal_metabolic_rate_kcal"
              name="basal_metabolic_rate_kcal"
              type="number"
              step="1"
              min="0"
              value={basalMetabolicRateKcal}
              onChange={(e) => setBasalMetabolicRateKcal(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" size="lg" className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
}
