import assert from "node:assert/strict";
import {
  buildCatalogOptions,
  filterCourses,
  getCourseCatalogStatus,
} from "../lib/courses/catalog-utils.mjs";

const sampleCourses = [
  {
    id: "course-1",
    title: "Amadeus desde cero",
    shortDescription: "Introducción intensiva a sistemas de reservas.",
    institutionName: "ACAV Academy",
    categoryLabel: "Sistemas",
    modalityLabel: "100% Online",
    level: "Principiante",
    duration: "12 horas",
    status: "activa",
    publicationStatus: "activa",
  },
  {
    id: "course-2",
    title: "Ventas en turismo",
    shortDescription: "Formación comercial aplicada a agencias.",
    institutionName: "Viajes Finder",
    categoryLabel: "Comercial",
    modalityLabel: "En vivo",
    level: "Intermedio",
    duration: "8 horas",
    progress: 42,
    status: "activa",
    publicationStatus: "activa",
  },
  {
    id: "course-3",
    title: "Gestión hotelera avanzada",
    shortDescription: "Programa ejecutivo con enfoque operativo.",
    institutionName: "Hotel Lab",
    categoryLabel: "Hotelería",
    modalityLabel: "Híbrido",
    level: "Avanzado",
    duration: "16 horas",
    publicationStatus: "borrador",
    allowEnrollment: false,
    status: "borrador",
  },
];

const options = buildCatalogOptions(sampleCourses);
assert.equal(options.categories.includes("Sistemas"), true);
assert.equal(options.modalities.includes("En vivo"), true);
assert.equal(options.institutions.includes("Viajes Finder"), true);

const queryResults = filterCourses(sampleCourses, { query: "amadeus" });
assert.equal(queryResults.length, 1);
assert.equal(queryResults[0].id, "course-1");

const institutionResults = filterCourses(sampleCourses, { institution: "Viajes Finder" });
assert.equal(institutionResults.length, 1);
assert.equal(institutionResults[0].id, "course-2");

const statusResults = filterCourses(sampleCourses, { status: "En progreso" });
assert.equal(statusResults.length, 1);
assert.equal(statusResults[0].id, "course-2");
assert.equal(getCourseCatalogStatus(sampleCourses[1]).label, "En progreso");

const draftResults = filterCourses(sampleCourses, { status: "Próximo" });
assert.equal(draftResults.length, 1);
assert.equal(draftResults[0].id, "course-3");

console.log("course-catalog-filters: ok");
