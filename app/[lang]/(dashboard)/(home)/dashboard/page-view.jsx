"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "@iconify/react";
import { useAuth } from "@/provider/auth.provider";
import { authedFetch } from "@/lib/auth/authed-fetch";
import { cn } from "@/lib/utils";
import { normalizePublicR2Url } from "@/lib/r2/normalize-public-url";
import { SiteLogo } from "@/components/svg";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const asArray = (value) => (Array.isArray(value) ? value : []);

const parseIso = (iso) => {
  const value = String(iso || "").trim();
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (iso) => {
  const date = parseIso(iso);
  return date
    ? date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "-";
};

const formatCurrency = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "A definir";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
};

const startOfDay = (value) => {
  const date = parseIso(value);
  if (!date) return null;
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (value) => {
  const date = parseIso(value);
  if (!date) return null;
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const matchesDateRange = (iso, fromDate, toDate) => {
  const date = parseIso(iso);
  if (!date) return false;
  const from = fromDate ? startOfDay(fromDate) : null;
  const to = toDate ? endOfDay(toDate) : null;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
};

const fromNowLabel = (iso) => {
  const date = parseIso(iso);
  if (!date) return "Sin fecha";
  const diff = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `Vencida hace ${Math.abs(diff)} d`;
  if (diff === 0) return "Vence hoy";
  if (diff === 1) return "Vence mañana";
  return `Vence en ${diff} d`;
};

const roleLabel = {
  admin: "Administrador ACAV",
  alumno: "Alumno",
};

const statusLabel = {
  activa: "Activa",
  pendiente: "Pendiente",
  inactiva: "Inactiva",
  borrador: "Borrador",
  pendiente_revision: "Pendiente de revision",
  pausada: "Pausada",
  cerrada: "Cerrada",
  vencida: "Vencida",
  rechazada: "Rechazada",
  recibida: "Recibida",
  vista: "Vista",
  preseleccionada: "Preseleccionada",
  descartada: "Descartada",
  contactada: "Contactada",
};

const statusTone = (status) => {
  if (["activa", "preseleccionada", "contactada"].includes(status)) return "success";
  if (["pendiente", "pendiente_revision", "vista", "borrador"].includes(status)) return "warning";
  if (["cerrada", "vencida", "descartada", "rechazada", "inactiva"].includes(status)) return "secondary";
  return "info";
};

const toneClasses = {
  default: "bg-primary/10 border-primary/20 text-primary",
  success: "bg-success/10 border-success/20 text-success",
  warning: "bg-warning/10 border-warning/20 text-warning",
  danger: "bg-destructive/10 border-destructive/20 text-destructive",
  info: "bg-info/10 border-info/20 text-info",
};

const roleTone = {
  admin: "warning",
  alumno: "info",
};

const formatBadgeDate = (iso) => {
  const date = parseIso(iso);
  return date
    ? date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })
    : "Sin fecha";
};

const getExpiryTone = (iso) => {
  const date = parseIso(iso);
  if (!date) return "secondary";
  const diff = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "destructive";
  if (diff <= 3) return "warning";
  return "success";
};

function MetaBadge({ children, color = "secondary", className = "" }) {
  return (
    <Badge color={color} variant="soft" className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", className)}>
      {children}
    </Badge>
  );
}

function ToneIcon({ icon, tone = "default" }) {
  const resolvedIcon = String(icon || "").replace(/-duotone\b/, "");
  return (
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border", toneClasses[tone])}>
      <Icon icon={resolvedIcon || icon} className="h-5 w-5" />
    </span>
  );
}

function resolvePaymentMeta(enrollment) {
  const paymentStatus = String(enrollment?.paymentStatus || enrollment?.payment?.status || "").trim().toLowerCase();
  const amount =
    enrollment?.paymentAmount ??
    enrollment?.payment?.amount ??
    enrollment?.amount ??
    enrollment?.coursePrice ??
    enrollment?.price ??
    "";

  if (["pagado", "paid", "completed", "acreditado", "accredited", "approved"].includes(paymentStatus)) {
    return {
      label: "Acreditado",
      tone: "success",
      amount,
      amountLabel: formatCurrency(amount),
      helper: "Pago confirmado dentro del campus.",
    };
  }

  if (["pendiente", "pending", "processing", "in_process", "under_review"].includes(paymentStatus)) {
    return {
      label: "Pendiente",
      tone: "warning",
      amount,
      amountLabel: formatCurrency(amount),
      helper: "Todavía no se confirmó la acreditación.",
    };
  }

  if (["rechazado", "rejected", "failed", "cancelled", "canceled"].includes(paymentStatus)) {
    return {
      label: "Sin acreditar",
      tone: "danger",
      amount,
      amountLabel: formatCurrency(amount),
      helper: "El cobro requiere revisión.",
    };
  }

  if (["descartada", "rechazada"].includes(String(enrollment?.status || "").trim().toLowerCase())) {
    return {
      label: "Sin cargo",
      tone: "info",
      amount,
      amountLabel: formatCurrency(amount),
      helper: "La inscripción cerró sin acreditación.",
    };
  }

  return {
    label: "Conciliación manual",
    tone: "info",
    amount,
    amountLabel: formatCurrency(amount),
    helper: "Seguimiento manual hasta integrar la pasarela.",
  };
}

function resolveCertificateMeta(enrollment) {
  const certificateUrl = String(
    enrollment?.certificateUrl ||
      enrollment?.certificate?.url ||
      enrollment?.certificate?.downloadUrl ||
      enrollment?.certificateDownloadUrl ||
      ""
  ).trim();
  const issuedAt =
    enrollment?.certificateIssuedAt ||
    enrollment?.certificate?.issuedAt ||
    enrollment?.certificateGeneratedAt ||
    "";
  const enrollmentStatus = String(enrollment?.status || "").trim().toLowerCase();

  if (certificateUrl) {
    return {
      label: "Emitido",
      tone: "success",
      helper: issuedAt ? `Disponible desde el ${formatDate(issuedAt)}.` : "Ya puedes descargar tu certificado.",
      downloadUrl: certificateUrl,
    };
  }

  if (["descartada", "rechazada"].includes(enrollmentStatus)) {
    return {
      label: "Sin emisión",
      tone: "secondary",
      helper: "Esta inscripción se cerró sin certificado emitido.",
      downloadUrl: "",
    };
  }

  return {
    label: "Pendiente",
    tone: "warning",
    helper: "La emisión todavía está pendiente.",
    downloadUrl: "",
  };
}

function KpiCard({ title, value, icon, tone = "default" }) {
  return (
    <Card className="rounded-3xl border border-border/60 bg-card/90 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <MetaBadge color={tone} className="uppercase tracking-[0.14em]">
              {title}
            </MetaBadge>
            <div className="mt-2 break-words text-3xl font-semibold text-foreground [overflow-wrap:anywhere]">{value}</div>
          </div>
          <ToneIcon icon={icon} tone={tone} />
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyBlock({ text }) {
  return <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">{text}</div>;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 pb-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Card key={item} className="rounded-3xl border border-border/60 bg-card/90 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-3 w-24 rounded-xl" />
                  <Skeleton className="mt-3 h-8 w-20 rounded-xl" />
                  <Skeleton className="mt-3 h-4 w-full rounded-xl" />
                </div>
                <Skeleton className="h-10 w-10 rounded-2xl" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="rounded-3xl border border-border/60 bg-card p-5">
            <div className="flex items-start gap-4">
              <Skeleton className="h-10 w-10 rounded-2xl" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5 w-32 rounded-xl" />
                <Skeleton className="mt-2 h-4 w-full rounded-xl" />
                <Skeleton className="mt-2 h-4 w-4/5 rounded-xl" />
                <Skeleton className="mt-4 h-4 w-16 rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section>
        <Card className="rounded-3xl border border-border/60 bg-card">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-5 w-32 rounded-xl" />
              <Skeleton className="mt-2 h-4 w-full max-w-xl rounded-xl" />
            </div>
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-10 w-20 rounded-xl" />
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Skeleton className="h-10 w-40 rounded-xl" />
              <Skeleton className="h-10 w-40 rounded-xl" />
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function JobRow({ job, lang, href }) {
  const courseCategory = String(job?.subRubro || job?.categoryLabel || "Sin categoría").trim();
  const courseModality = String(job?.modality || job?.modalityLabel || "Sin modalidad").trim();
  const courseLevel = String(job?.level || "Sin nivel").trim();
  const courseDuration = String(job?.duration || "").trim();
  const creationLabel = formatDate(job?.createdAt);

  return (
    <Link
      href={href || `/${lang}/dashboard/cursos/${job.id}`}
      className="block w-full p-4 border border-border/60 rounded-2xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-foreground">{job?.title || "Curso"}</div>
          <div className="mt-1 truncate text-sm text-muted-foreground">
            {courseCategory} · {statusLabel[job?.status] || job?.status || "Sin estado"}
          </div>
        </div>
        <Badge color={statusTone(job?.status)} variant="soft" className="shrink-0">
          {statusLabel[job?.status] || job?.status || "Sin estado"}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <MetaBadge color="default">{courseModality}</MetaBadge>
        <MetaBadge color="info">{courseLevel}</MetaBadge>
        {courseDuration ? <MetaBadge color="warning">{courseDuration}</MetaBadge> : null}
        <MetaBadge color={getExpiryTone(job?.expiresAt)}>{fromNowLabel(job?.expiresAt)}</MetaBadge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Cierre: {formatDate(job?.expiresAt)}</span>
        <span>·</span>
        <span>Creada: {creationLabel}</span>
      </div>
    </Link>
  );
}

function ApplicationRow({ application, lang, job = null, company = null }) {
  const candidateName = [application?.firstName, application?.lastName].filter(Boolean).join(" ").trim() || application?.candidateName || "Alumno";
  const previewUrl = job?.imageUrl
    ? normalizePublicR2Url(job.imageUrl)
    : job?.flyerUrl
      ? normalizePublicR2Url(job.flyerUrl)
      : company?.logoUrl
        ? normalizePublicR2Url(company.logoUrl)
        : "";
  const fallback = String(application?.companyName || candidateName || "AP").slice(0, 2).toUpperCase();
  return (
    <Link
      href={`/${lang}/dashboard/inscripciones/${application.id}`}
      className="block w-full p-4 border border-border/60 rounded-2xl"
    >
      <div className="flex items-start gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
          {previewUrl ? (
            <img src={previewUrl} alt={application?.jobTitle || application?.companyName || "Vista previa"} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10 text-sm font-semibold text-primary">
              {fallback}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-semibold text-foreground">{candidateName}</div>
              <div className="mt-1 truncate text-sm text-muted-foreground">
                {application?.jobTitle || "Busqueda"} · {application?.companyName || "Empresa"}
              </div>
            </div>
            <Badge color={statusTone(application?.status)} variant="soft" className="shrink-0">
              {statusLabel[application?.status] || application?.status || "Sin estado"}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{application?.email || "Sin email"}</span>
            <span>·</span>
            <span>{formatDate(application?.createdAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function PaymentRow({ enrollment, lang }) {
  const payment = resolvePaymentMeta(enrollment);
  const studentName =
    [enrollment?.firstName, enrollment?.lastName].filter(Boolean).join(" ").trim() ||
    enrollment?.candidateName ||
    enrollment?.studentName ||
    "Alumno";

  return (
    <Link
      href={`/${lang}/dashboard/pagos`}
      className="block w-full rounded-2xl border border-border/60 p-4 transition hover:border-primary/20 hover:bg-muted/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-foreground">{enrollment?.jobTitle || enrollment?.courseTitle || "Curso"}</div>
          <div className="mt-1 truncate text-sm text-muted-foreground">{studentName}</div>
        </div>
        <Badge color={payment.tone} variant="soft" className="shrink-0">
          {payment.label}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{payment.amountLabel}</span>
        <span>·</span>
        <span>{payment.helper}</span>
      </div>
    </Link>
  );
}

function StudentEnrollmentRow({ enrollment, lang }) {
  const courseTitle = enrollment?.jobTitle || enrollment?.courseTitle || "Curso";
  const companyName = enrollment?.companyName || enrollment?.institutionName || "ACAV Cursos";

  return (
    <Link
      href={`/${lang}/dashboard/inscripciones/${enrollment.id}`}
      className="block w-full rounded-2xl border border-border/60 p-4 transition hover:border-primary/20 hover:bg-muted/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-foreground">{courseTitle}</div>
          <div className="mt-1 truncate text-sm text-muted-foreground">{companyName}</div>
        </div>
        <Badge color={statusTone(enrollment?.status)} variant="soft" className="shrink-0">
          {statusLabel[enrollment?.status] || enrollment?.status || "Recibida"}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{formatDate(enrollment?.createdAt)}</span>
        <span>·</span>
        <span>{resolvePaymentMeta(enrollment).amountLabel}</span>
      </div>
    </Link>
  );
}

function StudentPaymentRow({ enrollment, lang }) {
  const payment = resolvePaymentMeta(enrollment);
  return (
    <Link
      href={`/${lang}/dashboard/pagos`}
      className="block w-full rounded-2xl border border-border/60 p-4 transition hover:border-primary/20 hover:bg-muted/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-foreground">{enrollment?.jobTitle || enrollment?.courseTitle || "Curso"}</div>
          <div className="mt-1 truncate text-sm text-muted-foreground">{payment.helper}</div>
        </div>
        <Badge color={payment.tone} variant="soft" className="shrink-0">
          {payment.label}
        </Badge>
      </div>
      <div className="mt-3 text-xs font-medium text-foreground">{payment.amountLabel}</div>
    </Link>
  );
}

function StudentCertificateRow({ enrollment, lang }) {
  const certificate = resolveCertificateMeta(enrollment);
  return (
    <Link
      href={`/${lang}/dashboard/certificados`}
      className="block w-full rounded-2xl border border-border/60 p-4 transition hover:border-primary/20 hover:bg-muted/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-foreground">{enrollment?.jobTitle || enrollment?.courseTitle || "Curso"}</div>
          <div className="mt-1 truncate text-sm text-muted-foreground">{certificate.helper}</div>
        </div>
        <Badge color={certificate.tone} variant="soft" className="shrink-0">
          {certificate.label}
        </Badge>
      </div>
    </Link>
  );
}

const DashboardPageView = () => {
  const { lang } = useParams();
  const { user } = useAuth();
  const { actor, loading: actorLoading } = useCourseActor();
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const load = useCallback(async () => {
    if (!user) {
      setCompanies([]);
      setJobs([]);
      setApplications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [companiesData, jobsData, applicationsData] = await Promise.allSettled([
        authedFetch(user, "/api/institutions"),
        authedFetch(user, "/api/courses"),
        authedFetch(user, "/api/enrollments"),
      ]);

      setCompanies(companiesData.status === "fulfilled" ? asArray(companiesData.value?.institutions) : []);
      setJobs(jobsData.status === "fulfilled" ? asArray(jobsData.value?.courses) : []);
      setApplications(applicationsData.status === "fulfilled" ? asArray(applicationsData.value?.enrollments) : []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredCompanies = useMemo(() => {
    if (!fromDate && !toDate) return companies;
    return companies.filter((company) => matchesDateRange(company?.createdAt || company?.updatedAt, fromDate, toDate));
  }, [companies, fromDate, toDate]);

  const filteredJobs = useMemo(() => {
    if (!fromDate && !toDate) return jobs;
    return jobs.filter((job) => matchesDateRange(job?.createdAt || job?.publishedAt || job?.updatedAt, fromDate, toDate));
  }, [jobs, fromDate, toDate]);

  const filteredApplications = useMemo(() => {
    if (!fromDate && !toDate) return applications;
    return applications.filter((application) => matchesDateRange(application?.createdAt, fromDate, toDate));
  }, [applications, fromDate, toDate]);

  const applyQuickRange = (days) => {
    if (!days) {
      setFromDate("");
      setToDate("");
      return;
    }
    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - (days - 1));
    setFromDate(from.toISOString().slice(0, 10));
    setToDate(today.toISOString().slice(0, 10));
  };

  const overview = useMemo(() => {
    const activeJobs = filteredJobs.filter((job) => job?.status === "activa").length;
    const pendingJobs = filteredJobs.filter((job) => ["borrador", "pendiente_revision"].includes(job?.status)).length;
    const closingSoonJobs = filteredJobs.filter((job) => {
      if (!["activa", "pausada"].includes(job?.status)) return false;
      const expiresAt = parseIso(job?.expiresAt);
      if (!expiresAt) return false;
      const diff = expiresAt.getTime() - Date.now();
      return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
    }).length;
    const reviewedApplications = filteredApplications.filter((application) => application?.status !== "recibida").length;
    const contactedApplications = filteredApplications.filter((application) => application?.status === "contactada").length;
    const thisWeekApplications = filteredApplications.filter((application) => {
      const createdAt = parseIso(application?.createdAt);
      if (!createdAt) return false;
      return Date.now() - createdAt.getTime() <= 7 * 24 * 60 * 60 * 1000;
    }).length;
    const paymentRows = filteredApplications.map((application) => resolvePaymentMeta(application));
    const creditedPayments = paymentRows.filter((payment) => payment.label === "Acreditado").length;
    const pendingPayments = paymentRows.filter((payment) => ["Pendiente", "Conciliación manual"].includes(payment.label)).length;
    const totalTrackedPayments = paymentRows.filter((payment) => payment.label !== "Sin cargo").length;
    const creditedRevenue = paymentRows.reduce((acc, payment) => {
      if (payment.label !== "Acreditado") return acc;
      const amount = Number(payment.amount || 0);
      return Number.isFinite(amount) ? acc + amount : acc;
    }, 0);

    return {
      totalCourses: filteredJobs.length,
      activeJobs,
      pendingJobs,
      closingSoonJobs,
      totalStudents: filteredApplications.length,
      reviewedApplications,
      contactedApplications,
      thisWeekApplications,
      totalTrackedPayments,
      creditedPayments,
      pendingPayments,
      creditedRevenue,
    };
  }, [filteredApplications, filteredJobs]);

  const boards = useMemo(() => {
    const focusCourses = [...filteredJobs]
      .filter((job) => ["activa", "pausada"].includes(job?.status))
      .sort((a, b) => (parseIso(a?.expiresAt)?.getTime() || Number.MAX_SAFE_INTEGER) - (parseIso(b?.expiresAt)?.getTime() || Number.MAX_SAFE_INTEGER))
      .slice(0, 4);

    const recentStudents = [...filteredApplications]
      .sort((a, b) => (parseIso(b?.createdAt)?.getTime() || 0) - (parseIso(a?.createdAt)?.getTime() || 0))
      .slice(0, 4);

    const paymentFollowUp = [...filteredApplications]
      .filter((application) => {
        const payment = resolvePaymentMeta(application);
        return ["Acreditado", "Pendiente", "Conciliación manual"].includes(payment.label);
      })
      .sort((a, b) => (parseIso(b?.createdAt || b?.paidAt || b?.paymentDate)?.getTime() || 0) - (parseIso(a?.createdAt || a?.paidAt || a?.paymentDate)?.getTime() || 0))
      .slice(0, 4);

    return { focusCourses, recentStudents, paymentFollowUp };
  }, [filteredApplications, filteredJobs]);

  const jobsById = useMemo(() => {
    return new Map(jobs.map((job) => [job.id, job]));
  }, [jobs]);

  const companiesById = useMemo(() => {
    return new Map(companies.map((company) => [company.id, company]));
  }, [companies]);

  const isStudent = actor?.role === "alumno";

  const studentOverview = useMemo(() => {
    const activeEnrollments = filteredApplications.filter((application) => !["descartada", "rechazada"].includes(String(application?.status || "").trim().toLowerCase())).length;
    const emittedCertificates = filteredApplications.filter((application) => resolveCertificateMeta(application).label === "Emitido").length;
    const creditedPayments = filteredApplications.filter((application) => resolvePaymentMeta(application).label === "Acreditado").length;

    return {
      totalEnrollments: filteredApplications.length,
      activeEnrollments,
      emittedCertificates,
      creditedPayments,
    };
  }, [filteredApplications]);

  const studentBoards = useMemo(() => {
    const latestEnrollments = [...filteredApplications]
      .sort((a, b) => (parseIso(b?.createdAt)?.getTime() || 0) - (parseIso(a?.createdAt)?.getTime() || 0))
      .slice(0, 4);

    const paymentFollowUp = [...filteredApplications]
      .filter((application) => ["Acreditado", "Pendiente", "Conciliación manual"].includes(resolvePaymentMeta(application).label))
      .slice(0, 4);

    const certificates = [...filteredApplications]
      .filter((application) => ["Emitido", "Pendiente"].includes(resolveCertificateMeta(application).label))
      .slice(0, 4);

    return {
      latestEnrollments,
      paymentFollowUp,
      certificates,
    };
  }, [filteredApplications]);

  if (actorLoading || loading) {
    return <DashboardSkeleton />;
  }

  if (isStudent) {
    return (
      <div className="space-y-6 pb-8">
        <section className="grid gap-4 lg:grid-cols-4">
          <KpiCard
            title="Inscripciones"
            value={studentOverview.totalEnrollments}
            icon="solar:document-text-bold-duotone"
            tone="default"
          />
          <KpiCard
            title="Activas"
            value={studentOverview.activeEnrollments}
            icon="solar:book-bookmark-bold-duotone"
            tone="info"
          />
          <KpiCard
            title="Certificados"
            value={studentOverview.emittedCertificates}
            icon="solar:medal-ribbon-star-bold-duotone"
            tone="success"
          />
          <KpiCard
            title="Pagos acreditados"
            value={studentOverview.creditedPayments}
            icon="solar:card-bold-duotone"
            tone="warning"
          />
        </section>

        <section>
          <Card className="rounded-3xl border border-border/60 bg-card">
            <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">Mi panel</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sigue tus inscripciones, revisa pagos y accede rápido a tus certificados desde un mismo lugar.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href={`/${lang}/dashboard/mis-cursos`}>Mis cursos</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/${lang}/dashboard/inscripciones`}>Mis inscripciones</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/${lang}/dashboard/certificados`}>Mis certificados</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/${lang}/dashboard/pagos`}>Historial de pagos</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <Card className="rounded-3xl border border-border/60 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ToneIcon icon="solar:document-text-bold-duotone" tone="default" />
                  Inscripciones recientes
                </CardTitle>
                <MetaBadge color="default">{studentBoards.latestEnrollments.length}</MetaBadge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {studentBoards.latestEnrollments.length
                ? studentBoards.latestEnrollments.map((application) => (
                    <StudentEnrollmentRow key={application.id} enrollment={application} lang={lang} />
                  ))
                : <EmptyBlock text="Todavía no tienes inscripciones registradas." />}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border/60 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ToneIcon icon="solar:card-bold-duotone" tone="warning" />
                  Pagos
                </CardTitle>
                <MetaBadge color="warning">{studentBoards.paymentFollowUp.length}</MetaBadge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {studentBoards.paymentFollowUp.length
                ? studentBoards.paymentFollowUp.map((application) => (
                    <StudentPaymentRow key={application.id} enrollment={application} lang={lang} />
                  ))
                : <EmptyBlock text="No hay movimientos de pago para mostrar." />}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border/60 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ToneIcon icon="solar:medal-ribbon-star-bold-duotone" tone="success" />
                  Certificados
                </CardTitle>
                <MetaBadge color="success">{studentBoards.certificates.length}</MetaBadge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {studentBoards.certificates.length
                ? studentBoards.certificates.map((application) => (
                    <StudentCertificateRow key={application.id} enrollment={application} lang={lang} />
                  ))
                : <EmptyBlock text="Aún no tienes certificados disponibles." />}
            </CardContent>
          </Card>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="grid gap-4 lg:grid-cols-3">
        <KpiCard
          title="Cursos"
          value={overview.totalCourses}
          icon="solar:case-round-bold-duotone"
          tone="default"
        />
        <KpiCard
          title="Alumnos"
          value={overview.totalStudents}
          icon="solar:users-group-rounded-bold-duotone"
          tone="info"
        />
        <KpiCard
          title="Pagos"
          value={overview.totalTrackedPayments}
          icon="solar:card-bold-duotone"
          tone="warning"
        />
      </section>

      <section>
        <Card className="rounded-3xl border border-border/60 bg-card">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-foreground">Ventana operativa</div>
                <MetaBadge color={fromDate || toDate ? "warning" : "secondary"}>
                  {fromDate || toDate ? "Personalizado" : "Sin filtro"}
                </MetaBadge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Ajusta métricas y listados según el periodo que quieras revisar dentro de ACAV Cursos.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Hoy", days: 1 },
                { label: "7 días", days: 7 },
                { label: "30 días", days: 30 },
                { label: "Todo", days: 0 },
              ].map((item) => (
                <Button key={item.label} type="button" variant="outline" onClick={() => applyQuickRange(item.days)}>
                  {item.label}
                </Button>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="rounded-3xl border border-border/60 bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ToneIcon icon="solar:case-round-bold-duotone" tone="default" />
                Cursos prioritarios
              </CardTitle>
              <MetaBadge color="default">{boards.focusCourses.length}</MetaBadge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {boards.focusCourses.length
              ? boards.focusCourses.map((job) => <JobRow key={job.id} job={job} lang={lang} />)
              : <EmptyBlock text="No hay cursos activos que requieran atención inmediata." />}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-border/60 bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ToneIcon icon="solar:users-group-rounded-bold-duotone" tone="info" />
                Alumnos recientes
              </CardTitle>
              <MetaBadge color="info">{boards.recentStudents.length}</MetaBadge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {boards.recentStudents.length
              ? boards.recentStudents.map((application) => (
                  <ApplicationRow
                    key={application.id}
                    application={application}
                    lang={lang}
                    job={jobsById.get(application?.jobId)}
                    company={companiesById.get(application?.companyId)}
                  />
                ))
              : <EmptyBlock text="Todavía no hay alumnos nuevos dentro del rango seleccionado." />}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-border/60 bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ToneIcon icon="solar:card-bold-duotone" tone="warning" />
                Pagos en seguimiento
              </CardTitle>
              <MetaBadge color="warning">{boards.paymentFollowUp.length}</MetaBadge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {boards.paymentFollowUp.length
              ? boards.paymentFollowUp.map((application) => <PaymentRow key={application.id} enrollment={application} lang={lang} />)
              : <EmptyBlock text="No hay pagos relevantes dentro del rango seleccionado." />}
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default DashboardPageView;
