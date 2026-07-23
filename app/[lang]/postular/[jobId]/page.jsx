import { notFound, redirect } from "next/navigation";
import { getPublicCourseById } from "@/lib/courses/public";

export const metadata = {
  title: "Inscribirse",
};

export default async function PostularPage({ params: { lang, jobId } }) {
  const job = await getPublicCourseById(jobId);
  if (!job) notFound();
  redirect(`/${lang}/cursos/${job.slug}?inscribirse=${jobId}`);
}
