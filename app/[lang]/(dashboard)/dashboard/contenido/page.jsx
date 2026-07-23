"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FileText, Globe2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/provider/auth.provider";
import { authedFetch } from "@/lib/auth/authed-fetch";
import { useLocalizedPath } from "@/lib/utils";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { DashboardSettingsSkeleton } from "@/components/courses/dashboard/page-skeletons";

function normalizeStatPairs(values) {
  return [
    { label: values.stat1Label, value: values.stat1Value },
    { label: values.stat2Label, value: values.stat2Value },
    { label: values.stat3Label, value: values.stat3Value },
    { label: values.stat4Label, value: values.stat4Value },
  ].filter((item) => String(item.label || "").trim() && String(item.value || "").trim());
}

export default function DashboardContenidoPage() {
  const buildLocalizedPath = useLocalizedPath();
  const { user } = useAuth();
  const { actor, loading: actorLoading, error: actorError } = useCourseActor();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
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
    stat1Label: "",
    stat1Value: "",
    stat2Label: "",
    stat2Value: "",
    stat3Label: "",
    stat3Value: "",
    stat4Label: "",
    stat4Value: "",
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

        setForm({
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
          stat1Label: stats[0]?.label || "",
          stat1Value: stats[0]?.value || "",
          stat2Label: stats[1]?.label || "",
          stat2Value: stats[1]?.value || "",
          stat3Label: stats[2]?.label || "",
          stat3Value: stats[2]?.value || "",
          stat4Label: stats[3]?.label || "",
          stat4Value: stats[3]?.value || "",
        });
      } catch (error) {
        toast.error(error?.message || "No pudimos cargar el contenido del portal.", { position: "top-right" });
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

  const statCards = useMemo(() => normalizeStatPairs(form), [form]);

  const handleChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user) return;

    try {
      setSaving(true);
      await authedFetch(user, "/api/courses/settings", {
        method: "PATCH",
        body: JSON.stringify({
          heroEyebrow: form.heroEyebrow || undefined,
          heroTitle: form.heroTitle || undefined,
          heroSubtitle: form.heroSubtitle || undefined,
          aboutTitle: form.aboutTitle || undefined,
          aboutText: form.aboutText || undefined,
          howItWorks: String(form.howItWorksText || "")
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          footerInfo: form.footerInfo || undefined,
          contactEmail: form.contactEmail || undefined,
          phone: form.phone || undefined,
          address: form.address || undefined,
          stats: normalizeStatPairs(form),
        }),
      });
      toast.success("Contenido actualizado", { position: "top-right" });
    } catch (error) {
      toast.error(error?.message || "No pudimos guardar el contenido.", { position: "top-right" });
    } finally {
      setSaving(false);
    }
  };

  if (actorLoading || loading) {
    return <DashboardSettingsSkeleton />;
  }

  if (actorError) {
    return (
      <div className="mx-auto max-w-6xl px-2 py-8">
        <div className="rounded-3xl border border-border/60 bg-card p-8">
          <h1 className="text-2xl font-bold text-foreground">No se pudo cargar el perfil</h1>
          <p className="mt-3 text-sm text-muted-foreground">{actorError}</p>
        </div>
      </div>
    );
  }

  if (actor?.role !== "admin") {
    return (
      <div className="mx-auto max-w-6xl px-2 py-8">
        <div className="rounded-3xl border border-border/60 bg-card p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Contenido</div>
          <h1 className="mt-3 text-2xl font-bold text-foreground">Acceso restringido</h1>
          <p className="mt-3 text-sm text-muted-foreground">Solo administración puede editar el contenido del portal público.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-2 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Contenido</div>
          <h1 className="mt-3 text-3xl font-bold text-foreground">Portal público</h1>
          <p className="mt-2 text-sm text-muted-foreground">Edita hero, bloques institucionales, contacto y métricas visibles del campus.</p>
        </div>

        <Button asChild variant="outline">
          <Link href={buildLocalizedPath("/dashboard/configuracion-cursos")}>Ir a configuración técnica</Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={handleSubmit} className="rounded-3xl border border-border/60 bg-card p-6">
          <div className="grid gap-8">
            <section className="grid gap-4">
              <div>
                <div className="text-lg font-semibold text-foreground">Hero principal</div>
                <p className="mt-1 text-sm text-muted-foreground">Define la promesa principal y el mensaje de entrada.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Eyebrow">
                  <Input value={form.heroEyebrow} onChange={(event) => handleChange("heroEyebrow", event.target.value)} />
                </Field>
                <Field label="Titulo">
                  <Input value={form.heroTitle} onChange={(event) => handleChange("heroTitle", event.target.value)} />
                </Field>
              </div>

              <Field label="Subtitulo">
                <Textarea rows={4} value={form.heroSubtitle} onChange={(event) => handleChange("heroSubtitle", event.target.value)} />
              </Field>
            </section>

            <section className="grid gap-4">
              <div>
                <div className="text-lg font-semibold text-foreground">Bloque institucional</div>
                <p className="mt-1 text-sm text-muted-foreground">Ajusta la presentación de ACAV Cursos y el bloque explicativo del home.</p>
              </div>

              <Field label="Titulo institucional">
                <Input value={form.aboutTitle} onChange={(event) => handleChange("aboutTitle", event.target.value)} />
              </Field>

              <Field label="Texto institucional">
                <Textarea rows={5} value={form.aboutText} onChange={(event) => handleChange("aboutText", event.target.value)} />
              </Field>

              <Field label="Como funciona">
                <Textarea
                  rows={5}
                  value={form.howItWorksText}
                  onChange={(event) => handleChange("howItWorksText", event.target.value)}
                  placeholder="Una linea por punto"
                />
              </Field>
            </section>

            <section className="grid gap-4">
              <div>
                <div className="text-lg font-semibold text-foreground">Contacto y footer</div>
                <p className="mt-1 text-sm text-muted-foreground">Estos datos alimentan el pie del sitio y bloques de contacto.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Email de contacto">
                  <Input value={form.contactEmail} onChange={(event) => handleChange("contactEmail", event.target.value)} />
                </Field>
                <Field label="Telefono">
                  <Input value={form.phone} onChange={(event) => handleChange("phone", event.target.value)} />
                </Field>
              </div>

              <Field label="Direccion">
                <Input value={form.address} onChange={(event) => handleChange("address", event.target.value)} />
              </Field>

              <Field label="Texto de footer">
                <Textarea rows={4} value={form.footerInfo} onChange={(event) => handleChange("footerInfo", event.target.value)} />
              </Field>
            </section>

            <section className="grid gap-4">
              <div>
                <div className="text-lg font-semibold text-foreground">Metricas visibles</div>
                <p className="mt-1 text-sm text-muted-foreground">Completa pares de etiqueta y valor para el bloque de estadísticas.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ["stat1Label", "stat1Value"],
                  ["stat2Label", "stat2Value"],
                  ["stat3Label", "stat3Value"],
                  ["stat4Label", "stat4Value"],
                ].map(([labelField, valueField], index) => (
                  <div key={labelField} className="rounded-2xl border border-border/60 bg-background p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Metrica {index + 1}</div>
                    <div className="mt-4 grid gap-4">
                      <Field label="Etiqueta">
                        <Input value={form[labelField]} onChange={(event) => handleChange(labelField, event.target.value)} />
                      </Field>
                      <Field label="Valor">
                        <Input value={form[valueField]} onChange={(event) => handleChange(valueField, event.target.value)} />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Guardando..." : "Guardar contenido"}
              </Button>
              <Button asChild variant="outline">
                <Link href={buildLocalizedPath("/")}>Ver portal</Link>
              </Button>
            </div>
          </div>
        </form>

        <aside className="grid gap-6">
          <div className="rounded-3xl border border-border/60 bg-card p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Globe2 className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Preview rápido</div>
                <div className="mt-1 text-lg font-semibold text-foreground">{form.heroTitle || "Sin título definido"}</div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">{form.heroSubtitle || "Completa el subtítulo para ver el resumen del hero."}</p>
          </div>

          <div className="rounded-3xl border border-border/60 bg-card p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Metricas activas</div>
                <div className="mt-1 text-lg font-semibold text-foreground">{statCards.length}</div>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {statCards.length ? (
                statCards.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="rounded-2xl border border-border/60 bg-background px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{item.label}</div>
                    <div className="mt-1 text-lg font-bold text-foreground">{item.value}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border/60 bg-background px-4 py-5 text-sm text-muted-foreground">
                  Todavía no definiste métricas visibles.
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
