"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  Receipt,
  RotateCcw,
  DollarSign,
  XCircle,
  FileText,
  HelpCircle,
  FileDown,
  Save,
  Upload,
  Eye,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { DataTableEnhanced } from "@/components/ui/data-table-enhanced";
import { useAuth } from "@/provider/auth.provider";
import { authedFetch, asArray } from "@/lib/auth/authed-fetch";
import { useLocalizedPath } from "@/lib/utils";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { DashboardPageShellSkeleton } from "@/components/courses/dashboard/page-skeletons";
import {
  PAYMENT_STATUSES,
} from "@/lib/courses/constants";
import { uploadToR2 } from "@/components/courses/dashboard/upload";
import { normalizePublicR2Url } from "@/lib/r2/normalize-public-url";

function isImageReceipt(url) {
  const clean = String(url || "").split("?")[0].split("#")[0].toLowerCase();
  return /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?|$|#)/i.test(clean);
}

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

function titleCase(value, fallback = "-") {
  const normalized = String(value || "")
    .replaceAll("_", " ")
    .trim();
  if (!normalized) return fallback;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function paymentStatusLabel(value) {
  const labels = {
    approved: "Aprobado",
    pending: "Pendiente",
    under_review: "En revisión",
    rejected: "Rechazado",
    failed: "Fallido",
    cancelled: "Cancelado",
    canceled: "Cancelado",
    paid: "Pagado",
    completed: "Completado",
    waiting_payment: "Esperando pago",
  };
  const normalized = String(value || "").trim().toLowerCase();
  return labels[normalized] || titleCase(value);
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
  const router = useRouter();
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
  const [editingPaymentId, setEditingPaymentId] = useState("");
  const [editPaymentStatus, setEditPaymentStatus] = useState("");
  const [editReviewComment, setEditReviewComment] = useState("");
  const [editReceiptUrl, setEditReceiptUrl] = useState("");
  const [editReceiptUploading, setEditReceiptUploading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const editReceiptInputRef = useRef(null);

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

  const columns = useMemo(() => {
    return [
      {
        id: "payer",
        header: "Alumno",
        accessorKey: "email",
        enableSorting: true,
        meta: { enableColumnFilter: true },
        size: 280,
        cell: ({ row }) => {
          const item = row.original;
          const name =
            [item.firstName, item.lastName].filter(Boolean).join(" ").trim() ||
            item.candidateName ||
            item.studentName ||
            item.email ||
            "Postulante";
          return (
            <div className="flex min-w-0 items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#047857] ring-1 ring-[#A7F3D0]">
                <DollarSign className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[#0F172A]">{name}</div>
                <div className="truncate text-xs text-[#64748B]">{item.email || "-"}</div>
                {item.documentNumber || item.phone ? (
                  <div className="mt-0.5 truncate text-[11px] text-[#94A3B8]">
                    {[
                      item.documentNumber ? `DNI ${item.documentNumber}` : "",
                      item.phone ? `Tel ${item.phone}` : "",
                    ].filter(Boolean).join(" · ")}
                  </div>
                ) : null}
              </div>
            </div>
          );
        },
      },
      {
        id: "course",
        header: "Curso / Institución",
        accessorKey: "courseTitle",
        enableSorting: true,
        meta: { enableColumnFilter: true },
        size: 240,
        cell: ({ row }) => {
          const item = row.original;
          const title = item.courseTitle || item.jobTitle || "Curso";
          const institution = item.institutionName || item.companyName || "ACAV";
          return (
            <div className="grid gap-0.5 text-sm">
              <div className="truncate font-semibold text-[#0F172A]">{title}</div>
              <div className="truncate text-xs text-[#64748B]">{institution}</div>
            </div>
          );
        },
      },
      {
        id: "amount",
        header: "Importe",
        accessorKey: "paymentAmount",
        enableSorting: true,
        meta: { enableColumnFilter: false },
        size: 160,
        cell: ({ row }) => (
          <div className="text-sm font-semibold text-[#0F172A]">
            {row.original.paymentMeta.amountLabel}
          </div>
        ),
      },
      {
        id: "status",
        header: "Estado",
        accessorKey: "paymentStatus",
        enableSorting: true,
        meta: { enableColumnFilter: true },
        size: 200,
        cell: ({ row }) => {
          const meta = row.original.paymentMeta;
          let Icon = HelpCircle;
          if (meta.label === "Acreditado") Icon = CheckCircle2;
          else if (meta.label === "Pendiente" || meta.label === "Conciliación manual") Icon = Clock3;
          else if (meta.label === "Sin acreditar") Icon = XCircle;
          else if (meta.label === "Sin cargo") Icon = FileText;
          return (
            <div className="grid gap-1.5">
              <Badge
                color={meta.tone}
                variant="soft"
                className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11px]"
              >
                <Icon className="h-3 w-3" />
                {meta.label}
              </Badge>
              <span className="text-[11px] leading-5 text-[#64748B]">{meta.helper}</span>
            </div>
          );
        },
      },
      {
        id: "createdAt",
        header: "Fecha",
        accessorKey: "createdAt",
        enableSorting: true,
        meta: { enableColumnFilter: false },
        size: 160,
        cell: ({ row }) => (
          <div className="text-sm text-[#475569]">{dateLabel(row.original.createdAt)}</div>
        ),
      },
      {
        id: "actions",
        header: "Acciones",
        enableSorting: false,
        meta: { enableColumnFilter: false },
        size: 420,
        cell: ({ row }) => {
          const item = row.original;
          const loading = actionLoadingId === String(item.id);
          const detailHref = buildLocalizedPath(`/dashboard/inscripciones/${item.id}`);
          const normalizedPaymentStatus = String(
            item.paymentStatus || item.payment?.status || ""
          ).trim().toLowerCase();
          const normalizedEnrollmentStatus = String(item.status || "").trim().toLowerCase();
          const isCredited = ["approved", "paid", "pagado", "completed", "acreditado", "accredited"].includes(normalizedPaymentStatus);
          const isRejected = ["rejected", "rechazado", "failed", "cancelled", "canceled"].includes(normalizedPaymentStatus);
          const isClosed = ["rejected", "descartada", "rechazada", "cancelled", "canceled"].includes(normalizedEnrollmentStatus);
          const canApprove = !isCredited && !isClosed;
          const canRequestReceipt = !isCredited && !isClosed;
          const canReject = !isCredited && !isRejected && !isClosed;
          return (
            <div
              className="flex flex-wrap items-center justify-end gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              {item.paymentMeta.receiptUrl ? (
                <div className="flex items-center gap-2">
                  {isImageReceipt(item.paymentMeta.receiptUrl) ? (
                    <img src={item.paymentMeta.receiptUrl} alt="" className="h-10 w-10 rounded-lg object-cover border border-slate-200" />
                  ) : (
                    <FileText className="h-10 w-10 text-slate-400" />
                  )}
                  <Button
                    asChild
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-2xl border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
                  >
                    <a href={item.paymentMeta.receiptUrl} target="_blank" rel="noreferrer">
                      <Receipt className="mr-1.5 h-3.5 w-3.5" />
                      Comprobante
                    </a>
                  </Button>
                </div>
              ) : null}

              {actor?.role === "admin" ? (
                <>
                  {canApprove ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleQuickAction(item, "approve")}
                      disabled={loading}
                      className="h-9 rounded-2xl border-[#A7F3D0] bg-white text-[#047857] hover:bg-[#ECFDF5]"
                    >
                      {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                      Aprobar
                    </Button>
                  ) : null}
                  {canRequestReceipt ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleQuickAction(item, "request_receipt")}
                      disabled={loading}
                      className="h-9 rounded-2xl border-[#FDE68A] bg-white text-[#B45309] hover:bg-[#FFFBEB]"
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      Nuevo comprobante
                    </Button>
                  ) : null}
                  {canReject ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleQuickAction(item, "reject")}
                      disabled={loading}
                      className="h-9 rounded-2xl border-[#FECDD3] bg-white text-[#B91C1C] hover:bg-[#FFF1F2]"
                    >
                      <XCircle className="mr-1.5 h-3.5 w-3.5" />
                      Rechazar
                    </Button>
                  ) : null}
                  {isCredited ? (
                    <Badge variant="soft" color="success" className="h-9 rounded-2xl px-3">
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Pago aprobado
                    </Badge>
                  ) : isRejected ? (
                    <Badge variant="soft" color="destructive" className="h-9 rounded-2xl px-3">
                      <XCircle className="mr-1.5 h-3.5 w-3.5" />
                      Pago rechazado
                    </Badge>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={() => handleOpenEditPayment(item)}
                    className="h-9 rounded-2xl bg-[#111827] text-white hover:bg-[#0B1220]"
                  >
                    <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                    Editar pago
                  </Button>
                </>
              ) : null}

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleOpenEditPayment(item)}
                className="h-9 rounded-2xl border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
                aria-label="Ver detalles"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor?.role, actionLoadingId, buildLocalizedPath, router]);

  const searchableColumnKeys = useMemo(
    () => [
      "email",
      "firstName",
      "lastName",
      "candidateName",
      "studentName",
      "documentNumber",
      "phone",
      "courseId",
      "courseTitle",
      "jobId",
      "jobTitle",
      "institutionId",
      "institutionName",
      "companyId",
      "companyName",
      "paymentStatus",
    ],
    []
  );

  const syncEnrollment = (updatedEnrollment) => {
    if (!updatedEnrollment?.id) return;
    setEnrollments((current) =>
      current.map((item) => (item.id === updatedEnrollment.id ? updatedEnrollment : item))
    );
  };

  const editingRow = useMemo(
    () => enrollments.find((r) => String(r.id) === String(editingPaymentId || "")) || null,
    [enrollments, editingPaymentId]
  );
  const editingPaymentStatus = String(
    editingRow?.paymentStatus || editingRow?.payment?.status || ""
  ).trim().toLowerCase();
  const editingPaymentApproved = [
    "approved",
    "paid",
    "pagado",
    "completed",
    "acreditado",
    "accredited",
  ].includes(editingPaymentStatus);

  const handleOpenEditPayment = (row) => {
    if (!row?.id) return;
    const paymentStatus = String(row.paymentStatus || "");
    const reviewComment = String(row.payment?.reviewComment || "");
    const receiptUrl = String(
      row.paymentReceiptUrl || row.payment?.receiptUrl || ""
    );
    setEditingPaymentId(String(row.id));
    setEditPaymentStatus(paymentStatus);
    setEditReviewComment(reviewComment);
    setEditReceiptUrl(receiptUrl);
  };

  const handleCloseEditPayment = () => {
    setEditingPaymentId("");
    setEditPaymentStatus("");
    setEditReviewComment("");
    setEditReceiptUrl("");
    setEditReceiptUploading(false);
    setSavingEdit(false);
  };

  const handleEditReceiptUpload = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file || !editingPaymentId || !user) return;
    try {
      setEditReceiptUploading(true);
      const uploaded = await uploadToR2(file, { folder: `enrollments/${editingPaymentId}` });
      const publicUrl = normalizePublicR2Url(uploaded?.downloadUrl || uploaded?.url);
      setEditReceiptUrl(publicUrl);
      toast.success("Comprobante adjuntado correctamente.", { position: "top-right" });
    } catch (error) {
      toast.error(error?.message || "No se pudo subir el comprobante.", { position: "top-right" });
    } finally {
      setEditReceiptUploading(false);
      if (editReceiptInputRef.current) editReceiptInputRef.current.value = "";
    }
  };

  const handleSaveEditPayment = async () => {
    if (!user || !editingPaymentId) return;
    try {
      setSavingEdit(true);
      const payload = {
        paymentStatus: editPaymentStatus || undefined,
        reviewComment: editReviewComment?.trim() || undefined,
        paymentReceiptUrl: editReceiptUrl?.trim() || undefined,
        reviewedBy: user?.email || user?.uid || "admin",
      };
      await authedFetch(user, `/api/enrollments/${editingPaymentId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      // Ensure we have the latest enrollment (with paymentReceiptUrl persisted)
      const fresh = await authedFetch(user, `/api/enrollments/${editingPaymentId}`, { method: "GET" });
      syncEnrollment(fresh?.enrollment);
      setEditReceiptUrl(String((fresh?.enrollment?.paymentReceiptUrl || fresh?.enrollment?.payment?.receiptUrl) || "").trim());
      toast.success("Cambios guardados correctamente.", { position: "top-right" });
      handleCloseEditPayment();
    } catch (error) {
      toast.error(error?.message || "No se pudieron guardar los cambios.", { position: "top-right" });
    } finally {
      setSavingEdit(false);
    }
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
    <div className="mx-auto px-2 py-8 space-y-6">
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

      <section className="rounded-[28px] border border-[#E5E7EB] bg-[#FFFFFF] p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)] md:p-7">
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por curso, email o alumno"
            className="h-11 rounded-2xl bg-white"
          />
          <Select value={courseId} onValueChange={(value) => setCourseId(value === "all" ? "" : value)}>
            <SelectTrigger className="h-11 rounded-2xl bg-white">
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
            <SelectTrigger className="h-11 rounded-2xl bg-white">
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
            <SelectTrigger className="h-11 rounded-2xl bg-white">
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

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <MetricCard icon={DollarSign} label="Registros" value={String(summary.total)} helper="Total visible" />
          <MetricCard icon={CreditCard} label="Acreditados" value={String(summary.credited)} helper="Pagos confirmados" />
          <MetricCard icon={Receipt} label="Pendientes" value={String(summary.pending)} helper="En revisión" />
          <MetricCard icon={DollarSign} label="Sin cargo" value={String(summary.noCharge)} helper="Sin cobro" />
        </div>
      </section>

      <DataTableEnhanced
        data={filtered}
        columns={columns}
        searchPlaceholder="Buscar pago por alumno, curso, email, DNI, teléfono o institución"
        searchableColumnKeys={searchableColumnKeys}
        defaultPageSize={20}
        defaultSorting={[{ id: "createdAt", desc: true }]}
        showFiltersRow
        showColumnVisibility
        emptyTitle="No hay registros financieros para mostrar"
        emptySubtitle="Ajusta los filtros o espera nuevas inscripciones para revisar pagos."
        onRowClick={(row) => router.push(buildLocalizedPath(`/dashboard/inscripciones/${row.id}`))}
      />

      <Sheet open={Boolean(editingPaymentId && editingRow)} onOpenChange={(open) => !open && handleCloseEditPayment()}>
        <SheetContent side="right" className="w-[92vw] sm:max-w-xl border-none shadow-2xl p-0 overflow-hidden">
          <SheetHeader className="px-6 py-5 border-b border-border/60 sticky top-0 bg-card z-10">
            <SheetTitle className="flex items-center gap-2 text-lg font-bold">
              <CreditCard className="h-5 w-5 text-primary" />
              Editar pago
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Revisa comprobantes, ajusta estados y guarda la revisión administrativa.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {titleCase(editingRow?.firstName || editingRow?.studentName || "-")}{" "}
                    {titleCase(editingRow?.lastName || "")}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground truncate">
                    {editingRow?.email || "-"}
                  </div>
                </div>
                <Badge className="h-7 rounded-full bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                  {editingRow?.paymentMeta?.amountLabel || "-"}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Curso: <span className="font-medium text-foreground">{editingRow?.course?.title || editingRow?.courseTitle || "-"}</span>
              </div>
              {editingRow?.institution?.name ? (
                <div className="text-xs text-muted-foreground">
                  Institución: <span className="font-medium text-foreground">{editingRow.institution.name}</span>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="outline" className="rounded-full border-border/70 text-[11px]">
                  Estado inscripción: {titleCase(editingRow?.status || "-")}
                </Badge>
                <Badge variant="outline" className="rounded-full border-border/70 text-[11px]">
                  Estado pago: {titleCase(editingRow?.paymentStatus || "-")}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Estado del pago
              </Label>
              <Select
                value={editPaymentStatus || ""}
                onValueChange={(value) => setEditPaymentStatus(value)}
              >
                <SelectTrigger className="h-11 rounded-2xl bg-background">
                  <SelectValue placeholder="Seleccionar estado de pago" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {paymentStatusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Comprobante de pago
              </Label>
              <div className="rounded-2xl border border-dashed border-border/70 bg-background p-3 space-y-2">
                 {editReceiptUrl ? (
                   <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2">
                     <div className="flex items-center gap-2">
                       {isImageReceipt(editReceiptUrl) ? (
                         <img src={editReceiptUrl} alt="" className="h-10 w-10 rounded-lg object-cover border border-slate-200" />
                       ) : (
                         <FileDown className="h-4 w-4 text-primary shrink-0" />
                       )}
                       <a
                         href={editReceiptUrl}
                         target="_blank"
                         rel="noreferrer"
                         className="flex items-center gap-2 text-xs font-medium text-foreground truncate"
                       >
                         <span className="truncate">Ver comprobante actual</span>
                       </a>
                     </div>
                     <Button
                       type="button"
                       size="sm"
                       variant="ghost"
                       onClick={() => setEditReceiptUrl("")}
                       className="h-7 rounded-xl text-[11px] text-destructive hover:text-destructive"
                     >
                       Quitar
                     </Button>
                   </div>
                 ) : (
                  <div className="flex items-center gap-2 rounded-xl bg-muted/30 px-3 py-2">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">Sin comprobante adjunto.</span>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    ref={editReceiptInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleEditReceiptUpload}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={editReceiptUploading}
                    onClick={() => editReceiptInputRef.current?.click()}
                    className="h-9 rounded-xl"
                  >
                    {editReceiptUploading ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {editReceiptUploading ? "Subiendo..." : "Adjuntar comprobante"}
                  </Button>
                  <p className="text-[11px] text-muted-foreground leading-4">
                    PDF, PNG o JPG. Se reemplaza el comprobante existente.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Comentario interno o motivo de revisión
              </Label>
              <Textarea
                value={editReviewComment}
                onChange={(e) => setEditReviewComment(e.target.value)}
                placeholder="Ej: comprobante ilegible, solicitar reenvío; o monto acreditado OK."
                className="min-h-[110px] rounded-2xl resize-y text-sm"
              />
              <p className="text-[11px] text-muted-foreground leading-4">
                Solo visible para administración.
              </p>
            </div>
          </div>

          <SheetFooter className="border-t border-border/60 bg-card px-6 py-4">
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              <SheetClose asChild>
                <Button type="button" variant="outline" className="h-10 w-full rounded-xl">
                  Cancelar
                </Button>
              </SheetClose>
              <div className="contents">
                {!editingPaymentApproved ? (
                  <SheetClose asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-10 w-full rounded-xl border-[#FDE68A] text-[#B45309] hover:bg-[#FFFBEB]"
                      onClick={() => handleQuickAction(editingRow, "request_receipt")}
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      Pedir nuevo comprobante
                    </Button>
                  </SheetClose>
                ) : null}
                {!editingPaymentApproved ? (
                  <SheetClose asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-10 w-full rounded-xl border-[#A7F3D0] text-[#047857] hover:bg-[#ECFDF5]"
                      onClick={() => handleQuickAction(editingRow, "approve")}
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Aprobar
                    </Button>
                  </SheetClose>
                ) : null}
                <Button
                  type="button"
                  variant="default"
                  onClick={handleSaveEditPayment}
                  disabled={savingEdit}
                  className="h-10 w-full rounded-xl bg-[#2356B8] text-white hover:bg-[#1D4ED8]"
                >
                  {savingEdit ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-4 w-4" />
                  )}
                  Guardar cambios
                </Button>
              </div>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
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
