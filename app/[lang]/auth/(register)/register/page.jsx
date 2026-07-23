import AuthShell from "@/components/auth/auth-shell";
import RegForm from "./reg-form";

const RegPage = ({ params: { lang } }) => {
  return (
    <AuthShell
      lang={lang}
      eyebrow="Registro de usuarios"
      title="Creá un acceso listo para tu rol"
      description="El registro general genera el usuario y su perfil interno para que el ingreso al campus no vuelva a fallar."
      highlights={[
        {
          title: "Perfil interno creado",
          description: "El alta deja el usuario vinculado al portal de cursos desde el primer acceso.",
        },
        {
          title: "Redirección limpia",
          description: "Despues del registro ingresas automaticamente y ves el panel acorde a tu perfil.",
        },
        {
          title: "Alternativa institucional",
          description: "Si representas una institucion, usa el flujo especifico desde login para crear tambien la ficha institucional.",
        },
        {
          title: "Mensajes claros",
          description: "Validaciones, errores y siguientes pasos quedan visibles en cada estado del formulario.",
        },
      ]}
    >
      <div className="p-1 lg:p-2">
        <RegForm />
      </div>
    </AuthShell>
  );
};

export default RegPage;
