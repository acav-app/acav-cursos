import { redirect } from "next/navigation";

export default async function CandidateProfilePage({ params: { lang } }) {
  redirect(`/${lang}/mi-campus`);
}
