import AuthShell from "@/components/auth/auth-shell";
import LogInForm from "@/components/auth/login-form";

const LoginPage = ({ params: { lang } }) => {
  return (
    <AuthShell
      lang={lang}
      eyebrow="Acceso y registro"
      title="Ingresá y activá el alta institucional solo cuando la necesites"
      description="La vista principal prioriza inicio de sesión y registro de alumnos; el formulario institucional sigue disponible dentro de esta misma ruta de forma reservada."
      highlights={[
        {
          title: "Acceso alumno claro",
          description: "Login y registro personal quedan al frente para evitar confusion en el flujo publico.",
        },
        {
          title: "Alta institucional reservada",
          description: "El registro de instituciones sigue existiendo pero se activa solo desde un CTA especifico dentro del login.",
        },
        {
          title: "Campus por rol",
          description: "Cada usuario ve metricas, acciones y contenidos alineados a su perfil real.",
        },
        {
          title: "Flujo profesional",
          description: "UI renovada, pasos simples y datos normalizados desde el primer ingreso.",
        },
      ]}
    >
      <div className="p-1 lg:p-2">
        <LogInForm />
      </div>
    </AuthShell>
  );
};

export default LoginPage;
