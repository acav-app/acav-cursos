"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Award, BookOpen, Bookmark, Briefcase, Building2, Calendar, CreditCard, ExternalLink, FileText, Link2, Loader2, Mail, MapPin, Phone, Save, ShieldCheck, Trash2, User } from "lucide-react";
import { useAuth } from "@/provider/auth.provider";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { authedFetch } from "@/lib/auth/authed-fetch";
import { readSavedCourses, writeSavedCourses } from "@/lib/courses/client/saved-courses";
import { buildLocalizedPath, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { MotionStagger, MotionStaggerItem } from "@/components/courses/public-motion";
import ViewTransitionLink from "@/components/ui/view-transition-link";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function applicationTone(status) {
  if (["preseleccionada", "contactada"].includes(status)) return "success";
  if (["vista"].includes(status)) return "warning";
  if (["descartada", "rechazada"].includes(status)) return "destructive";
  return "info";
}

function formatStatusLabel(status) {
  const value = String(status || "recibida").replaceAll("_", " ").trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Recibida";
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "A definir";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "A definir";

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function resolveCertificateMeta(application) {
  const certificateUrl = String(
    application?.certificateUrl ||
      application?.certificate?.url ||
      application?.certificate?.downloadUrl ||
      application?.certificateDownloadUrl ||
      ""
  ).trim();
  const issuedAt = application?.certificateIssuedAt || application?.certificate?.issuedAt || application?.certificateGeneratedAt || "";
  const enrollmentStatus = String(application?.status || "").trim().toLowerCase();

  if (certificateUrl) {
    return {
      label: "Emitido",
      tone: "success",
      helper: issuedAt ? `Disponible desde el ${formatDate(issuedAt)}.` : "Ya tienes un archivo disponible para descargar.",
      downloadUrl: certificateUrl,
    };
  }

  if (["descartada", "rechazada"].includes(enrollmentStatus)) {
    return {
      label: "Sin emisión",
      tone: "destructive",
      helper: "Esta inscripción no avanzó a una instancia con certificado emitido.",
      downloadUrl: "",
    };
  }

  return {
    label: "Pendiente",
    tone: "warning",
    helper: "La institución todavía no publicó un certificado para esta inscripción.",
    downloadUrl: "",
  };
}

function resolvePaymentMeta(application) {
  const paymentStatus = String(application?.paymentStatus || application?.payment?.status || "").trim().toLowerCase();
  const amount =
    application?.paymentAmount ??
    application?.payment?.amount ??
    application?.amount ??
    application?.coursePrice ??
    application?.price ??
    "";
  const receiptUrl = String(application?.paymentReceiptUrl || application?.payment?.receiptUrl || "").trim();
  const paidAt = application?.paidAt || application?.payment?.paidAt || application?.paymentDate || "";
  const enrollmentStatus = String(application?.status || "").trim().toLowerCase();

  if (["pagado", "paid", "completed", "acreditado", "accredited", "approved"].includes(paymentStatus)) {
    return {
      label: "Acreditado",
      tone: "success",
      helper: paidAt ? `Pago acreditado el ${formatDate(paidAt)}.` : "El campus registra esta inscripción como acreditada.",
      amountLabel: formatCurrency(amount),
      receiptUrl,
    };
  }

  if (["pendiente", "pending", "processing", "in_process", "under_review"].includes(paymentStatus)) {
    return {
      label: "Pendiente",
      tone: "warning",
      helper: "Todavía no se confirmó la acreditación del pago.",
      amountLabel: formatCurrency(amount),
      receiptUrl,
    };
  }

  if (["rechazado", "rejected", "failed", "cancelled", "canceled"].includes(paymentStatus)) {
    return {
      label: "Sin acreditar",
      tone: "destructive",
      helper: "El registro de pago necesita revisión o un nuevo intento.",
      amountLabel: formatCurrency(amount),
      receiptUrl,
    };
  }

  if (["descartada", "rechazada"].includes(enrollmentStatus)) {
    return {
      label: "Sin cargo",
      tone: "info",
      helper: "La inscripción quedó cerrada sin un cobro confirmado en el campus.",
      amountLabel: formatCurrency(amount),
      receiptUrl,
    };
  }

  return {
    label: "Conciliación manual",
    tone: "info",
    helper: "El seguimiento de cobros sigue siendo manual mientras se integra la pasarela de pagos.",
    amountLabel: formatCurrency(amount),
    receiptUrl,
  };
}

function sectionButtonClass(active) {
  return cn(
    "inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition",
    active
      ? "border-[#DD4913] bg-[#DD4913] text-white shadow-[0_12px_28px_rgba(221,73,19,0.28)]"
      : "border-white/12 bg-white/8 text-white/82 hover:border-white/24 hover:bg-white/12"
  );
}

function CandidatePanelSkeleton() {
  return (
    <section className="public-theme min-h-[calc(100vh-68px)] border-b border-[#E6EBF4] bg-[#F8FBFF] pt-[88px]">
      <div className="mx-auto max-w-[1180px] px-6 pb-8">
        <div className="rounded-[30px] border border-[#D9E2F2] bg-white p-6 shadow-[0_14px_40px_rgba(27,43,80,0.06)]">
          <Skeleton className="h-5 w-36 rounded-full" />
          <Skeleton className="mt-4 h-10 w-72 rounded-2xl" />
          <Skeleton className="mt-3 h-4 w-full max-w-2xl rounded-xl" />
          <div className="mt-6 flex gap-3">
            <Skeleton className="h-10 w-28 rounded-full" />
            <Skeleton className="h-10 w-36 rounded-full" />
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-28 rounded-[24px]" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function getSectionHref(lang, key) {
  if (key === "profile") return buildLocalizedPath("/mi-campus", lang);
  if (key === "applications") return buildLocalizedPath("/mis-inscripciones", lang);
  if (key === "saved") return buildLocalizedPath("/mis-cursos", lang);
  if (key === "certificates") return buildLocalizedPath("/mis-certificados", lang);
  if (key === "payments") return buildLocalizedPath("/historial-pagos", lang);
  return buildLocalizedPath("/", lang);
}

function getPageCopy(view) {
  if (view === "saved") {
    return {
      title: "Mis Cursos",
      description: "Reúne tu selección personal para volver al catálogo, comparar propuestas y decidir tu próxima formación.",
    };
  }

  if (view === "applications") {
    return {
      title: "Mis Inscripciones",
      description: "Consulta tu actividad académica, revisa el estado de cada curso y sigue cada inscripción en detalle.",
    };
  }

  if (view === "certificates") {
    return {
      title: "Mis Certificados",
      description: "Centraliza constancias emitidas, pendientes y accesos rápidos a cada inscripción certificable.",
    };
  }

  if (view === "payments") {
    return {
      title: "Historial de Pagos",
      description: "Consulta el seguimiento financiero de tus inscripciones y controla cada comprobante disponible.",
    };
  }

  if (view === "application-detail") {
    return {
      title: "Detalle de inscripcion",
      description: "Revisa exactamente qué información enviaste y el estado actual de tu solicitud dentro del campus.",
    };
  }

  return {
    title: "Mi Campus",
    description: "Centraliza tu recorrido dentro de ACAV Cursos: descubre nuevas propuestas, sigue inscripciones, pagos y certificados desde un mismo lugar.",
  };
}

function buildBreadcrumbs(lang, view, applicationTitle) {
  const items = [{ label: "Inicio", href: buildLocalizedPath("/", lang) }];

  if (view === "profile") {
    items.push({ label: "Mi Campus" });
    return items;
  }

  if (view === "saved") {
    items.push({ label: "Mis Cursos" });
    return items;
  }

  if (view === "certificates") {
    items.push({ label: "Mis Certificados" });
    return items;
  }

  if (view === "payments") {
    items.push({ label: "Historial de pagos" });
    return items;
  }

  items.push({ label: "Mis Inscripciones", href: buildLocalizedPath("/mis-inscripciones", lang) });

  if (view === "application-detail") {
    items.push({ label: applicationTitle || "Detalle" });
  }

  return items;
}

function buildTimeline(status) {
  const normalized = String(status || "recibida").trim().toLowerCase();
  const reviewComplete = ["vista", "preseleccionada", "contactada", "descartada", "rechazada"].includes(normalized);
  const shortlistComplete = ["preseleccionada", "contactada"].includes(normalized);
  const contactComplete = ["contactada"].includes(normalized);
  const isClosed = ["descartada", "rechazada"].includes(normalized);

  return {
    isClosed,
    closingLabel: normalized === "rechazada" ? "Proceso cerrado" : normalized === "descartada" ? "Perfil no continuó" : "",
    closingHelper:
      normalized === "rechazada"
        ? "La institucion cerro esta inscripcion y ya no continua en evaluacion."
        : normalized === "descartada"
          ? "La propuesta siguio con otro criterio o se redefinio internamente."
          : "",
    steps: [
      {
        id: "received",
        label: "Recibida",
        helper: "Tu inscripcion quedo registrada correctamente.",
        state: "done",
      },
      {
        id: "review",
        label: "Revisión",
        helper: "La institucion revisa tu perfil y la informacion enviada.",
        state: reviewComplete ? "done" : normalized === "recibida" ? "current" : "pending",
      },
      {
        id: "shortlist",
        label: "Preselección",
        helper: "Tu perfil avanza para una evaluación más cercana.",
        state: shortlistComplete ? "done" : normalized === "vista" ? "current" : "pending",
      },
      {
        id: "contact",
        label: "Contacto",
        helper: "La institucion ya puede coordinar un proximo paso con vos.",
        state: contactComplete ? "done" : normalized === "preseleccionada" ? "current" : "pending",
      },
    ],
  };
}

export default function CandidatePortalPanel({ lang, view = "profile", applicationId = "" }) {
  const { user, loading: authLoading } = useAuth();
  const { actor, loading: actorLoading } = useCourseActor();
  const router = useRouter();
  const activePanel =
    view === "profile"
      ? "profile"
      : view === "saved"
        ? "saved"
        : view === "certificates"
          ? "certificates"
          : view === "payments"
            ? "payments"
            : "applications";
  const selectedApplicationId = String(applicationId || "").trim();
  const pageCopy = getPageCopy(view);

  const [profileForm, setProfileForm] = useState({
    displayName: "",
    firstName: "",
    lastName: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [applicationsError, setApplicationsError] = useState("");
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [savedJobs, setSavedJobs] = useState([]);

  useEffect(() => {
    if (!actor) return;
    setProfileForm({
      displayName: String(actor.displayName || "").trim(),
      firstName: String(actor.firstName || "").trim(),
      lastName: String(actor.lastName || "").trim(),
    });
  }, [actor]);

  useEffect(() => {
    let alive = true;

    async function loadApplications() {
      if (!user || actor?.role !== "candidato") {
        if (alive) {
          setApplications([]);
          setApplicationsLoading(false);
        }
        return;
      }

      setApplicationsLoading(true);
      setApplicationsError("");
      try {
        const data = await authedFetch(user, "/api/enrollments", { method: "GET" });
        if (!alive) return;
        setApplications(Array.isArray(data?.enrollments) ? data.enrollments : []);
      } catch (error) {
        if (!alive) return;
        setApplicationsError(error?.message || "No pudimos cargar tus inscripciones.");
      } finally {
        if (!alive) return;
        setApplicationsLoading(false);
      }
    }

    loadApplications();
    return () => {
      alive = false;
    };
  }, [actor?.role, user]);

  useEffect(() => {
    let alive = true;

    async function loadApplicationDetail() {
      if (!user || actor?.role !== "candidato" || view !== "application-detail" || !selectedApplicationId) {
        if (alive) {
          setSelectedApplication(null);
          setDetailError("");
          setDetailLoading(false);
        }
        return;
      }

      setDetailLoading(true);
      setDetailError("");
      try {
        const data = await authedFetch(user, `/api/enrollments/${selectedApplicationId}`, { method: "GET" });
        if (!alive) return;
        setSelectedApplication(data?.enrollment || null);
      } catch (error) {
        if (!alive) return;
        setSelectedApplication(null);
        setDetailError(error?.message || "No pudimos cargar el detalle de la inscripcion.");
      } finally {
        if (!alive) return;
        setDetailLoading(false);
      }
    }

    loadApplicationDetail();
    return () => {
      alive = false;
    };
  }, [actor?.role, selectedApplicationId, user, view]);

  useEffect(() => {
    if (!user || actor?.role !== "candidato") {
      setSavedJobs([]);
      return;
    }

    const syncSavedJobs = () => {
      setSavedJobs(readSavedCourses());
    };

    syncSavedJobs();
    window.addEventListener("storage", syncSavedJobs);
    window.addEventListener("focus", syncSavedJobs);

    return () => {
      window.removeEventListener("storage", syncSavedJobs);
      window.removeEventListener("focus", syncSavedJobs);
    };
  }, [actor?.role, user]);

  const stats = useMemo(() => {
    const total = applications.length;
    const active = applications.filter((item) => ["recibida", "vista", "preseleccionada", "contactada"].includes(String(item?.status || ""))).length;
    const highlighted = applications.filter((item) => ["preseleccionada", "contactada"].includes(String(item?.status || ""))).length;
    return { total, active, highlighted };
  }, [applications]);
  const certificateItems = useMemo(
    () =>
      applications.map((item) => ({
        ...item,
        certificateMeta: resolveCertificateMeta(item),
      })),
    [applications]
  );
  const paymentItems = useMemo(
    () =>
      applications.map((item) => ({
        ...item,
        paymentMeta: resolvePaymentMeta(item),
      })),
    [applications]
  );

  const listedSelectedApplication = useMemo(() => {
    if (!selectedApplicationId) return null;
    return applications.find((item) => String(item?.id || "") === selectedApplicationId) || null;
  }, [applications, selectedApplicationId]);
  const savedStats = useMemo(() => {
    const total = savedJobs.length;
    const companies = new Set(savedJobs.map((item) => String(item?.companyName || "").trim()).filter(Boolean)).size;
    const cities = new Set(savedJobs.map((item) => String(item?.city || "").trim()).filter(Boolean)).size;
    return { total, companies, cities };
  }, [savedJobs]);
  const certificateStats = useMemo(() => {
    const emitted = certificateItems.filter((item) => item.certificateMeta.label === "Emitido").length;
    const pending = certificateItems.filter((item) => item.certificateMeta.label === "Pendiente").length;
    const unavailable = certificateItems.filter((item) => item.certificateMeta.label === "Sin emisión").length;
    return { emitted, pending, unavailable };
  }, [certificateItems]);
  const paymentStats = useMemo(() => {
    const credited = paymentItems.filter((item) => item.paymentMeta.label === "Acreditado").length;
    const pending = paymentItems.filter((item) => ["Pendiente", "Conciliación manual"].includes(item.paymentMeta.label)).length;
    const noCharge = paymentItems.filter((item) => item.paymentMeta.label === "Sin cargo").length;
    return { credited, pending, noCharge };
  }, [paymentItems]);
  const currentApplicationTitle = selectedApplication?.jobTitle || listedSelectedApplication?.jobTitle || "Detalle";
  const breadcrumbs = buildBreadcrumbs(lang, view, currentApplicationTitle);
  const applicationTimeline = view === "application-detail" && selectedApplication ? buildTimeline(selectedApplication.status) : null;
  const heroMetrics =
    view === "saved"
      ? [
          { label: "Guardados", value: String(savedStats.total), helper: "Cursos que marcaste para revisar despues" },
          { label: "Instituciones", value: String(savedStats.companies), helper: "Organizaciones incluidas en tus favoritos" },
          { label: "Ubicaciones", value: String(savedStats.cities), helper: "Ciudades detectadas en tus cursos guardados" },
        ]
      : view === "certificates"
      ? [
          { label: "Emitidos", value: String(certificateStats.emitted), helper: "Archivos listos para descargar" },
          { label: "Pendientes", value: String(certificateStats.pending), helper: "Inscripciones sin certificado publicado" },
          { label: "Sin emisión", value: String(certificateStats.unavailable), helper: "Registros cerrados sin constancia emitida" },
        ]
      : view === "payments"
      ? [
          { label: "Acreditados", value: String(paymentStats.credited), helper: "Pagos confirmados por el campus" },
          { label: "En seguimiento", value: String(paymentStats.pending), helper: "Cobros todavía en conciliación manual" },
          { label: "Sin cargo", value: String(paymentStats.noCharge), helper: "Inscripciones cerradas sin acreditación" },
        ]
      : view === "application-detail" && selectedApplication
      ? [
          { label: "Estado actual", value: formatStatusLabel(selectedApplication.status), helper: "Seguimiento en tiempo real" },
          { label: "Institucion", value: selectedApplication.companyName || "No informada", helper: "Propuesta asociada" },
          { label: "Fecha enviada", value: formatDate(selectedApplication.createdAt), helper: "Registro de inscripcion" },
        ]
      : [
          { label: "Inscripciones", value: String(stats.total), helper: "Tus registros dentro del campus" },
          { label: "Certificados emitidos", value: String(certificateStats.emitted), helper: "Constancias disponibles para descargar" },
          { label: "Pagos acreditados", value: String(paymentStats.credited), helper: "Cobros confirmados por instituciones" },
        ];

  const handleRemoveSavedJob = (jobId) => {
    const next = savedJobs.filter((item) => String(item?.id || "") !== String(jobId || ""));
    writeSavedCourses(next);
    setSavedJobs(next);
  };

  const handleProfileChange = (field, value) => {
    setProfileForm((current) => ({ ...current, [field]: value }));
    setProfileError("");
    setProfileSuccess("");
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    if (!user) return;

    setSavingProfile(true);
    setProfileError("");
    setProfileSuccess("");
    try {
      const data = await authedFetch(user, "/api/courses/me", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: profileForm.displayName,
          firstName: profileForm.firstName,
          lastName: profileForm.lastName,
        }),
      });

      const nextActor = data?.actor || null;
      setProfileForm({
        displayName: String(nextActor?.displayName || "").trim(),
        firstName: String(nextActor?.firstName || "").trim(),
        lastName: String(nextActor?.lastName || "").trim(),
      });
      setProfileSuccess("Tu perfil quedó actualizado.");
      router.refresh();
    } catch (error) {
      setProfileError(error?.message || "No pudimos guardar tus datos.");
    } finally {
      setSavingProfile(false);
    }
  };

  if (authLoading || actorLoading) return <CandidatePanelSkeleton />;

  if (!user) {
    return (
      <section className="public-theme min-h-[calc(100vh-68px)] border-b border-[#E6EBF4] bg-[#F8FBFF] pt-[88px]">
        <div className="mx-auto max-w-[1180px] px-6 pb-8">
          <div className="rounded-[30px] border border-[#D9E2F2] bg-white p-8 text-center shadow-[0_18px_48px_rgba(27,43,80,0.08)]">
            <div className="text-2xl font-extrabold tracking-tight text-[#1B2B50]">Iniciá sesión para ver tu espacio</div>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Tu perfil y tus inscripciones se administran desde paginas personales dentro del portal ACAV Cursos.
            </p>
            <Button asChild className="mt-6 rounded-2xl">
              <Link href={buildLocalizedPath("/auth/login", lang)}>Ir a iniciar sesión</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  if (actor?.role !== "candidato") {
    return (
      <section className="public-theme min-h-[calc(100vh-68px)] border-b border-[#E6EBF4] bg-[#F8FBFF] pt-[88px]">
        <div className="mx-auto max-w-[1180px] px-6 pb-8">
          <div className="rounded-[30px] border border-[#D9E2F2] bg-white p-8 text-center shadow-[0_18px_48px_rgba(27,43,80,0.08)]">
            <div className="text-2xl font-extrabold tracking-tight text-[#1B2B50]">Esta seccion es exclusiva para alumnos</div>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Si tu cuenta corresponde a una institucion o administracion, continua desde tu panel principal.
            </p>
            <Button asChild className="mt-6 rounded-2xl">
              <Link href={buildLocalizedPath("/dashboard", lang)}>Ir al panel</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="public-theme min-h-[calc(100vh-68px)] border-b border-[#E6EBF4] bg-[#F8FBFF] pt-[88px]">
      <div className="mx-auto max-w-[1180px] px-6 pb-8">
        <div className="overflow-hidden rounded-[30px] border border-[#D9E2F2] bg-white shadow-[0_18px_48px_rgba(27,43,80,0.08)]">
          <div className="border-b border-[#E6EBF4] p-6 md:p-8">
            <div className="relative overflow-hidden rounded-[30px] border border-[#22345E] bg-[linear-gradient(145deg,#15203B_0%,#1B2B50_55%,#15203B_100%)] p-6 text-white shadow-[0_18px_44px_rgba(21,32,59,0.18)] md:p-8">
              <div className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full bg-[rgba(49,69,111,0.45)] blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 left-0 h-32 w-48 bg-[linear-gradient(35deg,rgba(221,73,19,0.18),rgba(221,73,19,0))]" />

              <PortalBreadcrumbs items={breadcrumbs} />

              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#DD4913]/25 bg-[#DD4913]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#FFD3C3]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Campus ACAV
              </div>

              <div className="mt-4">
                <div className="max-w-3xl">
                  <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-[2.15rem]">
                    {view === "profile" ? `Hola, ${actor.firstName || actor.displayName || "alumno"}` : pageCopy.title}
                  </h1>
                  <p className="mt-3 text-sm leading-7 text-white/72 md:text-base">
                    {pageCopy.description}
                  </p>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button asChild className="rounded-2xl bg-[#DD4913] text-white hover:bg-[#EB5B24]">
                    <Link href={buildLocalizedPath("/cursos", lang)}>Explorar cursos</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-2xl border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                    <Link href={buildLocalizedPath("/mis-inscripciones", lang)}>Seguir mis inscripciones</Link>
                  </Button>
                </div>
                <div className="flex flex-wrap gap-3 mt-3">
                  <ViewTransitionLink href={getSectionHref(lang, "profile")} className={sectionButtonClass(activePanel === "profile")}>
                    <User className="h-4 w-4" />
                    Mi Campus
                  </ViewTransitionLink>
                  <ViewTransitionLink href={getSectionHref(lang, "saved")} className={sectionButtonClass(activePanel === "saved")}>
                    <Bookmark className="h-4 w-4" />
                    Mis Cursos
                  </ViewTransitionLink>
                  <ViewTransitionLink href={getSectionHref(lang, "applications")} className={sectionButtonClass(activePanel === "applications")}>
                    <Briefcase className="h-4 w-4" />
                    Mis Inscripciones
                  </ViewTransitionLink>
                  <ViewTransitionLink href={getSectionHref(lang, "certificates")} className={sectionButtonClass(activePanel === "certificates")}>
                    <Award className="h-4 w-4" />
                    Mis Certificados
                  </ViewTransitionLink>
                  <ViewTransitionLink href={getSectionHref(lang, "payments")} className={sectionButtonClass(activePanel === "payments")}>
                    <CreditCard className="h-4 w-4" />
                    Historial de Pagos
                  </ViewTransitionLink>
                </div>
              </div>

              <MotionStagger className="mt-6 grid gap-4 md:grid-cols-3" delayChildren={0.04} staggerChildren={0.08}>
                {heroMetrics.map((item) => (
                  <MotionStaggerItem key={item.label}>
                    <div className="rounded-[24px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
                      <div className="text-xs font-bold uppercase tracking-[0.16em] text-white/52">{item.label}</div>
                      <div className="mt-3 text-2xl font-extrabold tracking-tight text-white">{item.value}</div>
                      <p className="mt-2 text-sm text-white/68">{item.helper}</p>
                    </div>
                  </MotionStaggerItem>
                ))}
              </MotionStagger>
            </div>
          </div>

          <div className="p-6 md:p-8">
            {view === "profile" ? (
              <MotionStagger className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]" delayChildren={0.04} staggerChildren={0.08}>
                <MotionStaggerItem>
                  <form onSubmit={handleProfileSubmit} className="grid gap-5">
                    {profileError ? (
                      <Alert color="destructive" variant="soft" className="rounded-2xl border border-destructive/20 px-4 py-3">
                        <AlertDescription>{profileError}</AlertDescription>
                      </Alert>
                    ) : null}
                    {profileSuccess ? (
                      <Alert color="success" variant="soft" className="rounded-2xl border border-emerald-200 px-4 py-3 text-emerald-700">
                        <AlertDescription>{profileSuccess}</AlertDescription>
                      </Alert>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <LabelBlock label="Nombre">
                          <Input value={profileForm.firstName} onChange={(event) => handleProfileChange("firstName", event.target.value)} className="rounded-2xl" />
                        </LabelBlock>
                      </div>
                      <div>
                        <LabelBlock label="Apellido">
                          <Input value={profileForm.lastName} onChange={(event) => handleProfileChange("lastName", event.target.value)} className="rounded-2xl" />
                        </LabelBlock>
                      </div>
                    </div>

                    <LabelBlock label="Nombre visible">
                      <Input value={profileForm.displayName} onChange={(event) => handleProfileChange("displayName", event.target.value)} className="rounded-2xl" />
                    </LabelBlock>

                    <LabelBlock label="Correo electrónico">
                      <Input value={actor.email || ""} disabled className="rounded-2xl opacity-80" />
                    </LabelBlock>

                    <div className="flex flex-wrap gap-3">
                      <Button type="submit" className="rounded-2xl" disabled={savingProfile}>
                        {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {savingProfile ? "Guardando..." : "Guardar perfil"}
                      </Button>
                      <Button asChild variant="outline" className="rounded-2xl">
                        <Link href={buildLocalizedPath("/cursos", lang)}>Explorar cursos</Link>
                      </Button>
                    </div>
                  </form>
                </MotionStaggerItem>

                <MotionStaggerItem>
                  <div className="grid gap-4">
                    <div className="rounded-[26px] border border-[#D9E2F2] bg-[#F8FBFF] p-5">
                      <div className="text-lg font-bold text-[#1B2B50]">Resumen de tu cuenta</div>
                      <div className="mt-4 grid gap-4 text-sm text-slate-600">
                        <InfoRow icon={Mail} label="Email" value={actor.email} />
                        <InfoRow icon={User} label="Perfil" value={actor.displayName || `${actor.firstName || ""} ${actor.lastName || ""}`.trim() || "Sin nombre visible"} />
                        <InfoRow icon={MapPin} label="Rol" value="Alumno" />
                      </div>
                    </div>
                    <div className="rounded-[26px] border border-[#D9E2F2] bg-white p-5 shadow-[0_14px_34px_rgba(27,43,80,0.05)]">
                      <div className="text-lg font-bold text-[#1B2B50]">Siguientes pasos</div>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        Usa este espacio como continuidad del catálogo: guarda cursos, revisa estados y controla certificados y cobros.
                      </p>
                      <div className="mt-4 grid gap-3">
                        <ViewTransitionLink
                          href={buildLocalizedPath("/mis-cursos", lang)}
                          className="flex items-center justify-between rounded-[20px] border border-[#E6EBF4] bg-[#F8FBFF] px-4 py-3 text-sm font-semibold text-[#1B2B50] transition hover:border-[#BFD1F2] hover:bg-white"
                        >
                          <span className="flex items-center gap-3">
                            <BookOpen className="h-4 w-4 text-[#2356B8]" />
                            Revisar mis cursos guardados
                          </span>
                          <span>Ir</span>
                        </ViewTransitionLink>
                        <ViewTransitionLink
                          href={buildLocalizedPath("/mis-certificados", lang)}
                          className="flex items-center justify-between rounded-[20px] border border-[#E6EBF4] bg-[#F8FBFF] px-4 py-3 text-sm font-semibold text-[#1B2B50] transition hover:border-[#BFD1F2] hover:bg-white"
                        >
                          <span className="flex items-center gap-3">
                            <Award className="h-4 w-4 text-[#2356B8]" />
                            Ver certificados emitidos
                          </span>
                          <span>Ir</span>
                        </ViewTransitionLink>
                        <ViewTransitionLink
                          href={buildLocalizedPath("/historial-pagos", lang)}
                          className="flex items-center justify-between rounded-[20px] border border-[#E6EBF4] bg-[#F8FBFF] px-4 py-3 text-sm font-semibold text-[#1B2B50] transition hover:border-[#BFD1F2] hover:bg-white"
                        >
                          <span className="flex items-center gap-3">
                            <CreditCard className="h-4 w-4 text-[#2356B8]" />
                            Controlar pagos del campus
                          </span>
                          <span>Ir</span>
                        </ViewTransitionLink>
                      </div>
                    </div>
                  </div>
                </MotionStaggerItem>
              </MotionStagger>
            ) : view === "saved" ? (
              <div className="grid gap-4">
                {savedJobs.length ? (
                  <MotionStagger className="grid gap-4" delayChildren={0.04} staggerChildren={0.07}>
                    {savedJobs.map((savedJob) => (
                      <MotionStaggerItem key={savedJob.id}>
                        <article className="rounded-[24px] border border-[#D9E2F2] bg-[#F8FBFF] p-5 transition hover:border-[#BFD1F2] hover:bg-white">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge color="info" variant="soft" className="rounded-full">
                                  Guardado
                                </Badge>
                                <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                                  {savedJob.savedAt ? `Guardado el ${formatDate(savedJob.savedAt)}` : "Disponible para revisar"}
                                </span>
                              </div>
                              <h3 className="mt-3 text-xl font-bold tracking-tight text-[#1B2B50]">{savedJob.title || "Curso"}</h3>
                              <p className="mt-1 text-sm text-slate-600">
                                {savedJob.companyName || "Institucion"}{savedJob.city ? ` · ${savedJob.city}` : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              {savedJob.slug ? (
                                <Button asChild variant="outline" className="rounded-2xl">
                                  <Link href={buildLocalizedPath(`/cursos/${savedJob.slug}`, lang)}>Ver curso</Link>
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                variant="ghost"
                                className="rounded-2xl text-slate-600 hover:text-[#1B2B50]"
                                onClick={() => handleRemoveSavedJob(savedJob.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Quitar
                              </Button>
                            </div>
                          </div>
                        </article>
                      </MotionStaggerItem>
                    ))}
                  </MotionStagger>
                ) : (
                  <MotionStagger className="grid" delayChildren={0.02} staggerChildren={0.06}>
                    <MotionStaggerItem>
                      <div className="rounded-[24px] border border-dashed border-[#D9E2F2] bg-[#F8FBFF] p-8 text-center">
                        <div className="text-lg font-bold text-[#1B2B50]">Todavia no guardaste cursos</div>
                        <p className="mt-2 text-sm leading-7 text-slate-600">
                          Usa el boton Guardar desde cualquier curso para armar tu shortlist personal.
                        </p>
                        <Button asChild className="mt-5 rounded-2xl">
                          <Link href={buildLocalizedPath("/cursos", lang)}>Explorar cursos</Link>
                        </Button>
                      </div>
                    </MotionStaggerItem>
                  </MotionStagger>
                )}
              </div>
            ) : view === "applications" ? (
              <div className="grid gap-4">
                {applicationsLoading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="rounded-[24px] border border-[#D9E2F2] bg-[#F8FBFF] p-5">
                      <Skeleton className="h-4 w-36 rounded-full" />
                      <Skeleton className="mt-3 h-7 w-64 rounded-xl" />
                      <Skeleton className="mt-4 h-4 w-full rounded-xl" />
                    </div>
                  ))
                ) : applicationsError ? (
                  <Alert color="destructive" variant="soft" className="rounded-2xl border border-destructive/20 px-4 py-3">
                    <AlertDescription>{applicationsError}</AlertDescription>
                  </Alert>
                ) : applications.length ? (
                  <MotionStagger className="grid gap-4" delayChildren={0.04} staggerChildren={0.07}>
                    {applications.map((application) => (
                      <MotionStaggerItem key={application.id}>
                        <article className="rounded-[24px] border border-[#D9E2F2] bg-[#F8FBFF] p-5 transition hover:border-[#BFD1F2] hover:bg-white">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge color={applicationTone(String(application.status || ""))} variant="soft" className="rounded-full">
                                  {formatStatusLabel(application.status)}
                                </Badge>
                                <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                                  Inscripta el {formatDate(application.createdAt)}
                                </span>
                              </div>
                              <h3 className="mt-3 text-xl font-bold tracking-tight text-[#1B2B50]">{application.jobTitle || "Curso"}</h3>
                              <p className="mt-1 text-sm text-slate-600">{application.companyName || "Institucion"} · {application.city || "Ubicacion no informada"}</p>
                              {application.message ? (
                                <p className="mt-4 line-clamp-3 rounded-2xl border border-[#E6EBF4] bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                                  {application.message}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <Button asChild variant="outline" className="rounded-2xl">
                                <ViewTransitionLink href={buildLocalizedPath(`/mis-inscripciones/${application.id}`, lang)}>Ver detalle</ViewTransitionLink>
                              </Button>
                            </div>
                          </div>
                        </article>
                      </MotionStaggerItem>
                    ))}
                  </MotionStagger>
                ) : (
                  <MotionStagger className="grid" delayChildren={0.02} staggerChildren={0.06}>
                    <MotionStaggerItem>
                      <div className="rounded-[24px] border border-dashed border-[#D9E2F2] bg-[#F8FBFF] p-8 text-center">
                        <div className="text-lg font-bold text-[#1B2B50]">Todavia no tenes inscripciones</div>
                        <p className="mt-2 text-sm leading-7 text-slate-600">
                          Explora los cursos activos y empieza a guardar tu historial desde este portal.
                        </p>
                        <Button asChild className="mt-5 rounded-2xl">
                          <Link href={buildLocalizedPath("/cursos", lang)}>Explorar cursos</Link>
                        </Button>
                      </div>
                    </MotionStaggerItem>
                  </MotionStagger>
                )}
              </div>
            ) : view === "certificates" ? (
              <div className="grid gap-4">
                {applicationsLoading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="rounded-[24px] border border-[#D9E2F2] bg-[#F8FBFF] p-5">
                      <Skeleton className="h-4 w-36 rounded-full" />
                      <Skeleton className="mt-3 h-7 w-64 rounded-xl" />
                      <Skeleton className="mt-4 h-4 w-full rounded-xl" />
                    </div>
                  ))
                ) : applicationsError ? (
                  <Alert color="destructive" variant="soft" className="rounded-2xl border border-destructive/20 px-4 py-3">
                    <AlertDescription>{applicationsError}</AlertDescription>
                  </Alert>
                ) : certificateItems.length ? (
                  <MotionStagger className="grid gap-4" delayChildren={0.04} staggerChildren={0.07}>
                    {certificateItems.map((application) => (
                      <MotionStaggerItem key={application.id}>
                        <article className="rounded-[24px] border border-[#D9E2F2] bg-[#F8FBFF] p-5 transition hover:border-[#BFD1F2] hover:bg-white">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge color={application.certificateMeta.tone} variant="soft" className="rounded-full">
                                  {application.certificateMeta.label}
                                </Badge>
                                <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                                  Inscripción {formatStatusLabel(application.status)}
                                </span>
                              </div>
                              <h3 className="mt-3 text-xl font-bold tracking-tight text-[#1B2B50]">{application.jobTitle || "Curso"}</h3>
                              <p className="mt-1 text-sm text-slate-600">
                                {application.companyName || "Institución"} · {formatDate(application.createdAt)}
                              </p>
                              <p className="mt-4 rounded-2xl border border-[#E6EBF4] bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                                {application.certificateMeta.helper}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              {application.certificateMeta.downloadUrl ? (
                                <Button asChild variant="outline" className="rounded-2xl">
                                  <a href={application.certificateMeta.downloadUrl} target="_blank" rel="noreferrer">
                                    Descargar
                                  </a>
                                </Button>
                              ) : null}
                              <Button asChild variant="ghost" className="rounded-2xl text-slate-600 hover:text-[#1B2B50]">
                                <ViewTransitionLink href={buildLocalizedPath(`/mis-inscripciones/${application.id}`, lang)}>
                                  Ver inscripción
                                </ViewTransitionLink>
                              </Button>
                            </div>
                          </div>
                        </article>
                      </MotionStaggerItem>
                    ))}
                  </MotionStagger>
                ) : (
                  <MotionStagger className="grid" delayChildren={0.02} staggerChildren={0.06}>
                    <MotionStaggerItem>
                      <div className="rounded-[24px] border border-dashed border-[#D9E2F2] bg-[#F8FBFF] p-8 text-center">
                        <div className="text-lg font-bold text-[#1B2B50]">Todavía no hay certificados registrados</div>
                        <p className="mt-2 text-sm leading-7 text-slate-600">
                          Cuando una institución publique una constancia o certificado, aparecerá aquí con acceso directo.
                        </p>
                        <Button asChild className="mt-5 rounded-2xl">
                          <Link href={buildLocalizedPath("/mis-inscripciones", lang)}>Ver mis inscripciones</Link>
                        </Button>
                      </div>
                    </MotionStaggerItem>
                  </MotionStagger>
                )}
              </div>
            ) : view === "payments" ? (
              <div className="grid gap-4">
                {applicationsLoading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="rounded-[24px] border border-[#D9E2F2] bg-[#F8FBFF] p-5">
                      <Skeleton className="h-4 w-36 rounded-full" />
                      <Skeleton className="mt-3 h-7 w-64 rounded-xl" />
                      <Skeleton className="mt-4 h-4 w-full rounded-xl" />
                    </div>
                  ))
                ) : applicationsError ? (
                  <Alert color="destructive" variant="soft" className="rounded-2xl border border-destructive/20 px-4 py-3">
                    <AlertDescription>{applicationsError}</AlertDescription>
                  </Alert>
                ) : paymentItems.length ? (
                  <MotionStagger className="grid gap-4" delayChildren={0.04} staggerChildren={0.07}>
                    {paymentItems.map((application) => (
                      <MotionStaggerItem key={application.id}>
                        <article className="rounded-[24px] border border-[#D9E2F2] bg-[#F8FBFF] p-5 transition hover:border-[#BFD1F2] hover:bg-white">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge color={application.paymentMeta.tone} variant="soft" className="rounded-full">
                                  {application.paymentMeta.label}
                                </Badge>
                                <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                                  {application.paymentMeta.amountLabel}
                                </span>
                              </div>
                              <h3 className="mt-3 text-xl font-bold tracking-tight text-[#1B2B50]">{application.jobTitle || "Curso"}</h3>
                              <p className="mt-1 text-sm text-slate-600">
                                {application.companyName || "Institución"} · {formatDate(application.createdAt)}
                              </p>
                              <p className="mt-4 rounded-2xl border border-[#E6EBF4] bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                                {application.paymentMeta.helper}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              {application.paymentMeta.receiptUrl ? (
                                <Button asChild variant="outline" className="rounded-2xl">
                                  <a href={application.paymentMeta.receiptUrl} target="_blank" rel="noreferrer">
                                    Ver comprobante
                                  </a>
                                </Button>
                              ) : null}
                              <Button asChild variant="ghost" className="rounded-2xl text-slate-600 hover:text-[#1B2B50]">
                                <ViewTransitionLink href={buildLocalizedPath(`/mis-inscripciones/${application.id}`, lang)}>
                                  Ver inscripción
                                </ViewTransitionLink>
                              </Button>
                            </div>
                          </div>
                        </article>
                      </MotionStaggerItem>
                    ))}
                  </MotionStagger>
                ) : (
                  <MotionStagger className="grid" delayChildren={0.02} staggerChildren={0.06}>
                    <MotionStaggerItem>
                      <div className="rounded-[24px] border border-dashed border-[#D9E2F2] bg-[#F8FBFF] p-8 text-center">
                        <div className="text-lg font-bold text-[#1B2B50]">Todavía no hay pagos registrados</div>
                        <p className="mt-2 text-sm leading-7 text-slate-600">
                          Este historial se alimentará cuando tu institución confirme cobros o cargue comprobantes dentro del campus.
                        </p>
                        <Button asChild className="mt-5 rounded-2xl">
                          <Link href={buildLocalizedPath("/cursos", lang)}>Explorar cursos</Link>
                        </Button>
                      </div>
                    </MotionStaggerItem>
                  </MotionStagger>
                )}
              </div>
            ) : detailLoading ? (
              <ApplicationDetailSkeleton />
            ) : detailError ? (
              <Alert color="destructive" variant="soft" className="rounded-2xl border border-destructive/20 px-4 py-3">
                <AlertDescription>{detailError}</AlertDescription>
              </Alert>
            ) : selectedApplication ? (
              <MotionStagger className="grid" delayChildren={0.04} staggerChildren={0.08}>
                <MotionStaggerItem>
                  <article className="rounded-[28px] border border-[#D9E2F2] bg-white p-6 shadow-[0_16px_36px_rgba(27,43,80,0.06)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge color={applicationTone(String(selectedApplication.status || ""))} variant="soft" className="rounded-full">
                            {formatStatusLabel(selectedApplication.status)}
                          </Badge>
                          <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                            Seguimiento individual
                          </span>
                        </div>
                        <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-[#1B2B50]">
                          {selectedApplication.jobTitle || listedSelectedApplication?.jobTitle || "Detalle de inscripcion"}
                        </h2>
                        <p className="mt-2 text-sm leading-7 text-slate-600">
                          Visualiza exactamente que datos enviaste y el estado actual de esta propuesta.
                        </p>
                      </div>
                      <Button asChild type="button" variant="ghost" className="rounded-2xl">
                        <ViewTransitionLink href={buildLocalizedPath("/mis-inscripciones", lang)}>
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          Volver
                        </ViewTransitionLink>
                      </Button>
                    </div>

                    <ApplicationTimeline timeline={applicationTimeline} />

                    <div className="mt-6 grid gap-3">
                      <DetailRow icon={Building2} label="Institucion" value={selectedApplication.companyName || "No informada"} />
                      <DetailRow icon={Calendar} label="Fecha de inscripcion" value={formatDate(selectedApplication.createdAt)} />
                      <DetailRow icon={Mail} label="Email enviado" value={selectedApplication.email || actor.email || "No informado"} />
                      <DetailRow icon={Phone} label="Teléfono" value={selectedApplication.phone || "No informado"} />
                      <DetailRow icon={MapPin} label="Ubicación" value={[selectedApplication.city, selectedApplication.province].filter(Boolean).join(", ") || "No informada"} />
                    </div>

                    {selectedApplication.message ? (
                      <div className="mt-6 rounded-[24px] border border-[#E6EBF4] bg-[#F8FBFF] p-5">
                        <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#5B6D93]">Mensaje enviado</div>
                        <p className="mt-3 text-sm leading-7 text-slate-600">{selectedApplication.message}</p>
                      </div>
                    ) : null}

                    <div className="mt-6 grid gap-3 md:grid-cols-2">
                      <DetailLinkCard icon={FileText} title="CV adjunto" href={selectedApplication.cvUrl} actionLabel="Abrir CV" />
                      <DetailLinkCard icon={Link2} title="LinkedIn" href={selectedApplication.linkedinUrl} actionLabel="Abrir perfil" />
                      <DetailLinkCard icon={ExternalLink} title="Portfolio" href={selectedApplication.portfolioUrl} actionLabel="Abrir portfolio" />
                      <div className="rounded-[22px] border border-[#E6EBF4] bg-[#F8FBFF] p-4">
                        <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#5B6D93]">Privacidad</div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Esta inscripcion se registro con tus consentimientos obligatorios validados.
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <Button asChild className="rounded-2xl">
                        <Link href={buildLocalizedPath("/cursos", lang)}>Explorar mas cursos</Link>
                      </Button>
                      <Button asChild variant="outline" className="rounded-2xl">
                        <ViewTransitionLink href={buildLocalizedPath("/mis-inscripciones", lang)}>Volver al listado</ViewTransitionLink>
                      </Button>
                    </div>
                  </article>
                </MotionStaggerItem>
              </MotionStagger>
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#D9E2F2] bg-[#F8FBFF] p-8 text-center">
                <div className="text-lg font-bold text-[#1B2B50]">No encontramos esa inscripcion</div>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Proba volviendo al listado y seleccionando otra inscripcion.
                </p>
                <Button asChild className="mt-5 rounded-2xl">
                  <ViewTransitionLink href={buildLocalizedPath("/mis-inscripciones", lang)}>Ir a mis inscripciones</ViewTransitionLink>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function PortalBreadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-medium text-white/55">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <div key={`${item.label}-${index}`} className="flex items-center gap-2">
            {item.href && !isLast ? (
              <Link href={item.href} className="transition hover:text-white">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-white" : ""}>{item.label}</span>
            )}
            {!isLast ? <span className="text-white/25">/</span> : null}
          </div>
        );
      })}
    </nav>
  );
}

function LabelBlock({ label, children }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-[#344054]">{label}</span>
      {children}
    </label>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-[20px] border border-[#E6EBF4] bg-white p-4">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2356B8]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
        <div className="mt-1 break-words text-sm font-semibold leading-6 text-[#1B2B50]">{value || "No informado"}</div>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-[22px] border border-[#E6EBF4] bg-[#F8FBFF] p-4">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#2356B8] shadow-[0_10px_24px_rgba(35,86,184,0.08)]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
        <div className="mt-1 break-words text-sm font-semibold leading-6 text-[#1B2B50]">{value || "No informado"}</div>
      </div>
    </div>
  );
}

function DetailLinkCard({ icon: Icon, title, href, actionLabel }) {
  const hasHref = Boolean(String(href || "").trim());

  return (
    <div className="rounded-[22px] border border-[#E6EBF4] bg-[#F8FBFF] p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#2356B8] shadow-[0_10px_24px_rgba(35,86,184,0.08)]">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#5B6D93]">{title}</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {hasHref ? "Tu archivo o enlace quedo asociado a esta inscripcion." : "No registraste este recurso en la inscripcion."}
          </p>
          {hasHref ? (
            <Button asChild variant="outline" className="mt-4 rounded-2xl">
              <a href={href} target="_blank" rel="noreferrer">
                {actionLabel}
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ApplicationTimeline({ timeline }) {
  if (!timeline) return null;

  return (
    <div className="mt-6 rounded-[26px] border border-[#D9E2F2] bg-[linear-gradient(180deg,#FCFDFF_0%,#F7FAFF_100%)] p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#5B6D93]">Estado del proceso</div>
          <div className="mt-2 text-lg font-bold tracking-tight text-[#1B2B50]">Seguimiento visual de tu inscripcion</div>
        </div>
        {timeline.isClosed ? (
          <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
            {timeline.closingLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        {timeline.steps.map((step, index) => (
          <div key={step.id} className="relative rounded-[22px] border border-[#E6EBF4] bg-white p-4">
            {index < timeline.steps.length - 1 ? (
              <span className="pointer-events-none absolute right-[-12px] top-7 hidden h-px w-6 bg-[#D7E3FA] md:block" />
            ) : null}
            <div
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold",
                step.state === "done"
                  ? "border-[#BCD2FF] bg-[#E8F0FF] text-[#1B2B50]"
                  : step.state === "current"
                    ? "border-[#1B2B50] bg-[#1B2B50] text-white"
                    : "border-[#E6EBF4] bg-[#F8FBFF] text-slate-400"
              )}
            >
              {index + 1}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="text-sm font-bold text-[#1B2B50]">{step.label}</div>
              <span
                className={cn(
                  "inline-flex h-2.5 w-2.5 rounded-full",
                  step.state === "done" ? "bg-emerald-500" : step.state === "current" ? "bg-amber-500" : "bg-slate-300"
                )}
              />
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{step.helper}</p>
          </div>
        ))}
      </div>

      {timeline.isClosed ? (
        <div className="mt-4 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
          {timeline.closingHelper}
        </div>
      ) : null}
    </div>
  );
}

function ApplicationDetailSkeleton() {
  return (
    <div className="rounded-[28px] border border-[#D9E2F2] bg-white p-6 shadow-[0_16px_36px_rgba(27,43,80,0.06)]">
      <Skeleton className="h-5 w-32 rounded-full" />
      <Skeleton className="mt-4 h-8 w-64 rounded-xl" />
      <Skeleton className="mt-3 h-4 w-full rounded-xl" />
      <div className="mt-6 grid gap-3">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-20 rounded-[22px]" />
        ))}
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-32 rounded-[22px]" />
        ))}
      </div>
    </div>
  );
}
