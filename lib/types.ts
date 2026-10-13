export type RiskLevel = "low" | "mid" | "high";

export type Member = {
  id: string;
  trainer_id: string | null;
  user_id: string | null;
  name: string | null;
  birth_date: string | null;
  gender: string | null;
  password_set_at: string | null;
  deletion_requested_at: string | null;
};

export type ParqAnswer = {
  id: number;
  answer: boolean; // true = 예(yes)
};

export type Questionnaire = {
  id: string;
  member_id: string;
  parq_answers: ParqAnswer[];
  injury_history: string | null;
  surgery_history: string | null;
  chronic_condition: string | null;
  risk_level: RiskLevel | null;
  is_latest: boolean;
  created_at: string;
};

export type HealthUpdate = {
  id: string;
  member_id: string;
  note: string;
  created_at: string;
};

export type BodyComposition = {
  id: string;
  member_id: string;
  measured_at: string;
  weight_kg: number | null;
  body_fat_mass_kg: number | null;
  skeletal_muscle_mass_kg: number | null;
  body_fat_percentage: number | null;
  basal_metabolic_rate_kcal: number | null;
  is_latest: boolean;
  created_at: string;
};

export type RecommendedItems = {
  items: string[];
  reasoning: string;
};

export type Assessment = {
  id: string;
  member_id: string;
  questionnaire_id: string | null;
  recommended_items: RecommendedItems | null;
  created_at: string;
};

export type AssessmentResultRow = {
  id: string;
  assessment_id: string;
  item_name: string;
  result: string | null;
  trainer_note: string | null;
};

export type Exercise = {
  id: string;
  name_en: string;
  name_ko: string | null;
  category: string | null;
  equipment: string | null;
  video_url: string | null;
  image_url: string | null;
  default_caution: string | null;
  unit_type: "reps" | "duration";
  high_impact: boolean;
};

export type Routine = {
  id: string;
  member_id: string;
  assessment_id: string | null;
  body_composition_id: string | null;
  target_categories: string[] | null;
  status: "active" | "archived";
  ai_snapshot: unknown;
  created_at: string;
  name: string | null;
  is_pinned: boolean;
};

export type RoutineItem = {
  id: string;
  routine_id: string;
  exercise_id: string | null;
  sets: number | null;
  reps: number | null;
  caution_note: string | null;
  sort_order: number | null;
  duration_seconds: number | null;
  weight_kg: number | null;
};

export type SessionLog = {
  id: string;
  member_id: string;
  routine_id: string | null;
  session_date: string;
  free_memo: string | null;
  created_at: string;
};

export type SessionLogItem = {
  id: string;
  session_log_id: string;
  routine_item_id: string | null;
  checked: boolean;
  exercise_id: string | null;
  sets: number | null;
  reps: number | null;
  duration_seconds: number | null;
  weight_kg: number | null;
};

export type ConsentType = "terms_privacy" | "sensitive_health";

export type ConsentRecord = {
  id: string;
  member_id: string;
  consent_type: ConsentType;
  version: string;
  consented_at: string;
};
