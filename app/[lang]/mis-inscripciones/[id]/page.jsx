import { redirect } from "next/navigation";

export default async function CampusEnrollmentDetailPage({ params: { lang, id } }) {
  redirect(`/${lang}/dashboard/inscripciones/${id}`);
}
