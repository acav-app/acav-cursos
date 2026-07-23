import { redirect } from "next/navigation";

export const metadata = {
  title: "Publicar curso",
};

export default function PublicarPuestoPage({ params: { lang } }) {
  redirect(`/${lang}/publicar-curso`);
}
