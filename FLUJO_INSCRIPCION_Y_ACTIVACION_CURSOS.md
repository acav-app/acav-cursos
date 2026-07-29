# ACAV Cursos · Flujo Completo de Inscripción y Activación de Cursos

Este documento define el flujo funcional objetivo para implementar en la plataforma.

El objetivo es:

- minimizar la fricción para el alumno,
- separar correctamente `Usuario` / `Inscripción` / `Pago`,
- permitir escalar a futuras pasarelas de pago sin modificar la arquitectura.

## Principios rectores

- El alumno crea su cuenta una sola vez.
- El alumno no vuelve a cargar `nombre`, `apellido` o `email` cada vez que compra un curso.
- El checkout debe ser corto, claro y lineal.
- `Enrollment` no debe mezclar datos de identidad con lógica de pagos.
- `Payment` debe existir como entidad propia para soportar:
  - transferencia manual,
  - revisión administrativa,
  - futuras pasarelas.

## Arquitectura funcional

### Usuario

Representa la identidad persistente del alumno dentro del ecosistema.

Campos base:

- `id`
- `firstName`
- `lastName`
- `email`
- `passwordHash`
- `phone`
- `city`
- `province`
- `avatar`
- `accountStatus`

Estados canónicos:

- `pending_email_verification`
- `active`
- `suspended`

### Enrollment

Representa la relación entre un alumno y un curso.

Campos base:

- `id`
- `userId`
- `courseId`
- `paymentId`
- `status`
- `paymentStatus`
- `progress`
- `createdAt`
- `approvedAt`
- `approvedBy`

Estados canónicos:

- `started`
- `waiting_payment`
- `payment_under_review`
- `active`
- `rejected`
- `cancelled`

### Payment

Representa el intento de cobro o validación económica de una inscripción.

Campos base:

- `id`
- `enrollmentId`
- `amount`
- `currency`
- `method`
- `receiptUrl`
- `reference`
- `status`
- `reviewComment`
- `reviewedBy`
- `reviewedAt`
- `createdAt`

Estados canónicos:

- `pending`
- `under_review`
- `approved`
- `rejected`

## Relación entre entidades

- `1 Usuario` puede tener `muchas inscripciones`
- `1 Enrollment` puede tener `1 pago principal` asociado
- en el futuro la arquitectura permite historial de pagos o reintentos sin reescribir la base

## Flujo general

1. El alumno selecciona un curso.
2. Si no está logueado:
   - crea cuenta,
   - se autentica automáticamente,
   - vuelve al checkout del curso.
3. Si ya está logueado:
   - continúa directo al checkout.
4. Confirma curso y datos del alumno.
5. Visualiza datos bancarios.
6. Sube comprobante.
7. Se crea:
   - `Payment` con `status = under_review`
   - `Enrollment` con `status = payment_under_review`
8. El administrador revisa.
9. Si aprueba:
   - `Payment.status = approved`
   - `Enrollment.status = active`
   - se habilita acceso al curso
   - se notifica al alumno
10. Si rechaza:
   - `Payment.status = rejected`
   - `Enrollment.status = waiting_payment`
   - se conserva la inscripción
   - el alumno puede subir un nuevo comprobante

## Flujo detallado

### 1. Registro

Si el usuario no existe:

- completa `nombre`
- completa `apellido`
- completa `email`
- completa `contraseña`

El sistema:

- crea el usuario
- puede enviar verificación de email
- inicia sesión automáticamente
- redirige al checkout

### 2. Checkout

Debe mostrar de forma resumida:

- curso
- precio
- institución
- alumno autenticado

El checkout no debe pedir nuevamente:

- nombre
- apellido
- email

Acción principal:

- `Continuar`

### 3. Pago

Debe mostrar:

- alias
- CBU
- CVU
- titular
- importe

Acciones:

- copiar alias
- copiar CBU
- seleccionar método
- subir comprobante
- agregar referencia opcional
- enviar

### 4. Backend

Secuencia esperada:

1. `POST /payments/upload`
2. almacenar comprobante
3. obtener `receiptUrl`
4. `POST /enrollments`
5. crear `Payment`
6. crear o actualizar `Enrollment`
7. notificar admin
8. notificar alumno

## Panel administrativo

Nueva sección principal:

- `Inscripciones`

La tabla debe mostrar:

- alumno
- curso
- monto
- estado
- fecha
- acciones

Acción principal:

- `Revisar`

### Pantalla de revisión

Debe incluir:

- alumno
- curso
- importe
- comprobante
- referencia
- estado

Acciones:

- `Aprobar`
- `Rechazar`
- `Solicitar nuevo comprobante`

### Si el administrador aprueba

Se ejecuta:

- `Payment.status = approved`
- `Enrollment.status = active`
- creación de acceso
- envío de email
- publicación del curso en `Mis Cursos`

### Si el administrador rechaza

Se ejecuta:

- `Payment.status = rejected`
- `Enrollment.status = waiting_payment`
- email automático con motivo
- el alumno puede subir otro comprobante

La inscripción no se elimina.

## Dashboard del alumno

El dashboard debe reflejar el estado real del curso comprado.

### Si el curso está activo

Mostrar:

- curso
- estado `Activo`
- última clase
- progreso
- CTA `Ingresar` o `Continuar`

### Si el curso sigue pendiente

Mostrar:

- curso
- estado `Esperando aprobación`
- confirmación de comprobante recibido
- tiempo estimado de revisión

## Notificaciones

### Alumno

- cuenta creada
- comprobante recibido
- pago aprobado
- pago rechazado
- acceso habilitado

### Administrador

- nueva inscripción
- nuevo comprobante
- recordatorio de pendientes

## Máquina de estados

### Usuario

- `pending_email_verification` -> `active` -> `suspended`

### Enrollment

- `started`
- `waiting_payment`
- `payment_under_review`
- `active`
- `rejected`
- `cancelled`

### Payment

- `pending`
- `under_review`
- `approved`
- `rejected`

Transición principal:

1. crear cuenta
2. `user.active`
3. compra curso
4. `enrollment.waiting_payment`
5. subir comprobante
6. `payment.under_review`
7. `enrollment.payment_under_review`
8. aprobar:
   - `payment.approved`
   - `enrollment.active`
9. rechazar:
   - `payment.rejected`
   - `enrollment.waiting_payment`

## Modelo de datos objetivo

### `users`

- `id`
- `firstName`
- `lastName`
- `email`
- `passwordHash`
- `phone`
- `city`
- `province`
- `avatar`
- `createdAt`
- `updatedAt`

### `courses`

- `id`
- `title`
- `slug`
- `price`
- `institutionId`
- `status`

### `enrollments`

- `id`
- `userId`
- `courseId`
- `paymentId`
- `status`
- `paymentStatus`
- `progress`
- `approvedBy`
- `approvedAt`
- `createdAt`

### `payments`

- `id`
- `enrollmentId`
- `amount`
- `currency`
- `method`
- `receiptUrl`
- `status`
- `reference`
- `reviewComment`
- `reviewedBy`
- `reviewedAt`
- `createdAt`

## Criterio de implementación

El código debe migrar desde el flujo actual de `inscripción directa con documentación` hacia un flujo de:

1. autenticación
2. checkout
3. carga de comprobante
4. revisión administrativa
5. activación

sin mezclar en una misma entidad:

- datos del usuario,
- estado del curso,
- validación del pago.

## Estado del proyecto frente a este documento

Hoy el proyecto todavía conserva una implementación previa basada en:

- `enrollment` con datos personales embebidos,
- carga de `cv/documentación`,
- estados legacy como `recibida`, `vista`, `preseleccionada`.

Este documento pasa a ser la nueva fuente de verdad funcional para la siguiente etapa de migración.
