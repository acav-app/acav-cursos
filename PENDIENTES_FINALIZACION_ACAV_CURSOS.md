# Pendientes de Finalizacion - ACAV Cursos

## Objetivo

Este documento funciona como checklist operativa para cerrar la migracion y dejar `ACAV Cursos` correctamente funcionando, visualmente consistente y sin dependencias visibles del dominio legacy de empleo.

La idea es usar este archivo como fuente unica de seguimiento hasta finalizar:

- arquitectura funcional,
- rutas canonicas,
- panel admin,
- panel alumno,
- home/catalogo de cursos,
- contenido y configuracion,
- limpieza visual y semantica.

## Restricciones del proyecto

- No ejecutar `npm run build`.
- No dejar referencias visibles a `empleo`, `puestos` o `postulaciones`.
- Mantener el boton `Inscribirme` apuntando al flujo correcto de registro/inscripcion.
- Reutilizar sidebar y componentes existentes del dashboard.
- El producto principal es `Cursos`; admin y alumno deben sentirse como extensiones del mismo ecosistema.
- La nueva fuente funcional de verdad para checkout, pago e inscripcion es `FLUJO_INSCRIPCION_Y_ACTIVACION_CURSOS.md`.

## Criterio de terminado

El proyecto se considera cerrado cuando se cumplan todos estos puntos:

- El home publico de cursos es el centro de la experiencia.
- El panel admin funciona como backoffice de `ACAV Cursos`.
- El panel alumno funciona como continuidad natural del home/catalogo.
- No quedan rutas visibles duplicadas entre canonicias y legacy.
- `Contenido` y `Configuracion` leen y guardan sobre una unica fuente de settings.
- No quedan textos visibles del dominio de empleo.
- La interfaz publica, admin y alumno comparten un mismo lenguaje visual.
- La base tecnica deja de depender de nombres legacy en las capas criticas.

## Estado actual

### Ya resuelto

- [x] Rutas canonicas publicas creadas con implementacion propia:
  - `/cursos`
  - `/cursos/[slug]`
  - `/instituciones`
  - `/instituciones/[slug]`
  - `/publicar-curso`
  - `/registrar-institucion`
- [x] Rutas canonicas del alumno creadas con implementacion propia:
  - `/mi-campus`
  - `/mis-cursos`
  - `/mis-inscripciones`
  - `/mis-inscripciones/[id]`
  - `/mis-certificados`
  - `/historial-pagos`
- [x] Modulos admin reales creados:
  - `/dashboard/pagos`
  - `/dashboard/certificados`
  - `/dashboard/contenido`
- [x] Rutas canonicas del dashboard creadas con implementacion propia:
  - `/dashboard/cursos`
  - `/dashboard/cursos/nueva`
  - `/dashboard/cursos/[id]`
  - `/dashboard/instituciones`
  - `/dashboard/instituciones/nueva`
  - `/dashboard/instituciones/[id]`
  - `/dashboard/inscripciones`
  - `/dashboard/inscripciones/[id]`
- [x] Navegacion de menus, header y panel alumno alineada a cursos.
- [x] Footer y accesos del panel alumno ya no apuntan a placeholders viejos.

### Aun pendiente

- [x] Unificar settings de contenido/configuracion sobre `courses/settings`.
- [x] Redirigir rutas legacy a sus rutas canonicas.
- [x] Rehacer el home del dashboard para que este centrado en cursos.
- [x] Rehacer `Mi Campus` para que se alinee visual y funcionalmente al home de cursos.
- [x] Unificar lenguaje visual entre publica, alumno y admin.
- [x] Limpiar copy visible legacy.
- [x] Limpiar metadata y branding global.
- [x] Eliminar logica muerta del rol `candidato` dentro del dashboard interno.
- [ ] Ejecutar refactor semantico interno de nombres legacy.
- [ ] Migrar el flujo actual de inscripcion directa al nuevo flujo `Usuario -> Checkout -> Payment -> Enrollment -> Activacion`.

## Prioridad 1 - Funcionamiento critico

### 1. Settings unificados

Objetivo:

- Hacer que `Contenido`, `Configuracion`, home publico, footer y bloques institucionales consuman la misma fuente de verdad.

Archivos a tocar:

- `app/[lang]/(dashboard)/dashboard/contenido/page.jsx`
- `app/[lang]/(dashboard)/dashboard/configuracion-empleo/page.jsx`
- `app/[lang]/(dashboard)/dashboard/configuracion-cursos/page.jsx`
- `app/api/courses/settings/route.ts`
- `app/api/employment/settings/route.ts`
- `lib/courses/public.ts`

Checklist:

- [x] Migrar lectura de settings a `courses/settings`.
- [x] Migrar escritura de settings a `courses/settings`.
- [x] Dejar `employment/settings` fuera del flujo principal.
- [ ] Verificar que home, footer y contenido institucional reflejen cambios guardados.

### 2. Rutas legacy

Objetivo:

- Dejar una sola URL canonica por flujo.

Archivos a tocar:

- `middleware.js`
- `app/[lang]/empleos/page.jsx`
- `app/[lang]/empleos/[slug]/page.jsx`
- `app/[lang]/empresas/page.jsx`
- `app/[lang]/empresas/[slug]/page.jsx`
- `app/[lang]/mis-postulaciones/page.jsx`
- `app/[lang]/mis-postulaciones/[id]/page.jsx`
- `app/[lang]/postular/[jobId]/page.jsx`
- `app/[lang]/inscribirse/[courseId]/page.jsx`
- `app/[lang]/registrar-empresa/page.jsx`
- `app/[lang]/publicar-puesto/page.jsx`
- `app/[lang]/(dashboard)/dashboard/busquedas/page.jsx`
- `app/[lang]/(dashboard)/dashboard/busquedas/nueva/page.jsx`
- `app/[lang]/(dashboard)/dashboard/busquedas/[id]/page.jsx`
- `app/[lang]/(dashboard)/dashboard/postulaciones/page.jsx`
- `app/[lang]/(dashboard)/dashboard/postulaciones/[id]/page.jsx`
- `app/[lang]/(dashboard)/dashboard/empresas/page.jsx`
- `app/[lang]/(dashboard)/dashboard/empresas/nueva/page.jsx`
- `app/[lang]/(dashboard)/dashboard/empresas/[id]/page.jsx`

Checklist:

- [x] Redirigir `empleos` -> `cursos`.
- [x] Redirigir `empresas` -> `instituciones`.
- [x] Redirigir `mis-postulaciones` -> `mis-inscripciones`.
- [x] Redirigir `postular` e `inscribirse` al flujo canonico de curso.
- [x] Redirigir `registrar-empresa` -> `registrar-institucion`.
- [x] Redirigir `publicar-puesto` -> `publicar-curso`.
- [x] Redirigir `dashboard/busquedas` -> `dashboard/cursos`.
- [x] Redirigir `dashboard/postulaciones` -> `dashboard/inscripciones`.
- [x] Redirigir `dashboard/empresas` -> `dashboard/instituciones`.

### 3. Dashboard home centrado en cursos

Objetivo:

- Hacer que el primer pantallazo admin sea el centro operativo de `ACAV Cursos`, no un dashboard abstracto.

Archivos a tocar:

- `app/[lang]/(dashboard)/(home)/dashboard/page-view.jsx`
- `app/[lang]/(dashboard)/layout.jsx`
- `config/menus.js`
- `components/partials/header/profile-info.jsx`

Checklist:

- [x] Reordenar KPIs con foco en cursos, instituciones, inscripciones, pagos y certificados.
- [x] Reordenar quick actions segun flujos reales.
- [ ] Eliminar rama visual/logica de `candidato` del dashboard interno.
- [x] Ajustar copy y jerarquia del home admin.

## Prioridad 2 - Panel alumno

### 4. Mi Campus alineado al home de cursos

Objetivo:

- Hacer que el panel alumno se sienta como una extension directa del catalogo de cursos.

Archivos a tocar:

- `components/employment/candidate-portal-panel.jsx`
- `app/[lang]/mi-campus/page.jsx`
- `app/[lang]/mis-cursos/page.jsx`
- `app/[lang]/mis-inscripciones/page.jsx`
- `app/[lang]/mis-certificados/page.jsx`
- `app/[lang]/historial-pagos/page.jsx`

Checklist:

- [x] Rehacer el hero/resumen de `Mi Campus`.
- [x] Mostrar resumen real del recorrido del alumno:
  - proximos cursos,
  - inscripciones,
  - certificados,
  - pagos.
- [x] Unificar cards, badges y tonos con el home publico.
- [x] Reducir sensacion de portal heredado.

### 5. Flujo de inscripcion canonico

Objetivo:

- Simplificar el alta/inscripcion desde el catalogo hasta el panel del alumno, separando identidad, enrollment y payment.

Archivos a tocar:

- `components/employment/job-card.jsx`
- `components/employment/job-apply-button.jsx`
- `components/employment/application-public-form.jsx`
- `app/[lang]/cursos/[slug]/page.jsx`
- `app/[lang]/inscribirse/[courseId]/page.jsx`
- `app/[lang]/postular/[jobId]/page.jsx`

Checklist:

- [ ] Confirmar un unico flujo de inscripcion.
- [ ] Reemplazar el formulario actual de `documentacion/CV` por checkout + pago.
- [ ] Crear entidad `payments` y su ciclo de revision.
- [ ] Separar `userId`, `enrollmentId` y `paymentId` en toda la capa server.
- [ ] Quitar nomenclatura de postulacion en UI visible.
- [ ] Verificar que el CTA `Inscribirme` lleve siempre al flujo correcto.
- [ ] Verificar mensajes de exito, errores y estados intermedios.

## Prioridad 3 - Interfaz y consistencia visual

### 6. Sistema visual unico

Objetivo:

- Alinear publica, admin y alumno bajo una misma identidad de `ACAV Cursos`.

Archivos a tocar:

- `components/employment/public-home.jsx`
- `components/employment/public-shell.jsx`
- `components/employment/candidate-portal-panel.jsx`
- `app/[lang]/(dashboard)/(home)/dashboard/page-view.jsx`
- `app/globals.css`
- `app/assets/css/theme.css`

Checklist:

- [ ] Unificar superficies, espaciados, CTA y jerarquia visual.
- [ ] Llevar identidad premium del home al alumno y admin.
- [ ] Revisar fondos, contrastes y cards para que no parezcan 3 productos distintos.
- [ ] Unificar tono visual del header, sidebar y bloques destacados.

### 7. Copy, metadata y branding

Objetivo:

- Quitar cualquier leak visible del dominio viejo y cerrar la marca.

Archivos a tocar:

- `components/auth/login-form.jsx`
- `components/employment/public-shell.jsx`
- `config/site.js`
- `app/[lang]/layout.jsx`
- `config/menus.js`

Checklist:

- [ ] Reemplazar textos visibles tipo `postularte`, `empleo`, `puesto`, `postulacion`.
- [ ] Corregir metadata global a marca ACAV Cursos.
- [ ] Corregir labels finos como `Mi institucion`.
- [ ] Revisar footer, descripcion institucional y mensajes de acceso.

## Prioridad 4 - Limpieza tecnica final

### 8. Refactor semantico interno

Objetivo:

- Reducir deuda tecnica y evitar futuras fugas del naming legacy.

Archivos/namespaces mas implicados:

- `components/employment/candidate-portal-panel.jsx`
- `components/employment/dashboard/job-wizard.jsx`
- `components/employment/dashboard/company-form.jsx`
- `lib/employment/*`
- `lib/courses/*`
- `app/api/jobs/*`
- `app/api/companies/*`
- `app/api/applications/*`
- `app/api/courses/*`
- `app/api/institutions/*`
- `app/api/enrollments/*`

Checklist:

- [ ] Renombrar progresivamente `job` -> `course`.
- [ ] Renombrar `company` -> `institution`.
- [ ] Renombrar `application` -> `enrollment` o `inscripcion`.
- [ ] Reducir dependencias sobre `employment` en capas activas.
- [ ] Dejar wrappers legacy solo si hacen falta para compatibilidad.

### 9. Limpieza de logica muerta

Objetivo:

- Eliminar ramas de producto que ya no tienen sentido.

Archivos a tocar:

- `app/[lang]/(dashboard)/layout.jsx`
- `app/[lang]/(dashboard)/(home)/dashboard/page-view.jsx`
- `middleware.js`
- `config/menus.js`

Checklist:

- [ ] Eliminar restos de flujo `candidato` dentro del dashboard interno.
- [ ] Eliminar condiciones y ramas que ya no se usan.
- [ ] Validar que la navegacion no deje entradas ocultas o duplicadas.

## Validacion final

Antes de dar por cerrado el proyecto:

- [ ] Navegar home publico -> catalogo -> detalle -> inscripcion.
- [ ] Navegar panel alumno completo.
- [ ] Navegar panel admin completo.
- [ ] Verificar settings de contenido y configuracion.
- [ ] Verificar redirecciones legacy -> canonicas.
- [ ] Verificar textos visibles y metadata.
- [ ] Revisar diagnostics de los archivos editados.
- [ ] Validar manualmente rutas criticas en browser.

## Orden recomendado de ejecucion

1. Settings unificados.
2. Redirecciones legacy a canonicas.
3. Dashboard home centrado en cursos.
4. Mi Campus alineado al home de cursos.
5. Sistema visual unico.
6. Copy, branding y metadata.
7. Refactor semantico interno.
8. Validacion final completa.

## Archivos mas criticos del cierre

- `middleware.js`
- `config/menus.js`
- `app/[lang]/(dashboard)/(home)/dashboard/page-view.jsx`
- `components/employment/candidate-portal-panel.jsx`
- `components/employment/public-shell.jsx`
- `components/employment/public-home.jsx`
- `app/[lang]/(dashboard)/dashboard/contenido/page.jsx`
- `app/[lang]/(dashboard)/dashboard/configuracion-empleo/page.jsx`
- `app/[lang]/(dashboard)/dashboard/configuracion-cursos/page.jsx`
- `app/api/courses/settings/route.ts`
- `app/api/employment/settings/route.ts`

## Nota operativa

Usar este archivo como checklist viva:

- marcar tareas completadas,
- agregar subtareas si aparece deuda nueva,
- no abrir nuevas fases de refactor interno antes de cerrar routing, settings y UX principal.
