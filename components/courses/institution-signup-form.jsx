"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { ImagePlus, Loader2, UploadCloud } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import FilePreview from "@/components/courses/file-preview";
import { buildLocalizedPath, cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COURSE_CATEGORIES } from "@/lib/courses/constants";
import { loginWithEmail } from "@/lib/firebase";
import { uploadToR2 } from "@/components/courses/dashboard/upload";
import { getCompanySignupErrorMessage } from "@/lib/auth/firebase-error-messages";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function normalizePhone(value) {
  const raw = String(value || "").trim();
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0054")) return `+54${digits.slice(4)}`;
  if (digits.startsWith("54") && digits.length >= 10) return `+54${digits.slice(2)}`;
  if (digits.startsWith("0") && digits.length >= 10) return `+54${digits.slice(1)}`;
  return hasPlus ? `+${digits}` : digits;
}

function normalizeLooseUrl(value) {
  return String(value || "")
    .trim()
    .replace(/^[`"'\s]+/, "")
    .replace(/[`"'\s]+$/, "")
    .trim();
}

function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
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
  firstName: z.string().min(2, "Nombre es obligatorio"),
  lastName: z.string().min(2, "Apellido es obligatorio"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  companyName: z.string().min(2, "Nombre de institucion es obligatorio"),
  businessName: z.string().optional(),
  cuit: z.string().optional(),
  subRubro: z.string().min(1, "Subrubro es obligatorio"),
  customSubRubro: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().url("URL inválida").optional().or(z.literal("")),
  linkedinUrl: z.string().url("URL de LinkedIn inválida").optional().or(z.literal("")),
  instagramUrl: z.string().url("URL de Instagram inválida").optional().or(z.literal("")),
  facebookUrl: z.string().url("URL de Facebook inválida").optional().or(z.literal("")),
  address: z.string().optional(),
  rnvaLicense: z.string().optional(),
  isAcavMember: z.boolean().optional(),
  description: z.string().optional(),
  logoUrl: z.string().url("Logo inválido").optional().or(z.literal("")),
  coverUrl: z.string().url("Portada inválida").optional().or(z.literal("")),
  acceptedTerms: z.boolean().refine((value) => value === true, {
    message: "Debes aceptar términos y condiciones",
  }),
});

export default function CompanySignupForm({
  lang = "es",
  variant = "page",
  showHeader = variant !== "compact",
  submitLabel = "Crear cuenta institucional",
}) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitInfo, setSubmitInfo] = useState("");
  const shouldReduceMotion = useReducedMotion();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      companyName: "",
      businessName: "",
      cuit: "",
      subRubro: "",
      customSubRubro: "",
      city: "",
      province: "",
      phone: "",
      website: "",
      linkedinUrl: "",
      instagramUrl: "",
      facebookUrl: "",
      address: "",
      rnvaLicense: "",
      isAcavMember: undefined,
      description: "",
      logoUrl: "",
      coverUrl: "",
      acceptedTerms: false,
    },
  });

  const subRubro = watch("subRubro");
  const logoUrl = watch("logoUrl");
  const coverUrl = watch("coverUrl");
  const companyName = watch("companyName");
  const isAcavMember = watch("isAcavMember");
  const generatedSlug = slugify(companyName);

  const handleUpload = async (field, folder, file) => {
    if (!file) return;
    try {
      const url = await uploadToR2(file, folder);
      setValue(field, url, { shouldValidate: true, shouldDirty: true });
      toast.success("Archivo cargado correctamente.", { position: "top-right" });
    } catch (error) {
      toast.error(error?.message || "No se pudo subir el archivo.", { position: "top-right" });
    }
  };

  const onSubmit = async (values) => {
    const payload = {
      ...values,
      lang,
      firstName: normalizeWhitespace(values.firstName),
      lastName: normalizeWhitespace(values.lastName),
      email: normalizeEmail(values.email),
      phone: normalizePhone(values.phone),
      companyName: normalizeWhitespace(values.companyName),
      businessName: normalizeWhitespace(values.businessName),
      cuit: normalizeDigits(values.cuit),
      slug: slugify(values.companyName),
      city: normalizeWhitespace(values.city),
      province: normalizeWhitespace(values.province),
      address: normalizeWhitespace(values.address),
      description: normalizeWhitespace(values.description),
      customSubRubro: normalizeWhitespace(values.customSubRubro),
      website: normalizeLooseUrl(values.website),
      linkedinUrl: normalizeLooseUrl(values.linkedinUrl),
      instagramUrl: normalizeLooseUrl(values.instagramUrl),
      facebookUrl: normalizeLooseUrl(values.facebookUrl),
      rnvaLicense: normalizeWhitespace(values.rnvaLicense),
      isAcavMember: values.isAcavMember,
      logoUrl: normalizeLooseUrl(values.logoUrl),
      coverUrl: normalizeLooseUrl(values.coverUrl),
    };

    try {
      setSubmitting(true);
      setSubmitError("");
      setSubmitInfo("Creando tu acceso, vinculando la institucion y preparando el dashboard...");
      const res = await fetch("/api/courses/institutions/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || data?.message || "request_failed");
      }

      await loginWithEmail(payload.email, values.password);
      setDone(true);
      toast.success("Tu cuenta institucional quedo creada y vinculada a ACAV Cursos.", { position: "top-right" });
      reset();
      window.location.assign(buildLocalizedPath("/dashboard", lang));
    } catch (error) {
      const message = getCompanySignupErrorMessage(error);
      setSubmitInfo("");
      setSubmitError(message);
      toast.error(message, { position: "top-right" });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#DD4913]">Registro completado</div>
        <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#1B2B50]">Tu cuenta institucional ya esta lista</h2>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          Te estamos redirigiendo al panel. Tambien enviamos un email de bienvenida con el resumen del alta y el acceso al portal.
        </p>
      </div>
    );
  }

  const alertMotion = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: -6 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
        transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
      };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn(
        "grid gap-6",
        variant === "page" && "rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800/80 dark:bg-slate-950",
      )}
    >
      <AnimatePresence mode="popLayout">
        {submitError ? (
          <motion.div key="submitError" {...alertMotion}>
            <Alert color="destructive" variant="soft" className="rounded-[24px] border border-destructive/20 px-4 py-3">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          </motion.div>
        ) : null}
        {submitInfo ? (
          <motion.div key="submitInfo" {...alertMotion}>
            <Alert color="info" variant="soft" className="rounded-[24px] border border-info/20 px-4 py-3">
              <AlertDescription>{submitInfo}</AlertDescription>
            </Alert>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {showHeader ? (
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#DD4913]">
            <span className="h-0.5 w-7 rounded bg-[#DD4913]" />
            Alta autogestionada
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#1B2B50]">Crea tu cuenta institucional</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Completás el usuario de acceso y la ficha institucional en un solo flujo, sin depender del panel admin.
          </p>
        </div>
      ) : null}

      <div className="rounded-[24px] border border-[#D9E2F2] bg-[#F8FBFF] p-4 text-sm leading-7 text-slate-600 dark:border-slate-800/80 dark:bg-slate-900/30 dark:text-slate-200">
        El alta crea tu acceso, vincula tu institucion y deja la ficha lista para validacion. No enviamos contraseñas por email ni exponemos datos sensibles.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Nombre</Label>
          <Input placeholder="Tu nombre" {...register("firstName")} />
          {errors.firstName ? <p className="text-sm text-destructive">{errors.firstName.message}</p> : null}
        </div>
        <div className="grid gap-2">
          <Label>Apellido</Label>
          <Input placeholder="Tu apellido" {...register("lastName")} />
          {errors.lastName ? <p className="text-sm text-destructive">{errors.lastName.message}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Email de acceso</Label>
          <Input
            type="email"
            placeholder="institucion@dominio.com"
            {...register("email", {
              setValueAs: (value) => normalizeEmail(value),
            })}
          />
          {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
        </div>
        <div className="grid gap-2">
          <Label>Contraseña</Label>
          <Input type="password" placeholder="Mínimo 6 caracteres" {...register("password")} />
          {errors.password ? <p className="text-sm text-destructive">{errors.password.message}</p> : null}
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Nombre de la institucion</Label>
          <Input placeholder="Nombre comercial" {...register("companyName")} />
          {errors.companyName ? <p className="text-sm text-destructive">{errors.companyName.message}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Razón social</Label>
          <Input placeholder="Puede coincidir con el nombre comercial" {...register("businessName")} />
        </div>
        <div className="grid gap-2">
          <Label>CUIT</Label>
          <Input placeholder="30xxxxxxxxx" {...register("cuit")} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Subrubro</Label>
          <Select value={subRubro || ""} onValueChange={(value) => setValue("subRubro", value, { shouldValidate: true, shouldDirty: true })}>
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
        <div className="grid gap-2">
          <Label>Ciudad</Label>
          <Input placeholder="Ciudad" {...register("city")} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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

      {subRubro === "Otro" ? (
        <div className="grid gap-2">
          <Label>Subrubro personalizado</Label>
          <Input placeholder="Especificar rubro" {...register("customSubRubro")} />
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Teléfono</Label>
          <Input
            placeholder="+54 351..."
            {...register("phone", {
              setValueAs: (value) => normalizePhone(value),
            })}
          />
        </div>
        <div className="grid gap-2">
          <Label>Sitio web o red social/institucional</Label>
          <Input placeholder="https://..." {...register("website")} />
          {errors.website ? <p className="text-sm text-destructive">{errors.website.message}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
        <Input placeholder="Dirección comercial" {...register("address")} />
      </div>

      <div className="grid gap-2">
        <Label>Legajo habilitante RNVA (si corresponde)</Label>
        <Input placeholder="Número de legajo RNVA" {...register("rnvaLicense")} />
      </div>

      <div className="grid gap-2">
        <Label>Descripción institucional</Label>
        <Textarea
          rows={5}
          placeholder="Contanos a que se dedica tu institucion, que cursos ofrece y a quien estan dirigidos."
          {...register("description")}
        />
      </div>

      <div className={cn("grid gap-4", variant === "compact" ? "grid-cols-1" : "md:grid-cols-2")}>
        <div className="grid min-w-0 gap-2">
          <Label>Logo</Label>
          <div className="min-w-0 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800/80 dark:bg-slate-900/30">
            <Input
              type="file"
              accept="image/*"
              disabled={submitting}
              className="min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
              onChange={(event) => handleUpload("logoUrl", "employment/companies", event.target.files?.[0])}
            />
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <UploadCloud className="h-4 w-4" />
              <span>{logoUrl ? "Logo listo para publicar" : "Subi el logo institucional"}</span>
            </div>
          </div>
          {logoUrl ? (
            <FilePreview
              url={logoUrl}
              title="Vista previa del logo"
              description="Miniatura del archivo cargado."
              variant="compact"
            />
          ) : null}
        </div>

        <div className="grid min-w-0 gap-2">
          <Label>Portada</Label>
          <div className="min-w-0 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800/80 dark:bg-slate-900/30">
            <Input
              type="file"
              accept="image/*"
              disabled={submitting}
              className="min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
              onChange={(event) => handleUpload("coverUrl", "employment/companies", event.target.files?.[0])}
            />
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <ImagePlus className="h-4 w-4" />
              <span>{coverUrl ? "Portada lista para publicar" : "Subí una portada opcional para tu ficha"}</span>
            </div>
          </div>
          {coverUrl ? (
            <FilePreview
              url={coverUrl}
              title="Vista previa de la portada"
              description="Miniatura del archivo cargado."
              variant="compact"
            />
          ) : null}
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-5 dark:border-slate-800/80 dark:bg-slate-900/30">
        <Checkbox
          id={`acceptedTerms-${variant}`}
          checked={watch("acceptedTerms")}
          onCheckedChange={(value) => setValue("acceptedTerms", Boolean(value), { shouldValidate: true, shouldDirty: true })}
        />
        <div className="grid gap-1">
          <Label htmlFor={`acceptedTerms-${variant}`}>Acepto términos, privacidad y validación administrativa</Label>
          <p className="text-xs leading-6 text-slate-500">
            La institucion queda creada con onboarding completo y puede ingresar al dashboard; la publicacion institucional se valida desde ACAV.
          </p>
          {errors.acceptedTerms ? <p className="text-sm text-destructive">{errors.acceptedTerms.message}</p> : null}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {submitting ? "Creando cuenta institucional..." : submitLabel}
      </Button>
    </form>
  );
}
