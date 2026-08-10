// @ts-nocheck
"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Circle, ClipboardCheck, FileQuestion, RotateCcw, Send, Sparkles, Trophy, XCircle, HelpCircle } from "lucide-react";
import type { CourseQuestionInput } from "@/lib/courses/schemas";
import {
  gradeEvaluation,
  emptyAnswerForType,
  hasAnswer,
  normalizeCorrectAnswers,
  type AnswerValue,
  type GradedEvaluation,
  type QuestionType,
} from "@/lib/courses/evaluation-engine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type RadixSide = "top" | "right" | "bottom" | "left";

function normalizeKey(str: unknown): string {
  return String(str || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function optionMatches(expectedList: string[], candidate: string): boolean {
  const norm = normalizeKey(candidate);
  if (!norm) return false;
  return expectedList.some((raw) => {
    const item = normalizeKey(raw);
    return item === norm || item.includes(norm) || norm.includes(item);
  });
}

interface EvaluationRendererProps {
  questions: CourseQuestionInput[] | Record<string, any>[];
  title?: string;
  description?: string;
  passingScore?: number;
  maxAttempts?: number;
  attemptsUsed?: number;
  defaultPoints?: number;
  onSubmit: (result: GradedEvaluation) => Promise<void> | void;
  disabled?: boolean;
  compact?: boolean;
  previousResult?: GradedEvaluation | null;
}

function questionTypeLabel(type: QuestionType | string): string {
  switch (String(type || "").trim()) {
    case "multiple_choice":
      return "Selección múltiple";
    case "true_false":
    case "boolean":
      return "Verdadero / Falso";
    case "short_answer":
      return "Respuesta corta";
    case "single_choice":
    default:
      return "Opción simple";
  }
}

function normalizeQuestionType(type: QuestionType | string): QuestionType {
  const raw = String(type || "").trim();
  if (raw === "boolean") return "true_false";
  if (raw === "multiple_choice" || raw === "single_choice" || raw === "short_answer" || raw === "true_false") return raw;
  return "single_choice";
}

export default function EvaluationRenderer({
  questions,
  title,
  description,
  passingScore,
  maxAttempts,
  attemptsUsed = 0,
  defaultPoints = 1,
  onSubmit,
  disabled = false,
  compact = false,
  previousResult = null,
}: EvaluationRendererProps) {
  const safeQuestions = useMemo(() => (Array.isArray(questions) ? questions : []), [questions]);
  const qidFor = useMemo(() => {
    const map = new WeakMap<Record<string, any>, string>();
    return (q: Record<string, any>, idx: number): string => {
      const cached = map.get(q);
      if (cached) return cached;
      const explicit = String((q as any)?.id || "").trim();
      const next = explicit || `q_${idx + 1}_${normalizeKey((q as any)?.prompt || (q as any)?.enunciado || "sintitulo").slice(0, 24)}`;
      map.set(q, next);
      return next;
    };
  }, []);
  const configuredPassing = Number.isFinite(Number(passingScore)) && Number(passingScore) > 0
    ? Number(passingScore)
    : 60;

  const initialAnswers = useMemo(() => {
    const map: Record<string, AnswerValue> = {};
    safeQuestions.forEach((q, idx) => {
      const id = qidFor(q as any, idx);
      map[id] = emptyAnswerForType(normalizeQuestionType(String((q as any)?.type || "single_choice")));
    });
    return map;
  }, [safeQuestions, qidFor]);

  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(initialAnswers);
  const [reviewMode, setReviewMode] = useState(false);
  const [lastResult, setLastResult] = useState<GradedEvaluation | null>(previousResult);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answeredCount = useMemo(() => {
    return safeQuestions.filter((q, idx) => {
      const id = qidFor(q as any, idx);
      return hasAnswer(answers[id], normalizeQuestionType(String((q as any)?.type || "single_choice")));
    }).length;
  }, [answers, safeQuestions, qidFor]);

  const remainingAttempts = useMemo(() => {
    if (!maxAttempts) return Infinity;
    return Math.max(0, maxAttempts - attemptsUsed);
  }, [maxAttempts, attemptsUsed]);

  const canSubmit =
    !disabled &&
    !submitting &&
    answeredCount > 0 &&
    (remainingAttempts === Infinity || remainingAttempts > 0);

  function updateAnswer(questionId: string, patch: Partial<AnswerValue>) {
    if (reviewMode || submitting) return;
    setAnswers((current) => {
      const base = current[questionId] || emptyAnswerForType("single_choice");
      return { ...current, [questionId]: { ...base, ...patch } };
    });
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const questionsWithStableId = safeQuestions.map((q, idx) => {
        const stable = qidFor(q as any, idx);
        const origId = String((q as any)?.id || "").trim();
        if (origId && origId === stable) return q;
        return { ...(q as any), id: stable };
      });
      const result = gradeEvaluation(questionsWithStableId, answers, {
        passingScore: configuredPassing,
        defaultPoints,
      });
      await onSubmit(result);
      setLastResult(result);
      setReviewMode(true);
    } catch (err: any) {
      setError(err?.message || "No pudimos procesar tu entrega.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    if (submitting) return;
    setAnswers(initialAnswers);
    setReviewMode(false);
    setLastResult(previousResult || null);
    setError(null);
  }

  function renderSingleChoice(q: Record<string, any>, idx: number) {
    const qid = qidFor(q, idx);
    const options = Array.isArray(q.options) ? q.options : [];
    const answer = answers[qid];
    const selected = answer?.single;
    const correctAnswers = reviewMode || lastResult ? normalizeCorrectAnswers(q) : [];
    return (
      <RadioGroup
        value={selected || ""}
        onValueChange={(value) => updateAnswer(qid, { single: value })}
        disabled={disabled || reviewMode}
        className="w-full min-w-0 space-y-2"
      >
        {options.map((opt: string, optIdx: number) => {
          const optVal = String(opt || "");
          const isCorrect = optionMatches(correctAnswers, optVal);
          const isSelected = selected === optVal;
          return (
            <div
              key={`${qid}_${optIdx}_${optVal}`}
              className={cn(
                "w-full min-w-0 flex items-start gap-3 rounded-2xl border px-3 py-2.5 transition",
                reviewMode
                  ? isCorrect
                    ? "border-emerald-200 bg-emerald-50"
                    : isSelected
                    ? "border-rose-200 bg-rose-50"
                    : "border-slate-200 bg-white"
                  : isSelected
                  ? "border-violet-300 bg-violet-50/70"
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}
            >
              <RadioGroupItem value={optVal} id={`${qid}_opt_${optIdx}`} className="mt-0.5 shrink-0" />
              <Label
                htmlFor={`${qid}_opt_${optIdx}`}
                className="min-w-0 flex-1 break-words text-sm leading-6 text-slate-800"
              >
                <span className="min-w-0 break-words">{optVal}</span>
                {reviewMode && isCorrect ? (
                  <Badge variant="soft" color="success" className="ml-2 mt-1 inline-flex rounded-full align-middle shrink-0">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Correcta
                  </Badge>
                ) : null}
                {reviewMode && isSelected && !isCorrect ? (
                  <Badge variant="soft" color="destructive" className="ml-2 mt-1 inline-flex rounded-full align-middle shrink-0">
                    <XCircle className="mr-1 h-3 w-3" /> Tu respuesta
                  </Badge>
                ) : null}
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    );
  }

  function renderMultipleChoice(q: Record<string, any>, idx: number) {
    const qid = qidFor(q, idx);
    const options = Array.isArray(q.options) ? q.options : [];
    const answer = answers[qid];
    const picked = Array.isArray(answer?.multiple) ? answer.multiple : [];
    const correctAnswers = reviewMode || lastResult ? normalizeCorrectAnswers(q) : [];
    return (
      <div className="w-full min-w-0 space-y-2">
        {options.map((opt: string, optIdx: number) => {
          const optVal = String(opt || "");
          const isSelected = picked.includes(optVal);
          const isCorrect = optionMatches(correctAnswers, optVal);
          return (
            <div
              key={`${qid}_${optIdx}_${optVal}`}
              className={cn(
                "w-full min-w-0 flex items-start gap-3 rounded-2xl border px-3 py-2.5 transition",
                reviewMode
                  ? isCorrect
                    ? "border-emerald-200 bg-emerald-50"
                    : isSelected
                    ? "border-rose-200 bg-rose-50"
                    : "border-slate-200 bg-white"
                  : isSelected
                  ? "border-violet-300 bg-violet-50/70"
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}
            >
              <Checkbox
                id={`${qid}_mopt_${optIdx}`}
                checked={isSelected}
                disabled={disabled || reviewMode}
                onCheckedChange={(checked) => {
                  const next = checked
                    ? [...picked, optVal]
                    : picked.filter((p) => p !== optVal);
                  updateAnswer(qid, { multiple: next });
                }}
                className="mt-0.5 shrink-0"
              />
              <Label
                htmlFor={`${qid}_mopt_${optIdx}`}
                className="min-w-0 flex-1 break-words text-sm leading-6 text-slate-800"
              >
                <span className="min-w-0 break-words">{optVal}</span>
                {reviewMode && isCorrect ? (
                  <Badge variant="soft" color="success" className="ml-2 mt-1 inline-flex rounded-full align-middle shrink-0">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Correcta
                  </Badge>
                ) : null}
                {reviewMode && isSelected && !isCorrect ? (
                  <Badge variant="soft" color="destructive" className="ml-2 mt-1 inline-flex rounded-full align-middle shrink-0">
                    <XCircle className="mr-1 h-3 w-3" /> Incorrecta
                  </Badge>
                ) : null}
              </Label>
            </div>
          );
        })}
      </div>
    );
  }

  function renderTrueFalse(q: Record<string, any>, idx: number) {
    const qid = qidFor(q, idx);
    const answer = answers[qid];
    const correctAnswers = reviewMode || lastResult ? normalizeCorrectAnswers(q) : [];
    const selectedVal = typeof answer?.boolean === "boolean" ? answer.boolean : undefined;
    const correctRaw = correctAnswers[0];
    const correct = correctRaw === "true" || correctRaw === "verdadero" || correctRaw === "1";
    return (
      <div className={cn("w-full min-w-0 grid gap-2", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
        <div
          className={cn(
            "w-full min-w-0 flex flex-wrap items-start justify-between gap-2 rounded-2xl border px-4 py-3 transition",
            reviewMode
              ? correct === true
                ? "border-emerald-200 bg-emerald-50"
                : selectedVal === true
                ? "border-rose-200 bg-rose-50"
                : "border-slate-200 bg-white"
              : selectedVal === true
              ? "border-violet-300 bg-violet-50/70"
              : "border-slate-200 bg-white hover:border-slate-300"
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Switch
              id={`${qid}_tf_true`}
              checked={selectedVal === true}
              disabled={disabled || reviewMode}
              onCheckedChange={(checked) => {
                if (checked) updateAnswer(qid, { boolean: true });
              }}
              className="shrink-0"
            />
            <Label
              htmlFor={`${qid}_tf_true`}
              className="min-w-0 flex-1 break-words text-sm font-medium text-slate-900"
            >
              Verdadero
            </Label>
          </div>
          {reviewMode && correct === true ? (
            <Badge variant="soft" color="success" className="rounded-full shrink-0">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Correcta
            </Badge>
          ) : reviewMode && selectedVal === true && correct !== true ? (
            <Badge variant="soft" color="destructive" className="rounded-full shrink-0">
              <XCircle className="mr-1 h-3 w-3" /> Tu respuesta
            </Badge>
          ) : null}
        </div>
        <div
          className={cn(
            "w-full min-w-0 flex flex-wrap items-start justify-between gap-2 rounded-2xl border px-4 py-3 transition",
            reviewMode
              ? correct === false
                ? "border-emerald-200 bg-emerald-50"
                : selectedVal === false
                ? "border-rose-200 bg-rose-50"
                : "border-slate-200 bg-white"
              : selectedVal === false
              ? "border-violet-300 bg-violet-50/70"
              : "border-slate-200 bg-white hover:border-slate-300"
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Switch
              id={`${qid}_tf_false`}
              checked={selectedVal === false}
              disabled={disabled || reviewMode}
              onCheckedChange={(checked) => {
                if (checked) updateAnswer(qid, { boolean: false });
              }}
              className="shrink-0"
            />
            <Label
              htmlFor={`${qid}_tf_false`}
              className="min-w-0 flex-1 break-words text-sm font-medium text-slate-900"
            >
              Falso
            </Label>
          </div>
          {reviewMode && correct === false ? (
            <Badge variant="soft" color="success" className="rounded-full shrink-0">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Correcta
            </Badge>
          ) : reviewMode && selectedVal === false && correct !== false ? (
            <Badge variant="soft" color="destructive" className="rounded-full shrink-0">
              <XCircle className="mr-1 h-3 w-3" /> Tu respuesta
            </Badge>
          ) : null}
        </div>
      </div>
    );
  }

  function renderShortAnswer(q: Record<string, any>, idx: number) {
    const qid = qidFor(q, idx);
    const answer = answers[qid];
    const correctAnswers = reviewMode || lastResult ? normalizeCorrectAnswers(q) : [];
    return (
      <div className="w-full min-w-0 space-y-2">
        <Textarea
          rows={compact ? 3 : 4}
          value={answer?.text || ""}
          onChange={(e) => updateAnswer(qid, { text: e.target.value })}
          disabled={disabled || reviewMode}
          placeholder="Escribí tu respuesta..."
          className="w-full min-w-0 rounded-2xl border-slate-200"
        />
        {reviewMode && correctAnswers.length ? (
          <div className="w-full min-w-0 space-y-1 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-6 text-emerald-800">
            <div className="font-semibold text-emerald-900">Respuesta esperada:</div>
            <ul className="ml-4 list-disc break-words">
              {correctAnswers.map((ans, i) => (
                <li key={`${qid}_ans_${i}`} className="break-words">{ans}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  function renderQuestion(q: Record<string, any>, idx: number) {
    const type = normalizeQuestionType(String((q as any)?.type || "single_choice").trim() || "single_choice");
    const questionId = qidFor(q as any, idx);
    const points = Number.isFinite(Number((q as any)?.points)) && Number((q as any)?.points) > 0
      ? Number((q as any)?.points)
      : Number.isFinite(Number(defaultPoints))
      ? Number(defaultPoints)
      : 1;
    const answered = hasAnswer(answers[questionId], type);
    let rendered: React.ReactNode = null;
    switch (type) {
      case "multiple_choice":
        rendered = renderMultipleChoice(q as any, idx);
        break;
      case "true_false":
        rendered = renderTrueFalse(q as any, idx);
        break;
      case "short_answer":
        rendered = renderShortAnswer(q as any, idx);
        break;
      case "single_choice":
      default:
        rendered = renderSingleChoice(q as any, idx);
        break;
    }
    const gradedQ = lastResult?.questions?.find(
      (gq) =>
        String(gq.id || "") === String(questionId || "") ||
        String(gq.id || "") === String((q as any).id || "")
    );
    const stateBadge = reviewMode ? (
      gradedQ?.correct === true ? (
        <Badge variant="soft" color="success" className="rounded-full break-words shrink-0">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Correcta · {gradedQ.score}/{gradedQ.maxScore}
        </Badge>
      ) : (
        <Badge variant="soft" color="destructive" className="rounded-full break-words shrink-0">
          <XCircle className="mr-1 h-3 w-3" />
          Incorrecta · 0/{gradedQ?.maxScore ?? points}
        </Badge>
      )
    ) : answered ? (
      <Badge variant="soft" color="info" className="rounded-full break-words shrink-0">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Respondida
      </Badge>
    ) : (
      <Badge variant="soft" color="default" className="rounded-full break-words shrink-0">
        <Circle className="mr-1 h-3 w-3" /> Pendiente
      </Badge>
    );
    return (
      <Card
        key={`card_${questionId}_${idx}`}
        className={cn(
          "w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200",
          compact ? "p-3.5" : "p-4 sm:p-5",
          !compact && "shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
        )}
      >
        <div className="flex w-full flex-col gap-3 items-start justify-between sm:flex-row sm:flex-wrap sm:items-start">
          <div className="min-w-0 flex-1 w-full sm:w-auto">
            <div className="flex w-full flex-wrap items-center gap-1.5">
              <Badge variant="soft" color="secondary" className="rounded-full break-words shrink-0">
                Pregunta {idx + 1}
              </Badge>
              <Badge variant="outline" className="rounded-full break-words shrink-0">
                {questionTypeLabel(type)}
              </Badge>
              <Badge variant="soft" color="warning" className="rounded-full break-words shrink-0">
                {points} punto{points === 1 ? "" : "s"}
              </Badge>
              {stateBadge}
            </div>
            <h3 className="mt-3 text-base font-semibold leading-7 text-slate-950 break-words">
              {(q as any)?.prompt || (q as any)?.enunciado || `Pregunta ${idx + 1}`}
            </h3>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="w-full sm:w-auto shrink-0 sm:shrink-0">
                <Badge variant="ghost" className="cursor-help rounded-full break-words w-full sm:w-auto">
                  <HelpCircle className="mr-1 h-3 w-3 shrink-0" />
                  {maxAttempts ? `Intentos ${attemptsUsed + (reviewMode ? 1 : 0)}/${maxAttempts}` : "Sin límite"}
                </Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent side={"top" as RadixSide}>
              <div className="max-w-[230px] text-[11px] leading-5 break-words">
                Elegí la opción correcta y presioná Enviar para calificar.
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="mt-4 w-full min-w-0">{rendered}</div>
        {(q as any)?.explanation && reviewMode ? (
          <div className="mt-4 w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600">
            <span className="font-semibold text-slate-800">Explicación: </span>
            <span className="break-words">{(q as any).explanation}</span>
          </div>
        ) : null}
      </Card>
    );
  }

  const resultSummary = lastResult || (reviewMode ? gradeEvaluation(safeQuestions.map((q, idx) => {
    const stable = qidFor(q as any, idx);
    const origId = String((q as any)?.id || "").trim();
    return (origId && origId === stable) ? q : { ...(q as any), id: stable };
  }), answers, {
    passingScore: configuredPassing,
    defaultPoints,
  }) : null);

  const cardPad = compact ? "px-3 py-3 sm:px-4 sm:py-3.5" : "px-4 py-3";
  const titleSize = compact ? "text-sm md:text-base" : "text-base md:text-lg";
  const questionPadY = compact ? "space-y-3 md:space-y-3" : "space-y-3 md:space-y-5";
  const headerBadgeGap = compact ? "gap-1.5" : "gap-2";

  return (
    <div className={cn("w-full min-w-0 space-y-4 break-words", questionPadY)}>
      <div className="w-full min-w-0 flex flex-col gap-3 md:flex-col md:items-start md:justify-start lg:flex-row lg:items-start lg:justify-between">
        <div className="w-full min-w-0">
          {title ? (
            <h3 className={cn("flex min-w-0 items-start gap-2 font-semibold text-slate-950 break-words", titleSize)}>
              <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#6D4CFF]" />
              <span className="min-w-0 break-words">{title}</span>
            </h3>
          ) : null}
          {description ? (
            <p className="mt-1 text-sm leading-6 text-slate-500 break-words line-clamp-6">{description}</p>
          ) : null}
          <div className={cn("mt-2 flex w-full flex-wrap items-center", headerBadgeGap)}>
            <Badge variant="soft" color="default" className="rounded-full bg-violet-100 text-violet-700 break-words shrink-0">
              <FileQuestion className="mr-1 h-3 w-3 shrink-0" />
              {safeQuestions.length} preguntas
            </Badge>
            <Badge variant="soft" color="success" className="rounded-full break-words shrink-0">
              Mínimo {configuredPassing}%
            </Badge>
            {maxAttempts ? (
              <Badge variant="soft" color="warning" className="rounded-full break-words shrink-0">
                {remainingAttempts === Infinity ? "∞ intentos" : `${remainingAttempts}/${maxAttempts} disponibles`}
              </Badge>
            ) : null}
            <Badge variant="soft" color="secondary" className="rounded-full break-words shrink-0">
              {answeredCount}/{safeQuestions.length} completadas
            </Badge>
          </div>
        </div>
        {resultSummary ? (
          <Card
            className={cn(
              "w-full min-w-0 border transition shrink-0",
              cardPad,
              resultSummary.passed ? "border-emerald-200 bg-emerald-50/60" : "border-rose-200 bg-rose-50/60"
            )}
          >
            <div className="flex w-full flex-col gap-2">
              <div className="flex min-w-0 items-start gap-2">
                {resultSummary.passed ? (
                  <Trophy className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <Sparkles className="mt-1 h-5 w-5 shrink-0 text-rose-600" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 break-words">
                    Rendimiento
                  </div>
                  <div className={cn("text-lg font-semibold break-words", resultSummary.passed ? "text-emerald-700" : "text-rose-700")}>
                    {resultSummary.percentage}%
                  </div>
                </div>
              </div>
              <div className="min-w-0 flex-1 text-left text-xs text-slate-600 break-words">
                <div className="font-semibold">
                  {resultSummary.correctCount ?? 0}/{resultSummary.totalCount} correctas
                </div>
                <div className="mt-0.5 text-[11px]">
                  Pasa el mínimo: {resultSummary.passed ? "Sí" : "No"}
                </div>
              </div>
            </div>
            <Progress
              value={resultSummary.percentage}
              size="sm"
              className={cn(
                "mt-3",
                resultSummary.passed
                  ? "bg-emerald-100 [&>div]:bg-emerald-500"
                  : "bg-rose-100 [&>div]:bg-rose-500"
              )}
            />
          </Card>
        ) : null}
      </div>

      {!safeQuestions.length ? (
        <div className="w-full min-w-0 rounded-[24px] border border-dashed border-slate-200 bg-slate-50/60 p-5 text-sm text-slate-500 break-words">
          Esta evaluación no tiene preguntas cargadas.
        </div>
      ) : (
        <div className="w-full min-w-0 space-y-3">
          {safeQuestions.map((rawQ, idx) => renderQuestion(rawQ as any, idx))}
        </div>
      )}

      {error ? (
        <div className="w-full min-w-0 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 break-words">
          {error}
        </div>
      ) : null}

      <div className="w-full min-w-0 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:flex-wrap">
        {reviewMode || lastResult ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="w-full sm:w-auto shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-2xl border-slate-200 sm:w-auto"
                  onClick={handleReset}
                  disabled={submitting || (remainingAttempts !== Infinity && remainingAttempts <= 0)}
                >
                  <RotateCcw className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">Reintentar</span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side={"bottom" as RadixSide}>
              <div className="max-w-[240px] text-[11px] leading-5 break-words">
                Volvé a intentarlo si contás con más intentos disponibles.
              </div>
            </TooltipContent>
          </Tooltip>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="w-full sm:w-auto shrink-0">
              <Button
                type="button"
                className="w-full rounded-2xl bg-[#6D4CFF] hover:bg-[#5E3EF0] shadow-[0_12px_30px_rgba(109,76,255,0.28)] transition sm:w-auto"
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {submitting ? (
                  <>
                    <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white shrink-0" />
                    <span className="truncate">Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {lastResult ? "Volver a enviar" : "Enviar evaluación"}
                    </span>
                  </>
                )}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side={"bottom" as RadixSide}>
            <div className="max-w-[240px] text-[11px] leading-5 break-words">
              {remainingAttempts === Infinity
                ? "Corregimos tu evaluación de inmediato y guardamos la nota."
                : remainingAttempts > 0
                ? `Te quedan ${remainingAttempts} ${remainingAttempts === 1 ? "intento" : "intentos"}.`
                : "Sin intentos disponibles para esta evaluación."}
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
