function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function trimText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function normalizeCatalogText(value) {
  return trimText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function deriveCourseRating(course) {
  const raw = Number(course?.rating ?? course?.averageRating ?? course?.score ?? "");
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Math.max(0, Math.min(5, raw));
}

export function deriveCourseProgress(course) {
  const raw = Number(course?.progress ?? course?.completionPercentage ?? course?.studentProgress ?? "");
  if (!Number.isFinite(raw) || raw < 0) return null;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function getCourseCatalogStatus(course) {
  const progress = deriveCourseProgress(course);
  const rawStatus = normalizeCatalogText(course?.publicationStatus || course?.status || "");

  if (progress === 100 || ["cerrada", "vencida", "finalizado", "finalizada"].includes(rawStatus)) {
    return {
      key: "finalizado",
      label: "Finalizado",
      tone: "slate",
    };
  }

  if (typeof progress === "number" && progress > 0) {
    return {
      key: "en_progreso",
      label: "En progreso",
      tone: "blue",
    };
  }

  if (["borrador", "pendiente revision", "pendiente_revision", "proximo", "proximo curso"].includes(rawStatus) || course?.allowEnrollment === false) {
    return {
      key: "proximo",
      label: "Próximo",
      tone: "amber",
    };
  }

  return {
    key: "disponible",
    label: "Disponible",
    tone: "green",
  };
}

export function getCourseCatalogMeta(course) {
  const instructor = trimText(
    course?.instructorName ||
      course?.academyName ||
      course?.institutionName ||
      course?.companyName
  );
  const category = trimText(course?.categoryLabel || course?.subRubro || course?.area);
  const modality = trimText(course?.modalityLabel || course?.modality || course?.initialModality || course?.workMode);
  const level = trimText(course?.level || "Todos los niveles");
  const ratingValue = deriveCourseRating(course);
  const progressValue = deriveCourseProgress(course);
  const shortDescription = trimText(course?.shortDescription || course?.description || "");
  const description =
    shortDescription.length > 160 ? `${shortDescription.slice(0, 157).trim()}...` : shortDescription;
  const duration = trimText(course?.duration || "");
  const classes = Number(course?.classes || 0);

  return {
    instructor: instructor || "ACAV Cursos",
    category: category || "Formación profesional",
    modality: modality || "100% Online",
    level,
    duration: duration || (classes > 0 ? `${classes} clase${classes === 1 ? "" : "s"}` : "Duración flexible"),
    description: description || "Programa intensivo con contenidos prácticos y foco en aplicación real.",
    ratingValue,
    ratingLabel: ratingValue ? ratingValue.toFixed(1) : "Sin reseñas",
    progressValue,
  };
}

export function buildCatalogOptions(courses) {
  const items = toArray(courses);
  const collect = (selector) =>
    Array.from(
      new Set(
        items
          .map(selector)
          .map((value) => trimText(value))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "es"));

  return {
    categories: collect((course) => course?.categoryLabel || course?.subRubro || course?.area),
    modalities: collect((course) => course?.modalityLabel || course?.modality || course?.initialModality || course?.workMode),
    institutions: collect((course) => course?.institutionName || course?.companyName || course?.academyName),
    levels: collect((course) => course?.level),
    statuses: Array.from(new Set(items.map((course) => getCourseCatalogStatus(course).label))),
  };
}

export function filterCourses(courses, filters = {}) {
  const query = normalizeCatalogText(filters.query || "");
  const category = normalizeCatalogText(filters.category || "");
  const modality = normalizeCatalogText(filters.modality || "");
  const institution = normalizeCatalogText(filters.institution || "");
  const level = normalizeCatalogText(filters.level || "");
  const status = normalizeCatalogText(filters.status || "");

  return toArray(courses).filter((course) => {
    const meta = getCourseCatalogMeta(course);
    const resolvedStatus = getCourseCatalogStatus(course);
    const haystack = normalizeCatalogText(
      [
        course?.title,
        meta.description,
        meta.instructor,
        meta.category,
        meta.modality,
        meta.duration,
        meta.level,
      ]
        .filter(Boolean)
        .join(" ")
    );

    if (query && !haystack.includes(query)) return false;
    if (category && category !== "todas" && normalizeCatalogText(meta.category) !== category) return false;
    if (modality && modality !== "todas" && normalizeCatalogText(meta.modality) !== modality) return false;
    if (institution && institution !== "todas" && normalizeCatalogText(meta.instructor) !== institution) return false;
    if (level && level !== "todos" && normalizeCatalogText(meta.level) !== level) return false;
    if (status && status !== "todos" && normalizeCatalogText(resolvedStatus.label) !== status) return false;

    return true;
  });
}
