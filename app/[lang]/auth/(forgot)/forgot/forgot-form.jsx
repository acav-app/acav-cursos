"use client";
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { buildLocalizedPath, cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sendResetPasswordEmail } from "@/lib/firebase";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getFirebasePasswordResetErrorMessage } from "@/lib/auth/firebase-error-messages";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
const schema = z.object({
  email: z.string().email({ message: "El email es inválido." }),
});
const ForgotForm = () => {
  const [isPending, startTransition] = React.useTransition();
  const [submitError, setSubmitError] = React.useState("");
  const [sentEmail, setSentEmail] = React.useState("");
  const shouldReduceMotion = useReducedMotion();
  const pathname = usePathname();
  const currentLang = pathname?.split("/")[1] || "es";
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    mode: "all",
  });

  const onSubmit = (data) => {
    startTransition(async () => {
      try {
        const email = String(data.email || "").trim().toLowerCase();
        setSubmitError("");
        await sendResetPasswordEmail(email);
        setSentEmail(email);
        toast.success("Te enviamos el correo de recuperación.");
        reset();
      } catch (error) {
        const message = getFirebasePasswordResetErrorMessage(error);
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
      <div className="rounded-[28px] border border-[#D9E2F2] bg-[#F8FBFF] p-5 dark:border-slate-800/80 dark:bg-slate-900/30">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#E8F0FF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1B2B50]">
          <Mail className="h-3.5 w-3.5" />
          Recuperación segura
        </div>
        <div className="mt-4 text-3xl font-bold tracking-tight text-default-900">Restablecé tu contraseña</div>
        <div className="mt-2 text-sm leading-7 text-default-600">
          Ingresá tu email de acceso y te enviamos un enlace para recuperar la cuenta en pocos pasos.
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid gap-5">
        <AnimatePresence mode="popLayout">
          {submitError ? (
            <motion.div key="submitError" {...alertMotion}>
              <Alert color="destructive" variant="soft" className="rounded-2xl border border-destructive/20 px-4 py-3">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            </motion.div>
          ) : null}
          {sentEmail ? (
            <motion.div key="sentEmail" {...alertMotion}>
              <Alert color="success" variant="soft" className="rounded-2xl border border-success/20 px-4 py-3">
                <AlertDescription>
                  Te enviamos un enlace de recuperación a {sentEmail}. Revisá también spam o promociones.
                </AlertDescription>
              </Alert>
            </motion.div>
          ) : null}
        </AnimatePresence>
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

        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-default-600 dark:border-slate-800/80 dark:bg-slate-900/30">
          <div className="flex items-center gap-2 font-medium text-default-800">
            <ShieldCheck className="h-4 w-4 text-[#1B2B50]" />
            Qué pasa después
          </div>
          <p className="mt-1">
            Te enviamos un enlace oficial de Firebase para restablecer tu contraseña sin exponer datos sensibles.
          </p>
        </div>

        <Button className="w-full rounded-2xl" size="lg" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isPending ? "Enviando..." : sentEmail ? "Reenviar correo de recuperación" : "Enviar correo de recuperación"}
        </Button>
      </form>

      <div className="mt-5 text-center text-base text-default-600">
        ¿Ya lo recordaste?{" "}
        <Link href={buildLocalizedPath("/auth/login", currentLang)} className="font-medium text-primary">
          Volver a iniciar sesión
        </Link>
      </div>
      <div className="mt-2 text-center text-sm text-default-600">
        ¿Necesitas crear una cuenta institucional?{" "}
        <Link href={buildLocalizedPath("/auth/login", currentLang)} className="font-medium text-primary">
          Hacelo desde el acceso principal
        </Link>
      </div>
    </div>
  );
};

export default ForgotForm;
