import { notFound, redirect } from "next/navigation";
import { getPublicCourseById } from "@/lib/courses/public";

export default async function InscribirseAliasPage({ params: { lang, courseId } }) {
  const course = await getPublicCourseById(courseId);
  if (!course) notFound();
  redirect(`/${lang}/cursos/${course.slug}?inscribirse=${courseId}`);
}
