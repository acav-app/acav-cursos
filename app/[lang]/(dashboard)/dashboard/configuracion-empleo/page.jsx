"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/provider/auth.provider";
import { authedFetch } from "@/lib/auth/authed-fetch";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { DashboardSettingsSkeleton } from "@/components/courses/dashboard/page-skeletons";

const schema = z.object({
  heroEyebrow: z.string().optional(),
  heroTitle: z.string().optional(),
  heroSubtitle: z.string().optional(),
  aboutTitle: z.string().optional(),
  aboutText: z.string().optional(),
  howItWorksText: z.string().optional(),
  footerInfo: z.string().optional(),
  contactEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  adminNotificationEmail: z.string().email("Email admin inválido").optional().or(z.literal("")),
  emailFrom: z.string().email("Email from inválido").optional().or(z.literal("")),
  emailFromName: z.string().optional(),
  replyTo: z.string().email("Reply-To inválido").optional().or(z.literal("")),
  notifyAdminOnNewJob: z.boolean().optional(),
  notifyAdminOnNewApplication: z.boolean().optional(),
  notifyCompanyOnJobStatusChange: z.boolean().optional(),
  notifyCompanyOnNewApplication: z.boolean().optional(),
  notifyCandidateOnApplication: z.boolean().optional(),
  stat1Label: z.string().optional(),
  stat1Value: z.string().optional(),
  stat2Label: z.string().optional(),
  stat2Value: z.string().optional(),
  stat3Label: z.string().optional(),
  stat3Value: z.string().optional(),
  stat4Label: z.string().optional(),
  stat4Value: z.string().optional(),
});

function toLines(text) {
  return String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export default function DashboardConfiguracionEmpleoPage() {
  const { user } = useAuth();
  const { actor, loading: actorLoading, error: actorError } = useCourseActor();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const defaultValues = useMemo(
    () => ({
      heroEyebrow: "",
      heroTitle: "",
      heroSubtitle: "",
      aboutTitle: "",
      aboutText: "",
      howItWorksText: "",
      footerInfo: "",
      contactEmail: "",
      phone: "",
      address: "",
      adminNotificationEmail: "",
      emailFrom: "",
      emailFromName: "",
      replyTo: "",
      notifyAdminOnNewJob: true,
      notifyAdminOnNewApplication: true,
      notifyCompanyOnJobStatusChange: true,
      notifyCompanyOnNewApplication: true,
      notifyCandidateOnApplication: true,
      stat1Label: "",
      stat1Value: "",
      stat2Label: "",
      stat2Value: "",
      stat3Label: "",
      stat3Value: "",
      stat4Label: "",
      stat4Value: "",
    }),
    []
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!user) return;
      setLoading(true);
      try {
        const data = await authedFetch(user, "/api/courses/settings", { method: "GET" });
        if (!alive) return;
        const settings = data?.settings || {};
        const stats = Array.isArray(settings.stats) ? settings.stats : [];
        reset({
          ...defaultValues,
          heroEyebrow: settings.heroEyebrow || "",
          heroTitle: settings.heroTitle || "",
          heroSubtitle: settings.heroSubtitle || "",
          aboutTitle: settings.aboutTitle || "",
          aboutText: settings.aboutText || "",
          howItWorksText: Array.isArray(settings.howItWorks) ? settings.howItWorks.join("\n") : "",
          footerInfo: settings.footerInfo || "",
          contactEmail: settings.contactEmail || "",
          phone: settings.phone || "",
          address: settings.address || "",
          adminNotificationEmail: settings.adminNotificationEmail || "",
          emailFrom: settings.emailFrom || "",
          emailFromName: settings.emailFromName || "",
          replyTo: settings.replyTo || "",
          notifyAdminOnNewJob: settings.notifyAdminOnNewJob !== false,
          notifyAdminOnNewApplication: settings.notifyAdminOnNewApplication !== false,
          notifyCompanyOnJobStatusChange: settings.notifyCompanyOnJobStatusChange !== false,
          notifyCompanyOnNewApplication: settings.notifyCompanyOnNewApplication !== false,
          notifyCandidateOnApplication: settings.notifyCandidateOnApplication !== false,
          stat1Label: stats[0]?.label || "",
          stat1Value: stats[0]?.value || "",
          stat2Label: stats[1]?.label || "",
          stat2Value: stats[1]?.value || "",
          stat3Label: stats[2]?.label || "",
          stat3Value: stats[2]?.value || "",
          stat4Label: stats[3]?.label || "",
          stat4Value: stats[3]?.value || "",
        });
      } catch (e) {
        toast.error(e?.message || "Error cargando configuración", { position: "top-right" });
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [user, reset, defaultValues]);

  const onSubmit = async (values) => {
    if (!user) return;
    try {
      setSaving(true);
      const stats = [
        { label: values.stat1Label, value: values.stat1Value },
        { label: values.stat2Label, value: values.stat2Value },
        { label: values.stat3Label, value: values.stat3Value },
        { label: values.stat4Label, value: values.stat4Value },
      ].filter((s) => String(s.label || "").trim() && String(s.value || "").trim());

      const payload = {
        heroEyebrow: values.heroEyebrow || undefined,
        heroTitle: values.heroTitle || undefined,
        heroSubtitle: values.heroSubtitle || undefined,
        aboutTitle: values.aboutTitle || undefined,
        aboutText: values.aboutText || undefined,
        howItWorks: toLines(values.howItWorksText),
        footerInfo: values.footerInfo || undefined,
        contactEmail: values.contactEmail || undefined,
        phone: values.phone || undefined,
        address: values.address || undefined,
        adminNotificationEmail: values.adminNotificationEmail || undefined,
        emailFrom: values.emailFrom || undefined,
        emailFromName: values.emailFromName || undefined,
        replyTo: values.replyTo || undefined,
        notifyAdminOnNewJob: Boolean(values.notifyAdminOnNewJob),
        notifyAdminOnNewApplication: Boolean(values.notifyAdminOnNewApplication),
        notifyCompanyOnJobStatusChange: Boolean(values.notifyCompanyOnJobStatusChange),
        notifyCompanyOnNewApplication: Boolean(values.notifyCompanyOnNewApplication),
        notifyCandidateOnApplication: Boolean(values.notifyCandidateOnApplication),
        stats,
      };

      await authedFetch(user, "/api/courses/settings", { method: "PATCH", body: JSON.stringify(payload) });
      toast.success("Configuración guardada", { position: "top-right" });
    } catch (e) {
      toast.error(e?.message || "Error guardando configuración", { position: "top-right" });
    } finally {
      setSaving(false);
    }
  };

  if (actorLoading || loading) {
    return <DashboardSettingsSkeleton />;
  }

  if (actorError) {
    return (
      <div className="py-8 px-2 max-w-6xl mx-auto">
        <div className="rounded-3xl border border-border/60 bg-card p-8">
          <h1 className="text-2xl font-bold text-foreground">No se pudo cargar el perfil</h1>
          <p className="mt-3 text-sm text-muted-foreground">{actorError}</p>
        </div>
      </div>
    );
  }

  if (actor?.role !== "admin") {
    return (
      <div className="py-8 px-2 max-w-6xl mx-auto">
        <div className="rounded-3xl border border-border/60 bg-card p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Configuracion tecnica</div>
          <h1 className="mt-3 text-2xl font-bold text-foreground">Acceso restringido</h1>
          <p className="mt-3 text-sm text-muted-foreground">Solo administradores pueden modificar ajustes tecnicos y notificaciones del campus.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-2 max-w-6xl mx-auto">
      <div className="rounded-3xl border border-border/60 bg-card p-8">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Configuracion tecnica</div>
        <h1 className="mt-3 text-3xl font-bold text-foreground">Notificaciones y ajustes del campus</h1>
        <p className="mt-2 text-sm text-muted-foreground">Administra emails, toggles operativos y configuraciones globales del portal.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-10 grid gap-10">
          <div className="grid gap-6">
            <h2 className="text-lg font-semibold text-foreground">Hero</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Eyebrow</Label>
                <Input {...register("heroEyebrow")} />
              </div>
              <div className="grid gap-2">
                <Label>Título</Label>
                <Input {...register("heroTitle")} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Subtítulo</Label>
              <Textarea rows={3} {...register("heroSubtitle")} />
            </div>
          </div>

          <div className="grid gap-6">
            <h2 className="text-lg font-semibold text-foreground">About</h2>
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input {...register("aboutTitle")} />
            </div>
            <div className="grid gap-2">
              <Label>Texto</Label>
              <Textarea rows={4} {...register("aboutText")} />
            </div>
          </div>

          <div className="grid gap-6">
            <h2 className="text-lg font-semibold text-foreground">Cómo funciona</h2>
            <div className="grid gap-2">
              <Label>Items (uno por línea)</Label>
              <Textarea rows={5} {...register("howItWorksText")} />
            </div>
          </div>

          <div className="grid gap-6">
            <h2 className="text-lg font-semibold text-foreground">Estadísticas</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Stat 1 label</Label>
                <Input {...register("stat1Label")} />
              </div>
              <div className="grid gap-2">
                <Label>Stat 1 value</Label>
                <Input {...register("stat1Value")} />
              </div>
              <div className="grid gap-2">
                <Label>Stat 2 label</Label>
                <Input {...register("stat2Label")} />
              </div>
              <div className="grid gap-2">
                <Label>Stat 2 value</Label>
                <Input {...register("stat2Value")} />
              </div>
              <div className="grid gap-2">
                <Label>Stat 3 label</Label>
                <Input {...register("stat3Label")} />
              </div>
              <div className="grid gap-2">
                <Label>Stat 3 value</Label>
                <Input {...register("stat3Value")} />
              </div>
              <div className="grid gap-2">
                <Label>Stat 4 label</Label>
                <Input {...register("stat4Label")} />
              </div>
              <div className="grid gap-2">
                <Label>Stat 4 value</Label>
                <Input {...register("stat4Value")} />
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            <h2 className="text-lg font-semibold text-foreground">Footer y contacto</h2>
            <div className="grid gap-2">
              <Label>Texto footer</Label>
              <Textarea rows={3} {...register("footerInfo")} />
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input {...register("contactEmail")} />
                {errors.contactEmail ? <p className="text-sm text-destructive">{errors.contactEmail.message}</p> : null}
              </div>
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input {...register("phone")} />
              </div>
              <div className="grid gap-2">
                <Label>Dirección</Label>
                <Input {...register("address")} />
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            <h2 className="text-lg font-semibold text-foreground">Emails</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Email admin notificaciones</Label>
                <Input {...register("adminNotificationEmail")} />
                {errors.adminNotificationEmail ? (
                  <p className="text-sm text-destructive">{errors.adminNotificationEmail.message}</p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label>From (visible)</Label>
                <Input {...register("emailFrom")} />
                {errors.emailFrom ? <p className="text-sm text-destructive">{errors.emailFrom.message}</p> : null}
              </div>
              <div className="grid gap-2">
                <Label>From name</Label>
                <Input {...register("emailFromName")} />
              </div>
              <div className="grid gap-2">
                <Label>Reply-To</Label>
                <Input {...register("replyTo")} />
                {errors.replyTo ? <p className="text-sm text-destructive">{errors.replyTo.message}</p> : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["notifyAdminOnNewJob", "Nuevo curso creado por institucion -> email admin"],
                ["notifyAdminOnNewApplication", "Nueva inscripcion -> email admin"],
                ["notifyCompanyOnJobStatusChange", "Aprobacion / rechazo del curso -> email institucion"],
                ["notifyCompanyOnNewApplication", "Nueva inscripcion -> email institucion"],
                ["notifyCandidateOnApplication", "Confirmacion -> email alumno"],
              ].map(([key, label]) => (
                <div key={key} className="flex items-start gap-3 rounded-3xl border border-border/60 bg-background p-5">
                  <Checkbox
                    checked={Boolean(watch(key))}
                    onCheckedChange={(v) => setValue(key, Boolean(v))}
                  />
                  <div className="text-sm text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" className={saving ? "pointer-events-none" : ""}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar configuración
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
