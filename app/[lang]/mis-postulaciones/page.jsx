import { redirect } from "next/navigation";

export default async function CandidateApplicationsPage({ params: { lang } }) {
  redirect(`/${lang}/dashboard/inscripciones`);
}
