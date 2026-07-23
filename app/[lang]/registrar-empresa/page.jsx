import { redirect } from "next/navigation";

export const metadata = {
  title: "Registrar institucion",
};

export default async function RegistrarEmpresaPage({ params: { lang } }) {
  redirect(`/${lang}/registrar-institucion`);
}
