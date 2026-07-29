import { redirect } from "next/navigation";

export default async function CampusCoursesPage({ params: { lang } }) {
  redirect(`/${lang}/dashboard/mis-cursos`);
}
