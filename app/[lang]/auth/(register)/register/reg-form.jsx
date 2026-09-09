"use client";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User } from "lucide-react";
import toast from "react-hot-toast";
import { buildLocalizedPath, cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import { Checkbox } from "@/components/ui/checkbox";
import { loginWithEmail } from "@/lib/firebase";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getFirebaseRegisterErrorMessage } from "@/lib/auth/firebase-error-messages";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { resolveCoursePostLoginPath } from "@/lib/courses/client/resolve-post-login-path";

const schema = z
  .object({
    firstName: z.string().min(2, { message: "El nombre es obligatorio." }),
    lastName: z.string().min(2, { message: "El apellido es obligatorio." }),
    documentNumber: z.string().min(4, { message: "El DNI es obligatorio." }),
    email: z.string().email({ message: "El email es inválido." }),
    contactEmail: z.string().optional().refine(
      (value) => {
        if (!value) return true;
        const valid = z.string().email().safeParse(value);
        return valid.success;
      },
      { message: "El email de contacto es inválido." }
    ),
    password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres." }),
    confirmPassword: z.string().min(6, { message: "Repetí la contraseña." }),
    agency: z.string().optional(),
    employeeFileNumber: z.string().optional(),
    phone: z.string().optional(),
    isMember: z.boolean().default(false),
    acceptedTerms: z.boolean().refine((value) => value === true, {
      message: "Debes aceptar los términos y condiciones.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  })
  .superRefine((data) => {
    if (data.isMember && !String(data.employeeFileNumber || "").trim()) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ["employeeFileNumber"],
          message: "El legajo es obligatorio para socios ACAV.",
        },
      ]);
    }
  });
const RegForm = ({
  variant = "page",
  showHeader = variant !== "compact",
  showFooterLinks = variant !== "compact",
}) => {
  const [isPending, startTransition] = React.useTransition();
  const [passwordType, setPasswordType] = useState("password");
  const [confirmPasswordType, setConfirmPasswordType] = useState("password");
  const [submitError, setSubmitError] = useState("");
  const [submitInfo, setSubmitInfo] = useState("");
  const shouldReduceMotion = useReducedMotion();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const togglePasswordType = () => {
    if (passwordType === "text") {
      setPasswordType("password");
    } else if (passwordType === "password") {
      setPasswordType("text");
    }
  };
  const toggleConfirmPasswordType = () => {
    if (confirmPasswordType === "text") {
      setConfirmPasswordType("password");
    } else if (confirmPasswordType === "password") {
      setConfirmPasswordType("text");
    }
  };
  const currentLang = pathname?.split("/")[1] || "es";
  const redirectParam = String(searchParams.get("redirect") || "").trim();
  const safeRedirectPath = redirectParam.startsWith("/") ? redirectParam : "";
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    mode: "all",
    defaultValues: {
      firstName: "",
      lastName: "",
      documentNumber: "",
      email: "",
      contactEmail: "",
      password: "",
      confirmPassword: "",
      agency: "",
      employeeFileNumber: "",
      phone: "",
      isMember: false,
      acceptedTerms: false,
    },
  });

  const onSubmit = (data) => {
    startTransition(async () => {
      try {
        const payload = {
          firstName: String(data.firstName || "").trim(),
          lastName: String(data.lastName || "").trim(),
          documentNumber: String(data.documentNumber || "").trim(),
          email: String(data.email || "").trim().toLowerCase(),
          contactEmail: String(data.contactEmail || "").trim().toLowerCase() || undefined,
          password: data.password,
          agency: String(data.agency || "").trim() || undefined,
          employeeFileNumber: String(data.employeeFileNumber || "").trim() || undefined,
          phone: String(data.phone || "").trim() || undefined,
          isMember: Boolean(data.isMember),
          acceptedTerms: data.acceptedTerms,
        };
        setSubmitError("");
        setSubmitInfo("Creando tu cuenta y vinculando el perfil interno...");
        const res = await fetch("/api/courses/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(result?.error || result?.message || "request_failed");
        }

        const credentials = await loginWithEmail(payload.email, data.password);
        toast.success("Cuenta creada correctamente.");
        reset();
        const nextPath = await resolveCoursePostLoginPath(credentials.user, currentLang, safeRedirectPath);
        window.location.assign(nextPath);
      } catch (error) {
        const message = getFirebaseRegisterErrorMessage(error);
        setSubmitInfo("");
        setSubmitError(message);
        toast.error(message);
      }
    });
  };

  const alertMotion = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: -6 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
        transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
      };

  return (
    <div className="w-full">
      {showHeader ? (
        <div className="rounded-[28px] border border-[#D9E2F2] bg-[#F8FBFF] p-5 dark:border-slate-800/80 dark:bg-slate-900/30">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#E8F0FF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1B2B50]">
            <User className="h-3.5 w-3.5" />
            Registro personal
          </div>
          <div className="mt-4 text-3xl font-bold tracking-tight text-default-900">Creá tu acceso al portal</div>
          <div className="mt-2 text-sm leading-7 text-default-600">
            Registrate como usuario del ecosistema ACAV Cursos.
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className={`grid gap-5 ${showHeader ? "mt-6" : ""}`}>
        <AnimatePresence mode="popLayout">
          {submitError ? (
            <motion.div key="submitError" {...alertMotion}>
              <Alert color="destructive" variant="soft" className="rounded-2xl border border-destructive/20 px-4 py-3">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            </motion.div>
          ) : null}
          {submitInfo ? (
            <motion.div key="submitInfo" {...alertMotion}>
              <Alert color="info" variant="soft" className="rounded-2xl border border-info/20 px-4 py-3">
                <AlertDescription>{submitInfo}</AlertDescription>
              </Alert>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="firstName" className="mb-2 font-medium text-default-700">
              Nombre
            </Label>
            <Input
              disabled={isPending}
              {...register("firstName")}
              type="text"
              id="firstName"
              className={cn("rounded-2xl", {
                "border-destructive": errors.firstName,
              })}
              size="xl"
            />
            {errors.firstName && <div className="mt-2 text-sm text-destructive">{errors.firstName.message}</div>}
          </div>

          <div>
            <Label htmlFor="lastName" className="mb-2 font-medium text-default-700">
              Apellido
            </Label>
            <Input
              disabled={isPending}
              {...register("lastName")}
              type="text"
              id="lastName"
              className={cn("rounded-2xl", {
                "border-destructive": errors.lastName,
              })}
              size="xl"
            />
            {errors.lastName && <div className="mt-2 text-sm text-destructive">{errors.lastName.message}</div>}
          </div>
        </div>

        <div>
          <Label htmlFor="documentNumber" className="mb-2 font-medium text-default-700">
            DNI <span className="text-destructive">*</span>
          </Label>
          <Input
            disabled={isPending}
            {...register("documentNumber")}
            type="text"
            id="documentNumber"
            inputMode="numeric"
            placeholder="Ej: 12345678"
            className={cn("rounded-2xl", {
              "border-destructive": errors.documentNumber,
            })}
            size="xl"
          />
          {errors.documentNumber && <div className="mt-2 text-sm text-destructive">{errors.documentNumber.message}</div>}
        </div>

        <div>
          <Label htmlFor="email" className="mb-2 font-medium text-default-700">
            Email
          </Label>
          <Input
            disabled={isPending}
            {...register("email", {
              setValueAs: (value) => String(value || "").trim().toLowerCase(),
            })}
            type="email"
            id="email"
            className={cn("rounded-2xl", {
              "border-destructive": errors.email,
            })}
            size="xl"
          />
          {errors.email && <div className="mt-2 text-sm text-destructive">{errors.email.message}</div>}
        </div>

        <div>
          <Label htmlFor="contactEmail" className="mb-2 font-medium text-default-700">
            Email de contacto
          </Label>
          <Input
            disabled={isPending}
            {...register("contactEmail", {
              setValueAs: (value) => (value ? String(value).trim().toLowerCase() : ""),
            })}
            type="email"
            id="contactEmail"
            placeholder="Opcional. Si es diferente al email de inicio."
            className={cn("rounded-2xl", {
              "border-destructive": errors.contactEmail,
            })}
            size="xl"
          />
          {errors.contactEmail && <div className="mt-2 text-sm text-destructive">{errors.contactEmail.message}</div>}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="phone" className="mb-2 font-medium text-default-700">
              Teléfono
            </Label>
            <Input
              disabled={isPending}
              {...register("phone")}
              type="tel"
              id="phone"
              placeholder="Opcional"
              className={cn("rounded-2xl", {
                "border-destructive": errors.phone,
              })}
              size="xl"
            />
          </div>

          <div>
            <Label htmlFor="agency" className="mb-2 font-medium text-default-700">
              Agencia
            </Label>
            <Input
              disabled={isPending}
              {...register("agency")}
              type="text"
              id="agency"
              placeholder="Opcional"
              className={cn("rounded-2xl", {
                "border-destructive": errors.agency,
              })}
              size="xl"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="employeeFileNumber" className="mb-2 font-medium text-default-700">
            Legajo {watch("isMember") ? <span className="text-destructive">*</span> : ""}
          </Label>
          <Input
            disabled={isPending}
            {...register("employeeFileNumber")}
            type="text"
            id="employeeFileNumber"
            placeholder={watch("isMember") ? "Obligatorio para socios ACAV" : "Opcional"}
            className={cn("rounded-2xl", {
              "border-destructive": errors.employeeFileNumber,
            })}
            size="xl"
          />
          {errors.employeeFileNumber && <div className="mt-2 text-sm text-destructive">{errors.employeeFileNumber.message}</div>}
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 dark:border-slate-800/80 dark:bg-slate-900/30">
          <div className="flex items-start gap-3">
            <Checkbox
              size="sm"
              className="mt-1 border-default-300 dark:border-slate-700"
              id="isMember"
              checked={Boolean(watch("isMember"))}
              onCheckedChange={(value) => setValue("isMember", Boolean(value), { shouldValidate: true })}
            />
            <div>
              <Label htmlFor="isMember" className="cursor-pointer text-sm font-medium text-default-700">
                Socio ACAV
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">Marca esta opción si eres socio registrado.</p>
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="password" className="mb-2 font-medium text-default-700">
            Contraseña definitiva
          </Label>
          <div className="relative">
            <Input
              type={passwordType}
              id="password"
              size="xl"
              disabled={isPending}
              {...register("password")}
              className={cn("rounded-2xl pr-11", {
                "border-destructive": errors.password,
              })}
            />
            <button
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-default-400"
              onClick={togglePasswordType}
            >
              {passwordType === "password" ? (
                <Icon icon="heroicons:eye" className="h-5 w-5" />
              ) : (
                <Icon icon="heroicons:eye-slash" className="h-5 w-5" />
              )}
            </button>
          </div>
          {errors.password && <div className="mt-2 text-sm text-destructive">{errors.password.message}</div>}
        </div>

        <div>
          <Label htmlFor="confirmPassword" className="mb-2 font-medium text-default-700">
            Repetir contraseña
          </Label>
          <div className="relative">
            <Input
              type={confirmPasswordType}
              id="confirmPassword"
              size="xl"
              disabled={isPending}
              {...register("confirmPassword")}
              className={cn("rounded-2xl pr-11", {
                "border-destructive": errors.confirmPassword,
              })}
            />
            <button
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-default-400"
              onClick={toggleConfirmPasswordType}
            >
              {confirmPasswordType === "password" ? (
                <Icon icon="heroicons:eye" className="h-5 w-5" />
              ) : (
                <Icon icon="heroicons:eye-slash" className="h-5 w-5" />
              )}
            </button>
          </div>
          {errors.confirmPassword ? <div className="mt-2 text-sm text-destructive">{errors.confirmPassword.message}</div> : null}
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 dark:border-slate-800/80 dark:bg-slate-900/30">
          <div className="flex items-start gap-3">
            <Checkbox
              size="sm"
              className="mt-1 border-default-300 dark:border-slate-700"
              id="terms"
              checked={watch("acceptedTerms")}
              onCheckedChange={(value) => setValue("acceptedTerms", Boolean(value), { shouldValidate: true })}
            />
            <div>
              <Label htmlFor="terms" className="cursor-pointer text-sm font-medium text-default-700">
                Acepto terminos y condiciones del portal
              </Label>
            </div>
          </div>
          {errors.acceptedTerms ? <div className="mt-3 text-sm text-destructive">{errors.acceptedTerms.message}</div> : null}
        </div>

        <Button className="w-full rounded-2xl" disabled={isPending} size="lg">
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isPending ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
      </form>

      {showFooterLinks ? (
        <>
          <div className="mt-5 text-center text-base text-default-600">
            ¿Ya tenés cuenta?{" "}
            <Link href={buildLocalizedPath("/auth/login", currentLang)} className="font-medium text-primary">
              Iniciar sesión
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default RegForm;
