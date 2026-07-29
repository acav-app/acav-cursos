import { redirect } from "next/navigation";

export default async function CampusCertificatesPage({ params: { lang } }) {
  redirect(`/${lang}/dashboard/certificados`);
}
