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
