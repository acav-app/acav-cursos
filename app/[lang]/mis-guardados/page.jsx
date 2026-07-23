import { redirect } from "next/navigation";

export default async function CandidateSavedJobsPage({ params: { lang } }) {
  redirect(`/${lang}/mis-cursos`);
}
