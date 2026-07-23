import { redirect } from "next/navigation";

export default async function CandidateApplicationsPage({ params: { lang } }) {
  redirect(`/${lang}/mis-inscripciones`);
}
