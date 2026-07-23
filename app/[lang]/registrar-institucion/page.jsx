import PublicCoursesShell from "@/components/courses/public-shell";
import InstitutionSignupForm from "@/components/courses/institution-signup-form";
import { getPublicCourseSettings } from "@/lib/courses/public";

export const metadata = {
  title: "Registrar institucion",
};

export default async function RegistrarInstitucionPage({ params: { lang } }) {
  const settings = await getPublicCourseSettings();

  return (
    <PublicCoursesShell lang={lang} settings={settings} navMode="routes">
      <main className="bg-slate-50 pt-[68px]">
        <section className="mx-auto max-w-[1180px] px-6 py-16">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[22px] bg-[linear-gradient(160deg,rgba(27,43,80,.97)_0%,rgba(49,69,111,.88)_100%)] p-10 text-white shadow-[0_16px_48px_rgba(27,43,80,.18)]">
              <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#DD4913]">
                <span className="h-0.5 w-7 rounded bg-[#DD4913]" />
                Instituciones ACAV
              </div>
              <h1 className="mt-5 text-4xl font-extrabold tracking-tight">Tu institucion puede registrarse sola</h1>
              <p className="mt-5 text-sm leading-7 text-white/75">
                Este flujo crea el acceso en Firebase Auth, la ficha institucional y el perfil interno del portal
                para que no dependas del super admin en el alta inicial.
              </p>

              <div className="mt-8 grid gap-4">
                {[
                  "Creacion automatica del usuario institucional",
                  "Vinculación inmediata con la ficha institucional",
                  "Estado inicial pendiente para validacion",
                  "Acceso posterior al dashboard de cursos",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/80">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <InstitutionSignupForm lang={lang} />
          </div>
        </section>
      </main>
    </PublicCoursesShell>
  );
}
