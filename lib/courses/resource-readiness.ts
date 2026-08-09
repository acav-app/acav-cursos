export const READY_STATUSES = new Set(["ready"]);
const UPLOADING_STATUSES = new Set(["pending", "uploading"]);
const BAD_STATUSES = new Set(["corrupt", "missing"]);

export function resourceIsReady(res) {
  if (!res) return false;
  if (!res.url) return false;
  const status = res.status || (res.url ? "ready" : "pending");
  return READY_STATUSES.has(status);
}

export function videoAssetIsReady(videoAsset, videoUrlFallback) {
  if (videoAsset?.url && READY_STATUSES.has(videoAsset.status || "ready")) {
    return true;
  }
  if (videoUrlFallback) {
    return true;
  }
  return false;
}

export function summarizeLessonResources(lesson) {
  if (!lesson) {
    return { total: 0, ready: 0, uploading: 0, corrupt: 0, allReady: true, hasAny: false };
  }
  const resources = Array.isArray(lesson.resources) ? lesson.resources : [];
  let total = resources.length;
  let ready = 0;
  let uploading = 0;
  let corrupt = 0;
  resources.forEach((r) => {
    const status = r.status || (r.url ? "ready" : "pending");
    if (READY_STATUSES.has(status)) ready += 1;
    else if (UPLOADING_STATUSES.has(status)) uploading += 1;
    else if (BAD_STATUSES.has(status)) corrupt += 1;
  });
  const hasVideo = Boolean(lesson.videoAsset?.url || lesson.videoUrl);
  const videoReady = videoAssetIsReady(lesson.videoAsset, lesson.videoUrl);
  if (hasVideo) {
    total += 1;
    if (videoReady) ready += 1;
    else uploading += 1;
  }
  const hasAny = total > 0;
  return { total, ready, uploading, corrupt, hasAny, allReady: hasAny ? ready === total : true };
}

export function summarizeSectionResources(section) {
  if (!section) {
    return { total: 0, ready: 0, uploading: 0, corrupt: 0, allReady: true, hasAny: false };
  }
  const lessons = Array.isArray(section.lessons) ? section.lessons : [];
  const out = { total: 0, ready: 0, uploading: 0, corrupt: 0, hasAny: false, allReady: true };
  lessons.forEach((lesson) => {
    const l = summarizeLessonResources(lesson);
    out.total += l.total;
    out.ready += l.ready;
    out.uploading += l.uploading;
    out.corrupt += l.corrupt;
    if (l.hasAny) out.hasAny = true;
    if (!l.allReady) out.allReady = false;
  });
  return out;
}

export function summarizeCurriculumResources(curriculum) {
  const lessons = (curriculum || []).flatMap((section) =>
    Array.isArray(section?.lessons) ? section.lessons : []
  );
  const out = {
    total: 0,
    ready: 0,
    uploading: 0,
    corrupt: 0,
    hasAny: false,
    allReady: true,
    byLessonId: new Map(),
  };
  lessons.forEach((lesson) => {
    const l = summarizeLessonResources(lesson);
    out.byLessonId.set(lesson?.id, l);
    out.total += l.total;
    out.ready += l.ready;
    out.uploading += l.uploading;
    out.corrupt += l.corrupt;
    if (l.hasAny) out.hasAny = true;
    if (!l.allReady) out.allReady = false;
  });
  return out;
}

export function isLessonEvaluationUnlocked(lesson) {
  if (!lesson?.evaluation?.enabled) return false;
  if (lesson.evaluation.locked) return false;
  if (lesson.evaluation.requireAllResourcesReady === false) return true;
  const sum = summarizeLessonResources(lesson);
  return sum.allReady;
}

export function isFinalEvaluationUnlocked(course, enrollmentLessonStates) {
  const finalEval = course?.finalEvaluation;
  if (!finalEval?.enabled) return false;
  if (finalEval.locked) return false;

  const curriculum = Array.isArray(course.curriculum) ? course.curriculum : [];
  const lessons = curriculum.flatMap((s) => (Array.isArray(s?.lessons) ? s.lessons : []));

  if (finalEval.requireAllResourcesReady !== false) {
    const allResources = summarizeCurriculumResources(curriculum);
    if (!allResources.allReady) return false;
  }

  if (finalEval.requireAllLessonsEvaluationsCompleted !== false) {
    const states = enrollmentLessonStates || {};
    const evaluatedLessons = lessons.filter((l) => l?.evaluation?.enabled);
    if (evaluatedLessons.length === 0) return true;
    const allPassed = evaluatedLessons.every((lesson) => {
      const state = states[lesson.id];
      return state?.passed === true;
    });
    if (!allPassed) return false;
  }

  return true;
}

const PASSING_STATUS_TOKENS = new Set([
  "approved",
  "aprobado",
  "aprobada",
  "passed",
  "pass",
  "promoted",
  "promovido",
  "cumplido",
  "ok",
]);

const FAILING_STATUS_TOKENS = new Set([
  "rejected",
  "rechazado",
  "failed",
  "fail",
  "desaprobado",
  "desaprobada",
]);

function guessPercentage(entry, lessonEvaluation) {
  const hasScore = entry?.score !== undefined && entry?.score !== null;
  const hasMax = entry?.maxScore !== undefined && entry?.maxScore !== null;
  if (hasScore && hasMax && Number(entry.maxScore) > 0) {
    return Math.round((Number(entry.score) / Number(entry.maxScore)) * 100);
  }
  if (typeof entry?.score === "number" && entry.score >= 0 && entry.score <= 100) {
    return Math.round(Number(entry.score));
  }
  if (typeof lessonEvaluation?.passingScore === "number") {
    return undefined;
  }
  const status = String(entry?.status || "").trim().toLowerCase();
  if (PASSING_STATUS_TOKENS.has(status)) return 100;
  if (FAILING_STATUS_TOKENS.has(status)) return 0;
  return undefined;
}

function guessPassed(entry, lessonEvaluation, percentage) {
  if (entry?.passed === true) return true;
  if (entry?.passed === false) return false;
  const status = String(entry?.status || "").trim().toLowerCase();
  if (PASSING_STATUS_TOKENS.has(status)) return true;
  if (FAILING_STATUS_TOKENS.has(status)) return false;
  const threshold = Number(lessonEvaluation?.passingScore ?? 60);
  if (typeof percentage === "number") return percentage >= threshold;
  return undefined;
}

export function buildLessonEvaluationStatesFromEnrollment(curriculum, gradebook) {
  const lessons = Array.isArray(curriculum)
    ? curriculum.flatMap((s) => (Array.isArray(s?.lessons) ? s.lessons : []))
    : [];
  const gradebookEntries = Array.isArray(gradebook) ? gradebook : [];
  const states = {};

  lessons.forEach((lesson) => {
    const lessonId = String(lesson?.id || "");
    if (!lessonId) return;
    const enabled = Boolean(lesson?.evaluation?.enabled);
    const evalTitle = String(lesson?.evaluation?.title || "").trim();

    const candidates = gradebookEntries.filter((entry) => {
      if (!entry) return false;
      const entrySourceId = String(entry?.sourceId || entry?.lessonId || entry?.id || "").trim();
      if (entrySourceId && entrySourceId === lessonId) return true;
      const entryLessonId = String(entry?.lessonId || entry?.lessonID || entry?.classId || "").trim();
      if (entryLessonId && entryLessonId === lessonId) return true;
      const entryTitle = String(entry?.title || "").trim();
      if (evalTitle && entryTitle && entryTitle.toLowerCase() === evalTitle.toLowerCase()) return true;
      const entrySourceType = String(entry?.sourceType || entry?.type || "").toLowerCase();
      if (
        (entrySourceType === "lesson_evaluation" ||
          entrySourceType === "class_evaluation" ||
          entrySourceType === "quiz" ||
          entrySourceType === "per_class" ||
          entrySourceType === "lesson_quiz") &&
        (entrySourceId === lessonId || entryLessonId === lessonId)
      ) {
        return true;
      }
      return false;
    });

    const best = candidates.reduce((carry, entry) => {
      const pct = guessPercentage(entry, lesson?.evaluation);
      const passed = guessPassed(entry, lesson?.evaluation, pct);
      const score = typeof pct === "number" ? pct : -Infinity;
      if (!carry) return { entry, pct, passed, score };
      return score > carry.score ? { entry, pct, passed, score } : carry;
    }, null);

    const pct = best?.pct;
    const passed = best?.passed;
    const bestEntry = best?.entry;
    states[lessonId] = {
      enabled,
      lessonId,
      status: bestEntry?.status || undefined,
      score: typeof pct === "number" ? pct : bestEntry?.score ?? undefined,
      maxScore: bestEntry?.maxScore ?? undefined,
      percentage: pct,
      attempts:
        bestEntry?.attempts ??
        (candidates.length > 0 ? candidates.length : undefined),
      passed: enabled ? passed ?? false : undefined,
      submitted: Boolean(bestEntry),
      bestEntry: bestEntry || undefined,
      allAttempts: candidates,
    };
  });

  return states;
}

export function perClassEvaluationProgress(curriculum, perClassStates) {
  const lessons = Array.isArray(curriculum)
    ? curriculum.flatMap((s) => (Array.isArray(s?.lessons) ? s.lessons : []))
    : [];
  const evaluated = lessons.filter((l) => l?.evaluation?.enabled);
  const states = perClassStates || {};
  let passed = 0;
  let pending = 0;
  let failed = 0;
  evaluated.forEach((lesson) => {
    const s = states[lesson.id];
    if (!s?.submitted) {
      pending += 1;
    } else if (s?.passed === true) {
      passed += 1;
    } else {
      failed += 1;
    }
  });
  return {
    totalEvaluations: evaluated.length,
    passed,
    pending,
    failed,
    allPassed: evaluated.length > 0 ? passed === evaluated.length : true,
    submittedAny: passed + failed > 0,
  };
}

export function finalEvaluationUnlockedReason(course, perClassStates) {
  const finalEval = course?.finalEvaluation;
  if (!finalEval?.enabled) return "La evaluación final no está habilitada en este curso.";
  if (finalEval.locked) return "La evaluación final está bloqueada por la coordinación.";

  const curriculum = Array.isArray(course.curriculum) ? course.curriculum : [];
  const summary = summarizeCurriculumResources(curriculum);
  const progress = perClassEvaluationProgress(curriculum, perClassStates);

  const missingResources = finalEval.requireAllResourcesReady !== false && !summary.allReady;
  const missingEvaluations =
    finalEval.requireAllLessonsEvaluationsCompleted !== false && !progress.allPassed;

  if (missingResources && missingEvaluations) {
    return `Faltan subir ${summary.total - summary.ready} recurso(s) y aprobar ${progress.totalEvaluations - progress.passed} evaluación(es) por clase.`;
  }
  if (missingResources) {
    return `Faltan subir recursos: ${readinessProgressText(summary)}.`;
  }
  if (missingEvaluations) {
    if (progress.pending > 0 && progress.failed === 0) {
      return `Tenés ${progress.pending} evaluación(es) por clase sin rendir. Aprobá todas para desbloquear la final.`;
    }
    if (progress.failed > 0) {
      return `Tenés ${progress.failed} evaluación(es) por clase desaprobada(s). Reinténtalas para aprobar y desbloquear la final.`;
    }
    return `Aprobá ${progress.totalEvaluations - progress.passed} evaluación(es) por clase más para habilitar la final.`;
  }
  return "Todos los requisitos cumplidos. ¡Podés rendir la evaluación final!";
}

export function readinessProgressText(summary) {
  if (!summary?.hasAny) return "Sin recursos requeridos";
  if (summary.allReady) return `Todos los recursos listos (${summary.ready}/${summary.total})`;
  if (summary.corrupt > 0) return `${summary.corrupt} archivo(s) corrupto(s) · ${summary.ready}/${summary.total}`;
  return `Subiendo recursos… ${summary.ready}/${summary.total}`;
}

export function readinessTone(summary) {
  if (!summary?.hasAny) return "secondary";
  if (summary.allReady) return "success";
  if (summary.corrupt > 0) return "destructive";
  return "warning";
}
