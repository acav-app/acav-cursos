"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { Loader2, UploadCloud } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import FilePreview from "@/components/courses/file-preview";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/provider/auth.provider";
import { asArray, authedFetch } from "@/lib/auth/authed-fetch";
import { COURSE_CATEGORIES } from "@/lib/courses/constants";
import { normalizePublicR2Url } from "@/lib/r2/normalize-public-url";
import { uploadToR2 } from "@/components/courses/dashboard/upload";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeLooseUrl(value) {
  return String(value || "")
    .trim()
    .replace(/^[`"'\s]+/, "")
    .replace(/[`"'\s]+$/, "")
    .trim();
}

function slugify(input) {
  return String(input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

const schema = z.object({
  name: z.string().min(2, "Nombre es obligatorio"),
  businessName: z.string().optional(),
  cuit: z.string().optional(),
  description: z.string().optional(),
  logoUrl: z.string().url("Logo inválido").optional().or(z.literal("")),
  coverUrl: z.string().url("Portada inválida").optional().or(z.literal("")),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  website: z.string().url("URL inválida").optional().or(z.literal("")),
  linkedinUrl: z.string().url("URL de LinkedIn inválida").optional().or(z.literal("")),
  instagramUrl: z.string().url("URL de Instagram inválida").optional().or(z.literal("")),
  facebookUrl: z.string().url("URL de Facebook inválida").optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  subRubro: z.string().min(1, "Subrubro es obligatorio"),
  customSubRubro: z.string().optional(),
  rnvaLicense: z.string().optional(),
  isAcavMember: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  status: z.string().optional(),
});

export default function InstitutionForm({ companyId }) {
  const { user } = useAuth();
  const { actor } = useCourseActor();
  const [loading, setLoading] = useState(Boolean(companyId));
  const [saving, setSaving] = useState(false);
  const [initialStatus, setInitialStatus] = useState("pendiente");
  const [activationImpactLoading, setActivationImpactLoading] = useState(false);
  const [activationImpact, setActivationImpact] = useState({
    totalApplications: 0,
    eligibleApplications: 0,
    alreadyProcessedApplications: 0,
  });
  const [jobImpact, setJobImpact] = useState({
    totalJobs: 0,
    resumableJobs: 0,
    pausedJobs: 0,
    expiredJobs: 0,
    alreadyManagedJobs: 0,
  });

  const defaultValues = useMemo(
    () => ({
      name: "",
      businessName: "",
      cuit: "",
      description: "",
      logoUrl: "",
      coverUrl: "",
      email: "",
      phone: "",
      website: "",
      linkedinUrl: "",
      instagramUrl: "",
      facebookUrl: "",
      address: "",
      city: "",
      province: "",
      subRubro: "",
      customSubRubro: "",
      rnvaLicense: "",
      isAcavMember: undefined,
      isVerified: false,
      status: "pendiente",
    }),
    []
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const subRubro = watch("subRubro");
  const logoUrl = watch("logoUrl");
  const coverUrl = watch("coverUrl");
  const companyName = watch("name");
  const isAcavMember = watch("isAcavMember");
  const selectedStatus = watch("status");
  const generatedSlug = slugify(companyName);
  const isAdmin = actor?.role === "admin";
  const willAutoPreselectApplications =
    isAdmin && Boolean(companyId) && initialStatus !== "activa" && selectedStatus === "activa";
  const willAutoManageJobs =
    isAdmin && Boolean(companyId) && initialStatus === "activa" && ["pendiente", "inactiva"].includes(selectedStatus);

  const loadActivationImpact = useCallback(async () => {
    if (!companyId || !user || actor?.role !== "admin") return;
    try {
      setActivationImpactLoading(true);
      const data = await authedFetch(user, `/api/enrollments?companyId=${encodeURIComponent(companyId)}`, {
        method: "GET",
      });
      const applications = asArray(data?.enrollments);
      const eligibleApplications = applications.filter((item) =>
        ["recibida", "vista"].includes(String(item?.status || ""))
      ).length;
      const jobsData = await authedFetch(user, `/api/courses?companyId=${encodeURIComponent(companyId)}`, {
        method: "GET",
      });
      const jobs = asArray(jobsData?.courses);
      let resumableJobs = 0;
      let pausedJobs = 0;
      let expiredJobs = 0;
      let alreadyManagedJobs = 0;

      jobs.forEach((job) => {
        const status = String(job?.status || "");
        const expiresAt = new Date(String(job?.expiresAt || ""));
        const isExpired = !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now();

        if (["cerrada", "vencida", "rechazada"].includes(status)) {
          alreadyManagedJobs += 1;
          return;
        }
        if (isExpired) {
          expiredJobs += 1;
          return;
        }
        if (status === "pausada") {
          resumableJobs += 1;
          return;
        }
        if (status === "activa") {
          pausedJobs += 1;
          return;
        }
        alreadyManagedJobs += 1;
      });

      setActivationImpact({
        totalApplications: applications.length,
        eligibleApplications,
        alreadyProcessedApplications: Math.max(0, applications.length - eligibleApplications),
      });
      setJobImpact({
        totalJobs: jobs.length,
        resumableJobs,
        pausedJobs,
        expiredJobs,
        alreadyManagedJobs,
      });
    } catch (e) {
      toast.error(e?.message || "Error cargando impacto de automatizaciones", { position: "top-right" });
    } finally {
      setActivationImpactLoading(false);
    }
  }, [actor?.role, companyId, user]);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!companyId || !user) return;
      setLoading(true);
      try {
        const data = await authedFetch(user, `/api/institutions/${companyId}`, { method: "GET" });
        if (!alive) return;
        reset({
          ...defaultValues,
          ...data?.institution,
          logoUrl: normalizePublicR2Url(data?.institution?.logoUrl || ""),
          coverUrl: normalizePublicR2Url(data?.institution?.coverUrl || ""),
        });
        setInitialStatus(data?.institution?.status || "pendiente");
      } catch (e) {
        toast.error(e?.message || "Error cargando institucion", { position: "top-right" });
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [companyId, user, reset, defaultValues]);

  useEffect(() => {
    loadActivationImpact();
  }, [loadActivationImpact]);

  const onSubmit = async (values) => {
    if (!user) return;
    try {
      setSaving(true);
      const payload = {
        ...values,
        slug: slugify(values.name),
        name: normalizeWhitespace(values.name),
        businessName: normalizeWhitespace(values.businessName),
        cuit: normalizeDigits(values.cuit),
        customSubRubro: values.subRubro === "Otro" ? normalizeWhitespace(values.customSubRubro) : undefined,
        logoUrl: values.logoUrl ? normalizePublicR2Url(values.logoUrl) : undefined,
        coverUrl: values.coverUrl ? normalizePublicR2Url(values.coverUrl) : undefined,
        website: normalizeLooseUrl(values.website) || undefined,
        linkedinUrl: normalizeLooseUrl(values.linkedinUrl) || undefined,
        instagramUrl: normalizeLooseUrl(values.instagramUrl) || undefined,
        facebookUrl: normalizeLooseUrl(values.facebookUrl) || undefined,
        address: normalizeWhitespace(values.address),
        city: normalizeWhitespace(values.city),
        province: normalizeWhitespace(values.province),
        description: normalizeWhitespace(values.description),
        rnvaLicense: normalizeWhitespace(values.rnvaLicense),
      };

      if (companyId) {
        const data = await authedFetch(user, `/api/institutions/${companyId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        const updatedCompany = data?.company || {};
        const automation = data?.automation || null;
        setInitialStatus(updatedCompany?.status || values.status || "pendiente");
        reset({
          ...defaultValues,
          ...updatedCompany,
          logoUrl: normalizePublicR2Url(updatedCompany?.logoUrl || ""),
          coverUrl: normalizePublicR2Url(updatedCompany?.coverUrl || ""),
        });
        if (automation?.triggered) {
          if (automation.transition === "activated") {
            toast.success(
              automation.updatedApplications > 0 || automation.resumedJobs > 0 || automation.expiredJobs > 0
                ? `Institucion activada. ${automation.updatedApplications} inscripciones preseleccionadas, ${automation.resumedJobs || 0} cursos reactivados y ${automation.expiredJobs || 0} vencidos actualizados.`
                : "Institucion activada. No habia inscripciones ni cursos pausados para actualizar.",
              { position: "top-right" }
            );
          } else if (automation.transition === "deactivated") {
            toast.success(
              automation.pausedJobs > 0 || automation.expiredJobs > 0
                ? `Institucion actualizada. ${automation.pausedJobs} cursos pausados y ${automation.expiredJobs} cerrados por vencimiento.`
                : "Institucion actualizada. No habia cursos activos que requirieran cambios.",
              { position: "top-right" }
            );
          }
          await loadActivationImpact();
        } else {
          toast.success("Institucion actualizada", { position: "top-right" });
        }
        return;
      }

      const data = await authedFetch(user, "/api/institutions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success("Institucion creada", { position: "top-right" });
      setInitialStatus(data?.institution?.status || "pendiente");
      reset({ ...defaultValues, ...data?.institution });
    } catch (e) {
      toast.error(e?.message || "Error guardando institucion", { position: "top-right" });
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (field, folder, file) => {
    if (!file) return;
    try {
      setSaving(true);
      const url = await uploadToR2(file, folder);
      setValue(field, url, { shouldValidate: true });
      toast.success("Archivo subido", { position: "top-right" });
    } catch (e) {
      toast.error(e?.message || "Error subiendo archivo", { position: "top-right" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-border/60 bg-card p-8 flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm text-muted-foreground">Cargando...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6">
      <div className="grid gap-2">
        <Label>Nombre</Label>
        <Input placeholder="Nombre de la institucion" {...register("name")} />
        {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Razón social</Label>
          <Input placeholder="Puede coincidir con el nombre comercial" {...register("businessName")} />
        </div>
        <div className="grid gap-2">
          <Label>CUIT</Label>
          <Input placeholder="30xxxxxxxxx" {...register("cuit")} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Subrubro</Label>
        <Select value={subRubro} onValueChange={(v) => setValue("subRubro", v, { shouldValidate: true })}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar subrubro" />
          </SelectTrigger>
          <SelectContent>
            {COURSE_CATEGORIES.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.subRubro ? <p className="text-sm text-destructive">{errors.subRubro.message}</p> : null}
      </div>

      {subRubro === "Otro" ? (
        <div className="grid gap-2">
          <Label>Subrubro personalizado</Label>
          <Input placeholder="Especificar" {...register("customSubRubro")} />
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="grid min-w-0 gap-2">
          <Label>Email</Label>
          <Input placeholder="contacto@institucion.com" {...register("email")} />
          {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
        </div>
        <div className="grid min-w-0 gap-2">
          <Label>Teléfono</Label>
          <Input placeholder="+54 ..." {...register("phone")} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Sitio web o red social/institucional</Label>
          <Input placeholder="https://..." {...register("website")} />
          {errors.website ? <p className="text-sm text-destructive">{errors.website.message}</p> : null}
        </div>
        <div className="grid gap-2">
          <Label>Ciudad</Label>
          <Input placeholder="Ciudad" {...register("city")} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Provincia</Label>
          <Input placeholder="Provincia" {...register("province")} />
        </div>
        <div className="grid gap-2">
          <Label>Socia de ACAV</Label>
          <Select
            value={isAcavMember === true ? "si" : isAcavMember === false ? "no" : ""}
            onValueChange={(value) =>
              setValue("isAcavMember", value === "si" ? true : value === "no" ? false : undefined, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar si/no" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="si">Sí</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="grid gap-2">
          <Label>LinkedIn</Label>
          <Input placeholder="https://linkedin.com/..." {...register("linkedinUrl")} />
          {errors.linkedinUrl ? <p className="text-sm text-destructive">{errors.linkedinUrl.message}</p> : null}
        </div>
        <div className="grid gap-2">
          <Label>Instagram</Label>
          <Input placeholder="https://instagram.com/..." {...register("instagramUrl")} />
          {errors.instagramUrl ? <p className="text-sm text-destructive">{errors.instagramUrl.message}</p> : null}
        </div>
        <div className="grid gap-2">
          <Label>Facebook</Label>
          <Input placeholder="https://facebook.com/..." {...register("facebookUrl")} />
          {errors.facebookUrl ? <p className="text-sm text-destructive">{errors.facebookUrl.message}</p> : null}
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Dirección</Label>
        <Input placeholder="Dirección" {...register("address")} />
      </div>

      <div className="grid gap-2">
        <Label>Legajo habilitante RNVA (si corresponde)</Label>
        <Input placeholder="Número de legajo RNVA" {...register("rnvaLicense")} />
      </div>

      <div className="grid gap-2">
        <Label>Descripción</Label>
        <Textarea rows={5} placeholder="Descripcion publica de la institucion" {...register("description")} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="grid gap-2">
          <Label>Logo (opcional)</Label>
          <div className="grid min-w-0 gap-3 overflow-hidden rounded-3xl border border-border/60 bg-background p-4">
            <Input
              type="file"
              accept="image/*"
              className="min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
              onChange={(e) => handleUpload("logoUrl", "courses/institutions", e.target.files?.[0])}
              disabled={saving}
            />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UploadCloud className="h-4 w-4" />
              <span>{logoUrl ? "Logo cargado" : "Subí un logo para la ficha pública"}</span>
            </div>
          </div>
          {logoUrl ? (
            <FilePreview
              url={logoUrl}
              title="Miniatura del logo"
              description="Vista previa compacta del logo subido."
              variant="compact"
            />
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label>Portada (opcional)</Label>
          <div className="grid min-w-0 gap-3 overflow-hidden rounded-3xl border border-border/60 bg-background p-4">
            <Input
              type="file"
              accept="image/*"
              className="min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
              onChange={(e) => handleUpload("coverUrl", "courses/institutions", e.target.files?.[0])}
              disabled={saving}
            />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UploadCloud className="h-4 w-4" />
              <span>{coverUrl ? "Portada cargada" : "Subí una imagen de portada"}</span>
            </div>
          </div>
          {coverUrl ? (
            <FilePreview
              url={coverUrl}
              title="Miniatura de la portada"
              description="Vista previa compacta de la portada subida."
              variant="compact"
            />
          ) : null}
        </div>
      </div>

      {actor?.role === "admin" ? (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Estado</Label>
            <Select value={watch("status")} onValueChange={(v) => setValue("status", v, { shouldValidate: true })}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activa">activa</SelectItem>
                <SelectItem value="pendiente">pendiente</SelectItem>
                <SelectItem value="inactiva">inactiva</SelectItem>
              </SelectContent>
            </Select>
            {companyId ? (
              activationImpactLoading ? (
                <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analizando inscripciones y cursos asociados para esta institucion...
                </div>
              ) : willAutoPreselectApplications ? (
                <Alert color="warning" variant="soft" className="items-start rounded-3xl border border-warning/20">
                  <div className="grid gap-1">
                    <AlertTitle>Activación con automatizaciones</AlertTitle>
                    <AlertDescription>
                      {activationImpact.eligibleApplications > 0
                        ? `Al guardar, ${activationImpact.eligibleApplications} inscripciones en estado recibida o vista pasaran a preseleccionada automaticamente.`
                        : "Al guardar, la institucion se activara pero no hay inscripciones pendientes por aprobar automaticamente."}
                      {jobImpact.resumableJobs > 0
                        ? ` ${jobImpact.resumableJobs} cursos pausados volveran a activo automaticamente.`
                        : ""}
                      {jobImpact.expiredJobs > 0
                        ? ` ${jobImpact.expiredJobs} cursos ya vencidos pasaran a estado vencida.`
                        : ""}
                      {activationImpact.alreadyProcessedApplications > 0
                        ? ` ${activationImpact.alreadyProcessedApplications} ya estaban gestionadas y conservarán su estado actual.`
                        : ""}
                    </AlertDescription>
                  </div>
                </Alert>
              ) : willAutoManageJobs ? (
                <Alert color="warning" variant="soft" className="items-start rounded-3xl border border-warning/20">
                  <div className="grid gap-1">
                    <AlertTitle>Desactivacion con gestion automatica de cursos</AlertTitle>
                    <AlertDescription>
                      {jobImpact.pausedJobs > 0
                        ? `Al guardar, ${jobImpact.pausedJobs} cursos activos pasaran a pausada automaticamente.`
                        : "No hay cursos activos para pausar automaticamente."}
                      {jobImpact.expiredJobs > 0
                        ? ` ${jobImpact.expiredJobs} cursos vencidos pasaran a estado vencida.`
                        : ""}
                      {jobImpact.alreadyManagedJobs > 0
                        ? ` ${jobImpact.alreadyManagedJobs} ya estaban gestionadas y conservarán su estado actual.`
                        : ""}
                    </AlertDescription>
                  </div>
                </Alert>
              ) : selectedStatus === "activa" ? (
                <Alert color="success" variant="soft" className="items-start rounded-3xl border border-success/20">
                  <div className="grid gap-1">
                    <AlertTitle>Institucion activa</AlertTitle>
                    <AlertDescription>
                      La institucion ya esta en estado activo. Las inscripciones previamente gestionadas conservan su historial.
                    </AlertDescription>
                  </div>
                </Alert>
              ) : null
            ) : null}
          </div>

          <div className="flex items-start gap-3 rounded-3xl border border-border/60 bg-background p-5">
            <Checkbox
              id="isVerified"
              checked={Boolean(watch("isVerified"))}
              onCheckedChange={(v) => setValue("isVerified", Boolean(v))}
            />
            <div className="grid gap-1">
              <Label htmlFor="isVerified">Verificada</Label>
              <p className="text-xs leading-6 text-muted-foreground">Marca la institucion como verificada dentro del panel.</p>
            </div>
          </div>
        </div>
      ) : null}

      {saving && (willAutoPreselectApplications || willAutoManageJobs) ? (
        <Alert color="info" variant="soft" className="items-start rounded-3xl border border-info/20">
          <Loader2 className="mt-0.5 h-4 w-4 animate-spin shrink-0" />
          <div className="grid gap-1">
            <AlertTitle>{willAutoPreselectApplications ? "Procesando activación" : "Procesando desactivación"}</AlertTitle>
            <AlertDescription>
              {willAutoPreselectApplications
                ? "Estamos activando la institucion, aprobando inscripciones elegibles y reanudando cursos pausados."
                : "Estamos actualizando la institucion y gestionando automaticamente sus cursos activos y vencidos."}
            </AlertDescription>
          </div>
        </Alert>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" className={saving ? "pointer-events-none" : ""}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {saving
            ? willAutoPreselectApplications
              ? "Activando institucion..."
              : willAutoManageJobs
                ? "Actualizando publicaciones..."
              : companyId
                ? "Guardando cambios..."
                : "Creando institucion..."
            : willAutoPreselectApplications
              ? "Activar y reanudar automatizaciones"
              : willAutoManageJobs
                ? "Guardar y gestionar publicaciones"
              : companyId
                ? "Guardar cambios"
                : "Crear institucion"}
        </Button>
      </div>
    </form>
  );
}
