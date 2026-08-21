"use client";

import Link from "next/link";
import { ArrowLeft, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocalizedPath } from "@/lib/utils";
import CourseWizard from "@/components/courses/dashboard/course-wizard";

export default function EditarCursoPage({ params: { id } }) {
  const buildLocalizedPath = useLocalizedPath();

  return (
    <div className="mx-auto">
      <div className="mb-4 flex justify-end">
        <Button type="button" variant="outline" asChild className="rounded-2xl">
          <Link href={buildLocalizedPath(`/dashboard/cursos/${id}/foro`)}>
            <MessagesSquare className="mr-2 h-4 w-4" />
            Foro del curso
          </Link>
        </Button>
      </div>
      <div>
        <CourseWizard jobId={id} />
      </div>
    </div>
  );
}
