import { NextResponse } from "next/server";
import { describeAiError } from "@/lib/ai-error";
import { extractBodyComposition } from "@/lib/body-composition-extract";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { imageBase64, mediaType } = await request.json();

  if (!imageBase64 || (mediaType !== "image/jpeg" && mediaType !== "image/png")) {
    return NextResponse.json(
      { error: "imageBase64와 mediaType(image/jpeg 또는 image/png)이 필요합니다." },
      { status: 400 },
    );
  }

  let result;
  try {
    result = await extractBodyComposition({ imageBase64, mediaType });
  } catch (e) {
    const { message, status } = describeAiError(e, "extract-body-composition");
    return NextResponse.json({ error: message }, { status });
  }

  if (
    !result ||
    (result.weight_kg === null &&
      result.body_fat_mass_kg === null &&
      result.skeletal_muscle_mass_kg === null)
  ) {
    return NextResponse.json(
      { error: "사진에서 인바디 수치를 읽지 못했습니다. 인바디 결과지 사진인지 확인해 주세요." },
      { status: 400 },
    );
  }

  return NextResponse.json(result);
}
