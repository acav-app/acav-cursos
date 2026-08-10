"use client";
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Building2, Loader2, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { loginWithEmail } from "@/lib/firebase";
import toast from "react-hot-toast";
import { cn, buildLocalizedPath } from "@/lib/utils";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { Checkbox } from "@/components/ui/checkbox";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import InstitutionSignupForm from "@/components/courses/institution-signup-form";
import { getFirebaseLoginErrorMessage } from "@/lib/auth/firebase-error-messages";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SiteLogo } from "@/components/svg";
import RegForm from "@/app/[lang]/auth/(register)/register/reg-form";
import { resolveCoursePostLoginPath } from "@/lib/courses/client/resolve-post-login-path";

const COMPANY_FLOW_PARAM = "tipo";
const COMPANY_FLOW_VALUE = "empresa";

const schema = z.object({
  email: z.string().email({ message: "El correo no es válido." }),
  password: z
    .string()
    .min(4, { message: "La contraseña debe tener al menos 4 caracteres." }),
});

const LogInForm = () => {
  const [isPending, startTransition] = React.useTransition();
  const [passwordType, setPasswordType] = React.useState("password");
  const [submitError, setSubmitError] = React.useState("");
  const [submitInfo, setSubmitInfo] = React.useState("");
  const shouldReduceMotion = useReducedMotion();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = String(searchParams.get("redirect") || "").trim();
  const safeRedirectPath = redirectParam.startsWith("/") ? redirectParam : "";
  const getCurrentLang = () => {
    const segments = pathname.split("/");
    return segments[1] || "es";
  };
  const companyFlow = searchParams.get(COMPANY_FLOW_PARAM) === COMPANY_FLOW_VALUE;

  const toggleCompanyFlow = (enabled) => {
    const params = new URLSearchParams(searchParams.toString());
    if (enabled) {
      params.set(COMPANY_FLOW_PARAM, COMPANY_FLOW_VALUE);
    } else {
      params.delete(COMPANY_FLOW_PARAM);
    }
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  };

  const togglePasswordType = () => {
    if (passwordType === "text") {
      setPasswordType("password");
    } else if (passwordType === "password") {
      setPasswordType("text");
    }
  };
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    mode: "all",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data) => {
    startTransition(async () => {
      try {
        setSubmitError("");
        setSubmitInfo("Validando acceso y preparando tu panel...");
        const credentials = await loginWithEmail(
          String(data.email || "")
            .trim()
            .toLowerCase(),
          data.password,
        );
        toast.success("Inicio de sesión exitoso");
        const lang = getCurrentLang();
        const nextPath = await resolveCoursePostLoginPath(credentials.user, lang, safeRedirectPath);
        window.location.assign(nextPath);
        reset();
      } catch (error) {
        const msg = getFirebaseLoginErrorMessage(error);
        setSubmitInfo("");
        setSubmitError(msg);
        toast.error(msg);
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
      <div className="rounded-[28px] border border-[#D9E2F2] bg-[#F8FBFF] p-5 dark:border-slate-800/80 dark:bg-slate-900/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#E8F0FF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1B2B50]">
            {companyFlow ? <Building2 className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
            {companyFlow ? "Registro institucional" : "Acceso ACAV"}
          </div>
          <div className="flex justify-start sm:justify-end">
            <div className="rounded-[22px] border border-[#C8D8F5] bg-white px-4 py-3 shadow-[0_14px_36px_rgba(27,43,80,0.08)] dark:border-slate-800 dark:bg-slate-950 dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
              <SiteLogo withBg className="h-9 md:h-10" />
            </div>
          </div>
        </div>
      </div>

      {companyFlow ? (
        <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-950">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xl font-semibold tracking-tight text-default-900">
                Alta reservada para instituciones
              </div>
              <p className="mt-1 text-sm leading-7 text-default-600">
                Completá el alta institucional solo si necesitás administrar una institución o unidad académica dentro de ACAV Cursos.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() => toggleCompanyFlow(false)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a alumnos
            </Button>
          </div>

          <InstitutionSignupForm
            lang={getCurrentLang()}
            variant="compact"
            showHeader={false}
            submitLabel="Crear cuenta institucional"
          />
        </div>
      ) : (
        <Tabs defaultValue="login" className="mt-6">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-[22px] bg-slate-100 p-1 dark:bg-slate-900/40">
            <TabsTrigger
              value="login"
              className="rounded-[18px] py-3 text-sm font-semibold"
            >
              Iniciar sesión
            </TabsTrigger>
            <TabsTrigger
              value="register"
              className="rounded-[18px] py-3 text-sm font-semibold"
            >
              Crear cuenta alumno
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-4">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-950">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-semibold tracking-tight text-default-900">
                    Bienvenido de nuevo
                  </div>
                  <p className="mt-1 text-sm leading-7 text-default-600">
                    Ingresá con tu cuenta para administrar tus datos.
                  </p>
                </div>
                <div className="hidden rounded-2xl border border-[#D9E2F2] bg-[#F8FBFF] p-3 text-[#1B2B50] dark:border-slate-800/80 dark:bg-slate-900/30 dark:text-slate-200 md:flex">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="mt-5">
                <AnimatePresence mode="popLayout">
                  {submitError ? (
                    <motion.div key="submitError" {...alertMotion}>
                      <Alert
                        color="destructive"
                        variant="soft"
                        className="mb-4 rounded-2xl border border-destructive/20 px-4 py-3"
                      >
                        <AlertDescription>{submitError}</AlertDescription>
                      </Alert>
                    </motion.div>
                  ) : null}
                  {submitInfo ? (
                    <motion.div key="submitInfo" {...alertMotion}>
                      <Alert
                        color="info"
                        variant="soft"
                        className="mb-4 rounded-2xl border border-info/20 px-4 py-3"
                      >
                        <AlertDescription>{submitInfo}</AlertDescription>
                      </Alert>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                <div>
                  <Label
                    htmlFor="email"
                    className="mb-2 text-sm font-medium text-default-700"
                  >
                    Correo electrónico
                  </Label>
                  <Input
                    disabled={isPending}
                    {...register("email", {
                      setValueAs: (value) =>
                        String(value || "")
                          .trim()
                          .toLowerCase(),
                    })}
                    type="email"
                    id="email"
                    className={cn("rounded-2xl", {
                      "border-destructive": errors.email,
                    })}
                    size="xl"
                  />
                </div>
                {errors.email && (
                  <div className="mt-2 text-sm text-destructive">
                    {errors.email.message}
                  </div>
                )}

                <div className="mt-4">
                  <Label
                    htmlFor="password"
                    className="mb-2 text-sm font-medium text-default-700"
                  >
                    Contraseña
                  </Label>
                  <div className="relative">
                    <Input
                      disabled={isPending}
                      {...register("password")}
                      type={passwordType}
                      id="password"
                      className={cn("rounded-2xl pr-11", {
                        "border-destructive": errors.password,
                      })}
                      size="xl"
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
                </div>
                {errors.password && (
                  <div className="mt-2 text-sm text-destructive">
                    {errors.password.message}
                  </div>
                )}

                <div className="mt-5 mb-6 flex flex-wrap items-center gap-3">
                  <div className="flex flex-1 items-center gap-2">
                    <Checkbox
                      size="sm"
                      className="border-default-300 dark:border-slate-700"
                      id="isRemembered"
                    />
                    <Label
                      htmlFor="isRemembered"
                      className="cursor-pointer whitespace-nowrap text-sm text-default-600"
                    >
                      Mantener sesión
                    </Label>
                  </div>
                  <Link
                    href={buildLocalizedPath("/auth/forgot", getCurrentLang())}
                    className="text-sm font-medium text-primary"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <Button
                  className="w-full rounded-2xl"
                  disabled={isPending}
                  size="lg"
                >
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isPending ? "Ingresando..." : "Iniciar sesión"}
                </Button>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="register" className="mt-4">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-950">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-semibold tracking-tight text-default-900">
                    Crear cuenta de alumno
                  </div>
                  <p className="mt-1 text-sm leading-7 text-default-600">
                    Registrate con tus datos personales para ingresar al portal y gestionar tus inscripciones.
                  </p>
                </div>
                <div className="hidden rounded-2xl border border-[#D9E2F2] bg-[#F8FBFF] p-3 text-[#1B2B50] dark:border-slate-800/80 dark:bg-slate-900/30 dark:text-slate-200 md:flex">
                  <UserPlus className="h-5 w-5" />
                </div>
              </div>

              <RegForm variant="compact" showHeader={false} showFooterLinks={false} />
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default LogInForm;
