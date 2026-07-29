import { redirect } from "next/navigation";

export default async function CandidateApplicationDetailPage({ params: { lang, id } }) {
  redirect(`/${lang}/dashboard/inscripciones/${id}`);
}
