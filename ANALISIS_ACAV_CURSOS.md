# Analisis de Migracion: ACAV Empleo -> ACAV Cursos

## 1. Objetivo

Este documento analiza el proyecto actual, originalmente orientado a portal de empleos, para identificar que partes pueden reutilizarse en la evolucion hacia un portal de cursos virtuales alineado con la propuesta visual y funcional definida en `acav-cursos.html`.

El objetivo no es rehacer la aplicacion desde cero, sino aprovechar la base existente de Next.js, layouts, autenticacion, dashboard, formularios, API interna y componentes UI, reemplazando progresivamente el dominio `employment` por un dominio `courses` o `learning` claro, escalable y mantenible.

## 2. Resumen Ejecutivo

- La base tecnica es valida y reutilizable: `Next.js 14`, `App Router`, `Route Handlers`, `Firebase`, `Firestore`, `React Hook Form`, `Zod`, `Tailwind`, `Radix UI`.
- La arquitectura esta organizada por feature, con un bounded context fuerte en `employment`, lo que facilita una migracion por capas.
- El mayor problema no es visual sino semantico: el dominio de empleo atraviesa rutas, componentes, servicios, schemas, emails, colecciones, roles y configuracion global.
- `acav-cursos.html` ya define un producto objetivo bastante concreto:
  - landing/catalogo publico,
  - panel del alumno,
  - panel administrador.
- La mejor estrategia es migrar la base actual a un dominio de cursos reutilizando shell, dashboard, formularios, cards, tablas y primitives UI, pero evitando mantener nombres heredados como `job`, `application`, `company`, `employmentSettings` o `employmentUsers`.

## 3. Estado Actual del Proyecto

## 3.1 Stack y Arquitectura

- Framework principal: `Next.js 14` con `App Router` y `Route Handlers`.
- Estado y formularios: `React Hook Form`, `Zod`, `TanStack Query`, `Zustand`.
- UI base: `Tailwind CSS`, `Radix UI`, componentes reutilizables en `components/ui`.
- Persistencia y auth: `Firebase`, `Firebase Admin`, `Firestore`.
- Emails: `Resend`.

Archivos clave:

- `package.json`
- `app/`
- `app/api/`
- `lib/employment/`
- `provider/auth.provider.jsx`

## 3.2 Organizacion del Repositorio

La estructura principal esta bien separada por capas:

- `app/[lang]/...`: vistas publicas, auth y dashboard.
- `app/api/...`: API interna.
- `components/employment/...`: componentes de dominio empleo.
- `components/ui/...`: primitives reutilizables.
- `lib/employment/server/...`: logica de negocio y acceso a Firestore.
- `config/...`: menus, configuracion general, branding.
- `provider/...`: providers globales.

Conclusion: la estructura es la correcta para migrar por dominio sin romper el resto del sistema.

## 3.3 Patron Arquitectonico

El proyecto sigue un patron de monolito modular por feature:

- presentacion en `app/` y `components/`,
- negocio en `lib/employment/server/`,
- contratos y validaciones en `lib/employment/schemas.ts`,
- infraestructura en `lib/firebase.js` y `lib/firebase-admin.js`,
- acceso HTTP interno via `app/api`.

Esto es adecuado para evolucionar a cursos si el dominio se renombra de forma consistente.

## 4. Dominio Actual de Empleo

## 4.1 Entidades Reales

Hoy el dominio gira alrededor de:

- `EmploymentUserProfile`
- `EmploymentCompany`
- `EmploymentJob`
- `EmploymentApplication`
- `EmploymentSettings`
- `EmploymentEmailLog`

Fuente principal:

- `lib/employment/schemas.ts`
- `lib/employment/collections.ts`

## 4.2 Colecciones Firestore

Actualmente se usan estas colecciones:

- `companies`
- `jobs`
- `applications`
- `employmentSettings`
- `emailLogs`
- `employmentUsers`

Esto deja claro que el dominio empleo no esta solo en frontend: tambien estructura la base de datos.

## 4.3 Roles y Permisos

Los roles actuales son:

- `admin`
- `empresa`
- `candidato`

La autorizacion depende de estos roles para empresas, busquedas y postulaciones.

Archivo clave:

- `lib/employment/server/auth.ts`

## 4.4 Flujos de Negocio Actuales

Flujo publico actual:

1. Usuario navega empleos.
2. Consulta detalle de puesto.
3. Completa formulario de postulacion.
4. Se guarda una `application`.
5. Se notifican empresa y candidato.

Flujo privado actual:

1. Admin o empresa crea una busqueda.
2. La busqueda puede quedar en borrador o pendiente de revision.
3. Admin aprueba, rechaza, pausa, cierra o reactiva.
4. Empresa o admin revisa postulaciones.

Configuracion actual:

- un panel `configuracion-empleo` edita hero, about, stats y notificaciones del portal.

## 5. Blueprint Objetivo: `acav-cursos.html`

El archivo `acav-cursos.html` ya describe el producto al que conviene migrar.

## 5.1 Vistas Objetivo

### Landing / Catalogo

Incluye:

- navbar de cursos,
- hero institucional,
- catalogo de cursos con filtros,
- beneficios del programa,
- testimonios,
- footer de plataforma educativa.

### Panel Alumno

Incluye:

- dashboard personal,
- cursos activos,
- calendario de clases,
- materiales,
- certificados,
- historial de pagos.

### Panel Admin

Incluye:

- KPIs,
- gestion de cursos,
- gestion de alumnos,
- pagos,
- certificados,
- contenido,
- notificaciones.

Conclusion: el HTML objetivo no contradice la app actual; mas bien confirma que ya existe suficiente infraestructura para soportarlo.

## 6. Elementos Reutilizables del Proyecto Actual

## 6.1 Reutilizacion Alta

Estas piezas pueden migrarse con cambios principalmente semanticos:

- shell publico actual,
- layout del dashboard,
- autenticacion base,
- primitives `components/ui`,
- tablas y filtros,
- formularios multi-step,
- skeletons,
- dropdowns, tabs, dialogs, drawers,
- cards y secciones editoriales.

Archivos especialmente reutilizables:

- `components/employment/public-shell.jsx`
- `components/employment/public-home.jsx`
- `components/employment/candidate-portal-panel.jsx`
- `components/employment/application-public-form.jsx`
- `components/employment/dashboard/job-wizard.jsx`
- `components/employment/dashboard/company-form.jsx`
- `components/ui/data-table-enhanced.jsx`

## 6.2 Reutilizacion Parcial

Estas piezas sirven, pero requieren remodelado de datos:

- `job-card.jsx` -> `course-card`
- `company-card.jsx` -> `instructor-card` o `academy-card`
- detalle de empleo -> detalle de curso
- `mis-postulaciones` -> `mis-inscripciones` o `mi-aprendizaje`
- `mis-guardados` -> `mis-cursos-guardados` o `wishlist`
- dashboard home -> metricas de alumnos/cursos/ingresos

## 6.3 Reutilizacion Baja

Estas piezas estan demasiado acopladas a empleo:

- estados de busquedas,
- logica de aprobacion/rechazo de puestos,
- validaciones de CV, modalidad laboral, contrato y ciudad laboral,
- emails de postulacion,
- `middleware` que redirige todo a `/empleos`,
- colecciones y schemas actuales del dominio.

## 7. Flujo de Datos Actual

## 7.1 Flujo Publico

La home y las paginas publicas usan helpers server-side que consumen la propia API interna.

Ejemplo:

- `lib/employment/public.ts` llama a `/api/jobs`, `/api/companies`, `/api/employment/settings`.

Ventaja:

- centraliza acceso publico.

Debilidad:

- introduce coupling entre SSR y HTTP interno, donde podria llamarse directamente al servicio de dominio.

## 7.2 Flujo Administrativo

El dashboard consume:

- `/api/jobs`
- `/api/companies`
- `/api/applications`
- `/api/employment/settings`
- `/api/employment/users`

La API delega en servicios de `lib/employment/server/*`.

Esto es correcto y conviene mantenerlo, pero renombrando el dominio.

## 7.3 Flujo de Autenticacion

La autenticacion real parece basarse en Firebase, aunque convive con rastros de NextAuth y template heredado.

Esto es un punto de deuda tecnica: antes de escalar cursos conviene consolidar una sola estrategia.

## 8. Principales Incompatibilidades con un Portal de Cursos

## 8.1 Incompatibilidad Semantica

El problema principal es el naming:

- `employment`
- `job`
- `application`
- `company`
- `candidato`
- `empresa`
- `configuracion-empleo`

Estos nombres ya no representan el nuevo negocio.

## 8.2 Incompatibilidad de Modelo

Cursos necesita entidades distintas:

- cursos,
- categorias,
- cohortes o ediciones,
- alumnos,
- inscripciones,
- progreso,
- clases,
- materiales,
- certificados,
- pagos,
- instructores o instituciones.

El modelo actual solo cubre parcialmente esa necesidad.

## 8.3 Incompatibilidad de Estados

Los estados de empleo no sirven como base final para cursos.

Ejemplos actuales:

- `activa`
- `pendiente_revision`
- `cerrada`
- `vencida`
- `rechazada`

Cursos necesita otros estados, por ejemplo:

- `draft`
- `published`
- `closed`
- `archived`
- `upcoming`
- `in_progress`
- `completed`

Para inscripciones:

- `pending`
- `confirmed`
- `cancelled`
- `refunded`
- `completed`

## 9. Propuesta de Mapeo de Dominio

## 9.1 Reemplazo de Entidades

- `EmploymentCompany` -> `CourseProvider` o `CourseInstitution`
- `EmploymentJob` -> `Course`
- `EmploymentApplication` -> `CourseEnrollment`
- `EmploymentUserProfile` -> `PortalUserProfile`
- `EmploymentSettings` -> `CoursePortalSettings`
- `EmploymentEmailLog` -> `NotificationLog`

## 9.2 Reemplazo de Roles

- `admin` -> `admin`
- `empresa` -> `instructor`, `provider` o `academy_admin`
- `candidato` -> `student`

Recomendacion:

- usar `student`, `instructor`, `admin`.

Si ACAV gestionara instituciones:

- `admin`, `provider_admin`, `student`.

## 9.3 Reemplazo de Rutas

Rutas actuales:

- `/empleos`
- `/empleos/[slug]`
- `/empresas`
- `/postular/[jobId]`
- `/mis-postulaciones`
- `/publicar-puesto`
- `/registrar-empresa`
- `/dashboard/busquedas`
- `/dashboard/postulaciones`
- `/dashboard/configuracion-empleo`

Rutas objetivo sugeridas:

- `/cursos`
- `/cursos/[slug]`
- `/instituciones` o `/docentes`
- `/inscribirse/[courseId]` o inscripcion integrada en detalle
- `/mis-cursos`
- `/mis-inscripciones`
- `/certificados`
- `/pagos`
- `/dashboard/cursos`
- `/dashboard/alumnos`
- `/dashboard/inscripciones`
- `/dashboard/pagos`
- `/dashboard/configuracion-cursos`

## 9.4 Reemplazo de Colecciones

Minimo viable:

- `courses`
- `courseProviders`
- `courseEnrollments`
- `coursePortalSettings`
- `portalUsers`
- `notificationLogs`

Escalable recomendado:

- `courses`
- `courseCategories`
- `courseSessions`
- `courseLessons`
- `courseMaterials`
- `courseEnrollments`
- `courseProgress`
- `courseCertificates`
- `coursePayments`
- `courseProviders`
- `portalUsers`
- `portalSettings`
- `notificationLogs`

## 10. Adaptacion Funcional Recomendable

## 10.1 Catalogo Publico

Puede reutilizar:

- hero,
- listado principal,
- filtros,
- cards,
- secciones institucionales,
- recursos,
- testimonios.

Debe cambiar:

- copy,
- labels,
- data model,
- filtros,
- metricas.

## 10.2 Detalle de Curso

La pagina actual de detalle de empleo ya aporta una muy buena base:

- hero de detalle,
- bloques de metadata,
- descripcion,
- sidebar sticky,
- CTA principal,
- contenido relacionado.

Debe pasar a mostrar:

- duracion,
- modalidad,
- docente,
- precio,
- fechas,
- programa,
- materiales incluidos,
- certificacion,
- FAQ,
- politica de acceso.

## 10.3 Inscripcion

El formulario de postulacion actual es una excelente base tecnica para:

- inscripcion a curso,
- upload de comprobantes,
- datos personales,
- consentimientos,
- pasos de confirmacion.

Debe dejar de pedir:

- CV,
- portfolio,
- mensaje laboral.

Y pasar a pedir:

- datos personales,
- socio ACAV si aplica,
- modalidad de pago,
- comprobante,
- aceptacion de terminos academicos.

## 10.4 Panel Alumno

El `candidate-portal-panel` puede convertirse en panel del alumno con alta reutilizacion.

Hoy ya resuelve:

- area privada,
- perfil,
- historial,
- guardados,
- detalle individual.

Debe evolucionar a:

- mis cursos,
- progreso,
- calendario,
- materiales,
- certificados,
- pagos,
- notificaciones.

## 10.5 Panel Admin

El dashboard actual puede reconvertirse a:

- gestion de cursos,
- gestion de alumnos,
- inscripciones,
- pagos,
- certificados,
- contenido institucional,
- automatizaciones y notificaciones.

## 11. Deuda Tecnica Detectada

## 11.1 Dominio Mezclado con Template Base

Hay restos de template/dashboard general que no pertenecen al producto de cursos ni al de empleo:

- variantes multiples de auth,
- `landing-page/`,
- `pages/docs/`,
- componentes genericos no usados por el flujo principal.

Recomendacion:

- no eliminarlos en la primera fase,
- pero aislar claramente el producto real.

## 11.2 Naming Global Heredado

Branding y metadata siguen diciendo `ACAV Empleo`.

Impacta:

- `config/site.js`
- `lib/employment/defaults.ts`
- `lib/employment/server/email.ts`
- menus
- footer
- hero
- rutas

## 11.3 Routing Rigido

`middleware.js` fuerza segmentos concretos y redirige todo lo desconocido a `/empleos`.

Eso hoy rompe cualquier migracion progresiva a `/cursos` si no se actualiza temprano.

## 11.4 SSR Consumiendo API Interna

`lib/employment/public.ts` usa fetch HTTP a endpoints internos.

Es funcional, pero a mediano plazo conviene una capa de acceso de dominio directa:

- `lib/courses/public.ts` -> servicios directos,
- y route handlers solo para clientes externos o acciones del navegador.

## 11.5 Modelo de Usuario Insuficiente para e-learning

El perfil actual no contempla:

- progreso,
- certificados,
- compras,
- membresias,
- cohortes,
- historial academico.

## 12. Arquitectura Objetivo Recomendada

## 12.1 Estructura de Dominio

Se recomienda migrar hacia un namespace nuevo, evitando reusar `employment`:

- `components/courses/...`
- `lib/courses/...`
- `app/api/courses/...`
- `app/api/enrollments/...`
- `app/api/course-settings/...`

No conviene seguir agregando funcionalidad de cursos dentro de `lib/employment`.

## 12.2 Separacion por Subdominios

Propuesta:

- `catalog`: landing, listado, detalle, filtros.
- `enrollment`: inscripcion, pagos, validaciones.
- `learning`: progreso, materiales, calendario, certificados.
- `admin`: cursos, alumnos, contenido, notificaciones.
- `shared`: auth, ui, media, config, providers.

## 12.3 Convenciones de Naming

Usar naming directo, legible y sin ambiguedad:

- `course`
- `courseCategory`
- `courseSession`
- `courseEnrollment`
- `courseProgress`
- `courseCertificate`
- `coursePayment`
- `studentProfile`
- `providerProfile`
- `portalSettings`

Evitar:

- nombres hibridos tipo `jobCourse`, `applicationEnrollment`, `employmentCourse`.

## 13. Plan de Implementacion Recomendado

## Fase 1. Base Semantica y Routing

- definir nuevo dominio `courses`,
- crear naming oficial,
- actualizar `siteConfig`,
- adaptar `middleware`,
- definir mapa de rutas final,
- introducir settings de cursos.

## Fase 2. Catalogo Publico

- reemplazar shell publico por version cursos,
- migrar home a catalogo,
- transformar `job-card` en `course-card`,
- transformar detalle de empleo en detalle de curso,
- adaptar recursos institucionales.

## Fase 3. Dashboard Alumno

- reconvertir portal candidato a portal alumno,
- crear vistas de mis cursos,
- progreso,
- materiales,
- certificados,
- calendario,
- pagos.

## Fase 4. Dashboard Admin

- transformar gestion de busquedas en gestion de cursos,
- transformar postulaciones en inscripciones,
- agregar alumnos, pagos y certificados,
- redefinir KPIs.

## Fase 5. Datos y Persistencia

- crear nuevas colecciones,
- migrar schemas,
- migrar services,
- crear seed de cursos,
- adaptar emails y notificaciones.

## Fase 6. Escalabilidad

- desacoplar `public.ts` de fetch HTTP interno,
- introducir subdominios claros,
- preparar soporte para cohortes, clases, materiales y certificados,
- dejar capacidad para pagos y automatizaciones.

## 14. Prioridades Inmediatas

Orden recomendado de trabajo:

1. congelar el naming objetivo,
2. adaptar rutas publicas,
3. migrar shell y home,
4. redefinir entidades y colecciones,
5. migrar dashboard alumno,
6. migrar dashboard admin,
7. cerrar branding, emails y notificaciones.

## 15. Conclusion Final

El proyecto actual no debe descartarse. Tiene una base tecnica suficiente y relativamente bien organizada para convertirse en un portal de cursos virtuales serio y escalable.

Lo reutilizable ya existe:

- shell publico,
- layouts,
- dashboard,
- primitives UI,
- formularios multi-step,
- filtros,
- tablas,
- autenticacion base,
- infraestructura Firebase.

Lo que debe cambiar de forma prioritaria no es la tecnologia sino el dominio:

- nombres,
- rutas,
- entidades,
- estados,
- roles,
- mensajes,
- emails,
- colecciones.

`acav-cursos.html` confirma que la direccion correcta no es construir una app nueva, sino reconvertir la actual con una migracion ordenada y coherente de `employment` a `courses`.

Si esta base se migra con una estrategia por fases y naming consistente, el resultado puede quedar preparado para crecer hacia:

- catalogo avanzado,
- clases en vivo,
- materiales por leccion,
- certificados,
- pagos,
- cohortes,
- automatizaciones,
- integraciones futuras.
