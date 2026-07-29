import { redirect } from "next/navigation";

export default async function CampusEnrollmentsPage({ params: { lang } }) {
  redirect(`/${lang}/dashboard/inscripciones`);
}
