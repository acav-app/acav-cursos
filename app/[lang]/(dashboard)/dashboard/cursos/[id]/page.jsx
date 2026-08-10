"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLocalizedPath } from "@/lib/utils";
import CourseWizard from "@/components/courses/dashboard/course-wizard";

export default function EditarCursoPage({ params: { id } }) {
  const buildLocalizedPath = useLocalizedPath();

  return (
    <div className="mx-auto">
      <div>
        <CourseWizard jobId={id} />
      </div>
    </div>
  );
}
