import AuthShell from "@/components/auth/auth-shell";
import ForgotForm from "./forgot-form";

const ForgotPage = ({ params: { lang } }) => {
  return (
    <AuthShell
      lang={lang}
      eyebrow="Recuperación de acceso"
      title="Volvé a entrar sin fricción"
      description="Centralizamos el reseteo de contraseña con una experiencia clara, segura y coherente con el resto del acceso al portal."
      highlights={[
        {
          title: "Correo oficial",
          description: "El enlace de recuperación sale por el flujo seguro de Firebase y respeta la cuenta original.",
        },
        {
          title: "Sin pasos extra",
          description: "Pedimos solo el dato necesario para recuperar el acceso y volver al login.",
        },
        {
          title: "Mensajes accionables",
          description: "Si el email no existe o está mal escrito, el sistema te lo indica con claridad.",
        },
        {
          title: "Experiencia consistente",
          description: "La recuperación mantiene el mismo estándar visual y operativo del nuevo auth de ACAV.",
        },
      ]}
    >
      <div className="p-1 lg:p-2">
        <ForgotForm />
      </div>
    </AuthShell>
  );
};

export default ForgotPage;
