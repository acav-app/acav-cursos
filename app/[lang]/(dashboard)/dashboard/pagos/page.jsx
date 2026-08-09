"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, CreditCard, Loader2, Receipt, RotateCcw, Wallet, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/provider/auth.provider";
import { authedFetch, asArray } from "@/lib/auth/authed-fetch";
import { useLocalizedPath } from "@/lib/utils";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { DashboardPageShellSkeleton } from "@/components/courses/dashboard/page-skeletons";

function dateLabel(value) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-AR");
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

function resolvePaymentMeta(enrollment) {
  const paymentStatus = String(enrollment?.paymentStatus || enrollment?.payment?.status || "").trim().toLowerCase();
  const amount =
    enrollment?.paymentAmount ??
    enrollment?.payment?.amount ??
    enrollment?.amount ??
    enrollment?.coursePrice ??
    enrollment?.price ??
    "";
  const receiptUrl = String(enrollment?.paymentReceiptUrl || enrollment?.payment?.receiptUrl || "").trim();
  const paidAt = enrollment?.paidAt || enrollment?.payment?.paidAt || enrollment?.paymentDate || "";
  const enrollmentStatus = String(enrollment?.status || "").trim().toLowerCase();

  if (["pagado", "paid", "completed", "acreditado", "accredited", "approved"].includes(paymentStatus)) {
    return {
      label: "Acreditado",
      tone: "success",
      helper: paidAt ? `Confirmado el ${dateLabel(paidAt)}.` : "Pago confirmado.",
      amountLabel: formatCurrency(amount),
      receiptUrl,
    };
  }

  if (["pendiente", "pending", "processing", "in_process", "under_review"].includes(paymentStatus)) {
    return {
      label: "Pendiente",
      tone: "warning",
      helper: "A la espera de revisión.",
      amountLabel: formatCurrency(amount),
      receiptUrl,
    };
  }

  if (["rechazado", "rejected", "failed", "cancelled", "canceled"].includes(paymentStatus)) {
    return {
      label: "Sin acreditar",
      tone: "destructive",
      helper: "Requiere una nueva gestión.",
      amountLabel: formatCurrency(amount),
      receiptUrl,
    };
  }

  if (["descartada", "rechazada"].includes(enrollmentStatus)) {
    return {
      label: "Sin cargo",
      tone: "info",
      helper: "Inscripción cerrada.",
      amountLabel: formatCurrency(amount),
      receiptUrl,
    };
  }

  return {
    label: "Conciliación manual",
    tone: "info",
    helper: "Pendiente de confirmación.",
    amountLabel: formatCurrency(amount),
    receiptUrl,
  };
}

export default function DashboardPagosPage() {
  const buildLocalizedPath = useLocalizedPath();
  const { user } = useAuth();
  const { actor, loading: actorLoading, error: actorError } = useCourseActor();
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [query, setQuery] = useState("");
  const [courseId, setCourseId] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [paymentState, setPaymentState] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!user) return;
      setLoading(true);

      try {
        const [enrollmentsData, coursesData, institutionsData] = await Promise.all([
          authedFetch(user, "/api/enrollments", { method: "GET" }),
          authedFetch(user, "/api/courses", { method: "GET" }),
          authedFetch(user, "/api/institutions", { method: "GET" }),
        ]);

        if (!alive) return;

        setEnrollments(asArray(enrollmentsData?.enrollments));
        setCourses(asArray(coursesData?.courses));
        setInstitutions(asArray(institutionsData?.institutions));
      } catch (error) {
        toast.error(error?.message || "No pudimos cargar el módulo de pagos.", { position: "top-right" });
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [user]);

  const rows = useMemo(
    () =>
      enrollments.map((enrollment) => ({
        ...enrollment,
        paymentMeta: resolvePaymentMeta(enrollment),
      })),
    [enrollments]
  );

  const filtered = useMemo(() => {
    const normalizedQuery = String(query || "").trim().toLowerCase();

    return rows
      .filter((row) => (paymentState ? row.paymentMeta.label === paymentState : true))
      .filter((row) => (courseId ? String(row.courseId || row.jobId || "") === courseId : true))
      .filter((row) => (institutionId ? String(row.institutionId || row.companyId || "") === institutionId : true))
      .filter((row) => {
        if (!normalizedQuery) return true;

        return [
          row.jobTitle,
          row.companyName,
          row.email,
          row.candidateName,
          [row.firstName, row.lastName].filter(Boolean).join(" "),
        ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
      });
  }, [courseId, institutionId, paymentState, query, rows]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const credited = filtered.filter((row) => row.paymentMeta.label === "Acreditado").length;
    const pending = filtered.filter((row) => ["Pendiente", "Conciliación manual"].includes(row.paymentMeta.label)).length;
    const noCharge = filtered.filter((row) => row.paymentMeta.label === "Sin cargo").length;
    return { total, credited, pending, noCharge };
  }, [filtered]);

  const syncEnrollment = (updatedEnrollment) => {
    if (!updatedEnrollment?.id) return;
    setEnrollments((current) =>
      current.map((item) => (item.id === updatedEnrollment.id ? updatedEnrollment : item))
    );
  };

  const handleQuickAction = async (row, action) => {
    if (!user || !row?.id) return;

    const payloadByAction = {
      approve: {
        status: "active",
        paymentStatus: "approved",
        approvedBy: user?.email || user?.uid || "admin",
      },
      request_receipt: {
        status: "waiting_payment",
        paymentStatus: "rejected",
      },
      reject: {
        status: "rejected",
        paymentStatus: "rejected",
      },
    };

    const payload = payloadByAction[action];
    if (!payload) return;

    try {
      setActionLoadingId(String(row.id));
      const data = await authedFetch(user, `/api/enrollments/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...payload,
          reviewedBy: user?.email || user?.uid || "admin",
        }),
      });
      syncEnrollment(data?.enrollment);
      toast.success(
        action === "approve"
          ? "Pago aprobado y curso activado."
          : action === "request_receipt"
            ? "Se solicitó un nuevo comprobante."
            : "Inscripción rechazada.",
        { position: "top-right" }
      );
    } catch (error) {
      toast.error(error?.message || "No pudimos actualizar el pago.", {
        position: "top-right",
      });
    } finally {
      setActionLoadingId("");
    }
  };

  if (actorLoading || loading) {
    return <DashboardPageShellSkeleton showHeaderAction={false} filterColumns={4} rowCount={6} />;
  }

  if (actorError) {
    return (
      <div className="mx-auto px-2 py-8">
        <div className="rounded-3xl border border-border/60 bg-card p-8">
          <h1 className="text-2xl font-bold text-foreground">No se pudo cargar el perfil</h1>
          <p className="mt-3 text-sm text-muted-foreground">{actorError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto px-2 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Pagos</div>
          <h1 className="mt-3 text-3xl font-bold text-foreground">Pagos</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {actor?.role === "admin"
              ? "Revisa estados y resuelve pagos pendientes."
              : "Consulta el estado de tus pagos desde una vista simple."}
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-border/60 bg-card p-6">
        <div className="grid gap-3 md:grid-cols-4">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por curso, email o alumno" />
          <Select value={courseId} onValueChange={(value) => setCourseId(value === "all" ? "" : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por curso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={institutionId}
            onValueChange={(value) => setInstitutionId(value === "all" ? "" : value)}
            disabled={actor?.role !== "admin"}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por institución" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {institutions.map((institution) => (
                <SelectItem key={institution.id} value={institution.id}>
                  {institution.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={paymentState} onValueChange={(value) => setPaymentState(value === "all" ? "" : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Estado financiero" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Acreditado">Acreditado</SelectItem>
              <SelectItem value="Pendiente">Pendiente</SelectItem>
              <SelectItem value="Conciliación manual">Conciliación manual</SelectItem>
              <SelectItem value="Sin cargo">Sin cargo</SelectItem>
              <SelectItem value="Sin acreditar">Sin acreditar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <MetricCard icon={Wallet} label="Registros" value={String(summary.total)} helper="Total visible" />
          <MetricCard icon={CreditCard} label="Acreditados" value={String(summary.credited)} helper="Pagos confirmados" />
          <MetricCard icon={Receipt} label="Pendientes" value={String(summary.pending)} helper="En revisión" />
          <MetricCard icon={Wallet} label="Sin cargo" value={String(summary.noCharge)} helper="Sin cobro" />
        </div>

        <div className="mt-2 text-sm text-muted-foreground">{filtered.length} resultado(s)</div>

        <div className="mt-6 grid gap-4">
          {filtered.length ? (
            filtered.map((row) => (
              <article key={row.id} className="rounded-3xl border border-border/60 bg-background p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge color={row.paymentMeta.tone} variant="soft" className="rounded-full">
                        {row.paymentMeta.label}
                      </Badge>
                      <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        {row.paymentMeta.amountLabel}
                      </span>
                    </div>
                    <h2 className="mt-3 text-lg font-semibold text-foreground">{row.jobTitle || "Curso"}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.companyName || "Institución"} · {[row.firstName, row.lastName].filter(Boolean).join(" ").trim() || row.candidateName || row.email}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {dateLabel(row.createdAt)} · {row.email || "Sin email"}
                    </p>
                    <p className="mt-4 rounded-2xl border border-border/50 bg-card px-4 py-3 text-sm text-muted-foreground">
                      {row.paymentMeta.helper}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {row.paymentMeta.receiptUrl ? (
                      <Button asChild variant="outline">
                        <a href={row.paymentMeta.receiptUrl} target="_blank" rel="noreferrer">
                          Ver comprobante
                        </a>
                      </Button>
                    ) : null}
                    {actor?.role === "admin" ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleQuickAction(row, "approve")}
                          disabled={actionLoadingId === String(row.id)}
                          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        >
                          {actionLoadingId === String(row.id) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                          Aprobar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleQuickAction(row, "request_receipt")}
                          disabled={actionLoadingId === String(row.id)}
                          className="border-amber-200 text-amber-700 hover:bg-amber-50"
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Nuevo comprobante
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleQuickAction(row, "reject")}
                          disabled={actionLoadingId === String(row.id)}
                          className="border-rose-200 text-rose-700 hover:bg-rose-50"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Rechazar
                        </Button>
                      </>
                    ) : null}
                    <Button asChild variant="ghost">
                      <Link href={buildLocalizedPath(`/dashboard/inscripciones/${row.id}`)}>Ver inscripción</Link>
                    </Button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-border/60 bg-background p-8 text-center">
              <div className="text-lg font-semibold text-foreground">No hay registros financieros para mostrar.</div>
              <p className="mt-2 text-sm text-muted-foreground">Ajusta los filtros o espera nuevas inscripciones para revisar pagos.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, helper }) {
  const ResolvedIcon = typeof Icon === "function" ? Icon : null;

  return (
    <div className="rounded-3xl border border-border/60 bg-background p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {ResolvedIcon ? <ResolvedIcon className="h-5 w-5" /> : <span className="text-base font-semibold">•</span>}
        </span>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{helper}</p>
    </div>
  );
}
