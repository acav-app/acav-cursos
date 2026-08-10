import type { CourseQuestionInput } from "@/lib/courses/schemas";

export type QuestionType = "single_choice" | "multiple_choice" | "true_false" | "short_answer";

export interface AnswerValue {
  single?: string;
  multiple?: string[];
  boolean?: boolean;
  text?: string;
}

export interface GradedQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  correct: boolean;
  score: number;
  maxScore: number;
  points: number;
  explanation?: string;
  correctAnswers: string[];
  userAnswer: AnswerValue;
}

export interface GradedEvaluation {
  questions: GradedQuestion[];
  totalScore: number;
  totalMaxScore: number;
  percentage: number;
  passingPercentage: number;
  passed: boolean;
  correctCount: number;
  totalCount: number;
}

export interface EvaluationRuntimeConfig {
  passingScore?: number;
  defaultPoints?: number;
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveQuestionPoints(question: unknown, defaultPoints: number): number {
  const raw = Number((question as Record<string, any>)?.points || 0);
  return Number.isFinite(raw) && raw > 0 ? raw : defaultPoints;
}

function getDefaultCorrectAnswers(type: QuestionType): string[] {
  if (type === "true_false") return ["true"];
  return [];
}

export function normalizeCorrectAnswers(question: CourseQuestionInput | Record<string, any>): string[] {
  const q = question || {};
  const type = String((q as any).type || "single_choice").trim() || "single_choice";
  const options = Array.isArray((q as any).options)
    ? (q as any).options.map((o: unknown) => String(o || "").trim()).filter(Boolean)
    : [];
  const indexToOptionText = (idx: number): string | null => {
    if (!Number.isFinite(idx) || idx < 0) return null;
    if (!options.length || idx >= options.length) return null;
    const text = String(options[idx] || "").trim();
    return text || null;
  };
  const letterToIndex = (ch: string): number => {
    const c = ch.trim().toLowerCase();
    if (/^[a-z]$/.test(c)) return c.charCodeAt(0) - 97;
    if (/^[1-9]\d*$/.test(c)) return Number(c) - 1;
    return -1;
  };
  const tryResolvePointer = (raw: string): string | null => {
    const candidate = String(raw || "").trim();
    if (!candidate) return null;
    if (/^\d+$/.test(candidate)) {
      const text = indexToOptionText(Number(candidate));
      if (text) return text;
    }
    if (/^[a-z]$/i.test(candidate)) {
      const text = indexToOptionText(letterToIndex(candidate));
      if (text) return text;
    }
    return null;
  };
  const raw = (q as any).correctAnswers;
  if (Array.isArray(raw)) {
    const mapped: string[] = [];
    for (const item of raw) {
      const asString = String(item || "").trim();
      if (!asString) continue;
      const resolved = tryResolvePointer(asString);
      mapped.push(resolved || asString);
    }
    if (mapped.length > 0) return mapped;
  }
  if (typeof raw === "string" && raw.trim()) {
    const split = raw
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (split.length > 0) {
      return split.map((s) => tryResolvePointer(s) || s);
    }
  }
  if (type === "true_false") {
    const legacy = (q as any).correctAnswer;
    if (typeof legacy === "boolean") return [legacy ? "true" : "false"];
    if (typeof legacy === "string" && legacy.trim()) {
      const lower = legacy.trim().toLowerCase();
      return [lower === "verdadero" || lower === "true" || lower === "v" || lower === "1" ? "true" : "false"];
    }
  }
  const legacyField = (q as any).correctAnswer;
  if (typeof legacyField === "string" && legacyField.trim()) {
    const split = legacyField
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (split.length) return split.map((s) => tryResolvePointer(s) || s);
  }
  if (type === "boolean") {
    const idxCorrect = Number(
      Array.isArray(raw) && raw[0] != null
        ? raw[0]
        : (legacyField != null ? String(legacyField) : NaN)
    );
    if (idxCorrect === 0) return ["Verdadero", "true", "verdadero"];
    if (idxCorrect === 1) return ["Falso", "false", "falso"];
  }
  return getDefaultCorrectAnswers(type as QuestionType);
}

export function evaluateSingleChoice(question: Record<string, any>, answer: AnswerValue): boolean {
  const correctRaw = normalizeCorrectAnswers(question)[0];
  if (typeof correctRaw !== "string" || !correctRaw.trim()) return false;
  const correct = normalizeText(correctRaw);
  if (!correct) return false;
  const picked = normalizeText(answer.single);
  if (!picked) return false;
  if (picked === correct) return true;
  const options = Array.isArray(question?.options) ? question.options : [];
  const normalizedOptions = options.map((o) => normalizeText(o)).filter(Boolean);
  if (normalizedOptions.length >= 2 && normalizedOptions.includes(picked) && normalizedOptions.includes(correct)) {
    return picked === correct;
  }
  const overlapRatio = (a: string, b: string): number => {
    if (!a.length || !b.length) return 0;
    const wordsA = new Set(a.split(/\s+/).filter(Boolean));
    const wordsB = new Set(b.split(/\s+/).filter(Boolean));
    if (!wordsA.size || !wordsB.size) return 0;
    let inter = 0;
    wordsA.forEach((w) => {
      if (wordsB.has(w)) inter += 1;
    });
    return Math.max(inter / wordsA.size, inter / wordsB.size);
  };
  return overlapRatio(picked, correct) >= 0.9;
}

export function evaluateMultipleChoice(question: Record<string, any>, answer: AnswerValue): boolean {
  const correctList = normalizeCorrectAnswers(question)
    .map((item) => normalizeText(item))
    .filter(Boolean);
  if (!correctList.length) return false;
  const pickedList = Array.isArray(answer.multiple)
    ? answer.multiple.map((item) => normalizeText(item)).filter(Boolean)
    : [];
  if (pickedList.length !== correctList.length) return false;
  const correctSet = new Set(correctList);
  return pickedList.every((item) => correctSet.has(item));
}

export function evaluateTrueFalse(question: Record<string, any>, answer: AnswerValue): boolean {
  const correctRaw = normalizeCorrectAnswers(question)[0];
  const correct = correctRaw === "true" || correctRaw === "verdadero" || correctRaw === "1";
  if (typeof answer.boolean === "boolean") return answer.boolean === correct;
  if (typeof answer.single === "string" && answer.single.trim()) {
    const lower = answer.single.trim().toLowerCase();
    const val = lower === "true" || lower === "verdadero" || lower === "v" || lower === "1";
    return val === correct;
  }
  return false;
}

export function evaluateShortAnswer(question: Record<string, any>, answer: AnswerValue): boolean {
  const correctOptions = normalizeCorrectAnswers(question).map(normalizeText).filter(Boolean);
  if (!correctOptions.length) return true;
  const candidate = normalizeText(answer.text);
  if (!candidate) return false;
  return correctOptions.some((opt) => {
    if (!opt) return false;
    if (opt === candidate) return true;
    const candidateWords = candidate.split(/\s+/).filter(Boolean);
    const optWords = opt.split(/\s+/).filter(Boolean);
    if (!optWords.length || !candidateWords.length) return false;
    const matches = optWords.filter((w) => candidateWords.includes(w)).length;
    return matches >= Math.ceil(optWords.length * 0.8);
  });
}

export function evaluateQuestion(
  question: CourseQuestionInput | Record<string, any>,
  answer: AnswerValue,
  runtimePoints: number
): GradedQuestion {
  const q = question || {};
  const rawType = (String((q as any).type || "single_choice").trim() || "single_choice");
  const type: QuestionType = rawType === "boolean" ? "true_false" : (rawType as QuestionType);
  const id = String((q as any).id || "");
  const prompt = String((q as any).prompt || (q as any).enunciado || "Pregunta sin título");
  const explanation = (q as any).explanation ? String((q as any).explanation) : undefined;
  const points = resolveQuestionPoints(q, runtimePoints);
  let correct = false;
  switch (type) {
    case "multiple_choice":
      correct = evaluateMultipleChoice(q, answer);
      break;
    case "true_false":
      correct = evaluateTrueFalse(q, answer);
      break;
    case "short_answer":
      correct = evaluateShortAnswer(q, answer);
      break;
    case "single_choice":
    default:
      correct = evaluateSingleChoice(q, answer);
      break;
  }
  const correctAnswers = normalizeCorrectAnswers(q);
  return {
    id,
    type,
    prompt,
    correct,
    score: correct ? points : 0,
    maxScore: points,
    points,
    explanation,
    correctAnswers,
    userAnswer: answer,
  };
}

export function gradeEvaluation(
  questions: Array<CourseQuestionInput | Record<string, any>>,
  answers: Record<string, AnswerValue>,
  config: EvaluationRuntimeConfig = {}
): GradedEvaluation {
  const defaultPoints = Number.isFinite(Number(config.defaultPoints)) && Number(config.defaultPoints) > 0
    ? Number(config.defaultPoints)
    : 1;
  const passingPercentage = Number.isFinite(Number(config.passingScore)) && Number(config.passingScore) > 0
    ? Number(config.passingScore)
    : 60;
  const safeQuestions = Array.isArray(questions) ? questions : [];
  function resolveQuestionStableId(q: unknown, fallbackIndex: number): string {
    const explicit = String((q as Record<string, any>)?.id || "").trim();
    if (explicit) return explicit;
    const rawPrompt = String(
      (q as Record<string, any>)?.prompt || (q as Record<string, any>)?.enunciado || `question_${fallbackIndex + 1}`
    );
    const hashSrc = normalizeText(rawPrompt).replace(/[^a-z0-9]+/g, "-").slice(0, 36);
    return `q_${fallbackIndex + 1}_${hashSrc}`;
  }
  const stableQuestionIds: string[] = safeQuestions.map((q, idx) => resolveQuestionStableId(q, idx));
  const graded = safeQuestions.map((q, idx) => {
    const stableId = stableQuestionIds[idx];
    const answer = answers[stableId] || (answers[String((q as any)?.id || "")] ?? {});
    const result = evaluateQuestion(q, answer, defaultPoints);
    if (!result.id) {
      (result as any).id = stableId;
    }
    return result;
  });
  const totalScore = graded.reduce((sum, item) => sum + item.score, 0);
  const totalMaxScore = graded.reduce((sum, item) => sum + item.maxScore, 0);
  const percentage = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;
  const correctCount = graded.filter((item) => item.correct).length;
  return {
    questions: graded,
    totalScore,
    totalMaxScore,
    percentage,
    passingPercentage,
    passed: percentage >= passingPercentage,
    correctCount,
    totalCount: graded.length,
  };
}

export function emptyAnswerForType(type: QuestionType | string): AnswerValue {
  switch (String(type || "").trim()) {
    case "multiple_choice":
      return { multiple: [] };
    case "true_false":
      return { boolean: undefined };
    case "short_answer":
      return { text: "" };
    case "single_choice":
    default:
      return { single: undefined };
  }
}

export function hasAnswer(answer: AnswerValue | undefined, type: QuestionType | string): boolean {
  if (!answer) return false;
  switch (String(type || "").trim()) {
    case "multiple_choice":
      return Array.isArray(answer.multiple) && answer.multiple.length > 0;
    case "true_false":
      return typeof answer.boolean === "boolean";
    case "short_answer":
      return Boolean(String(answer.text || "").trim());
    case "single_choice":
    default:
      return Boolean(String(answer.single || "").trim());
  }
}
