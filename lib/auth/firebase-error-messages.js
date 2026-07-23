const DEFAULT_MESSAGES = {
  unknown: "Ocurrió un problema inesperado. Intentá nuevamente.",
  network: "No pudimos conectarnos. Verificá tu conexión e intentá otra vez.",
  throttled: "Detectamos demasiados intentos. Esperá unos minutos y volvé a probar.",
};

function normalizeErrorCode(error) {
  return String(error?.code || error?.message || "").trim();
}

export function getFirebaseLoginErrorMessage(error) {
  const code = normalizeErrorCode(error);
  if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
    return "No encontramos una cuenta con ese email o la contraseña no coincide.";
  }
  if (code === "auth/wrong-password") {
    return "La contraseña ingresada no es correcta.";
  }
  if (code === "auth/invalid-email") {
    return "El email ingresado no es válido.";
  }
  if (code === "auth/user-disabled") {
    return "Tu cuenta está deshabilitada. Contactá a ACAV para reactivarla.";
  }
  if (code === "auth/too-many-requests") {
    return DEFAULT_MESSAGES.throttled;
  }
  if (code === "auth/network-request-failed") {
    return DEFAULT_MESSAGES.network;
  }
  return "No pudimos iniciar tu sesión. Revisá tus datos e intentá nuevamente.";
}

export function getFirebaseRegisterErrorMessage(error) {
  const code = normalizeErrorCode(error);
  if (code === "email_already_in_use" || code === "auth/email-already-in-use") {
    return "Ese email ya está registrado.";
  }
  if (code === "terms_required") {
    return "Debes aceptar los términos y condiciones para continuar.";
  }
  if (code === "auth/invalid-email") {
    return "El email ingresado no es válido.";
  }
  if (code === "auth/weak-password") {
    return "La contraseña es demasiado débil. Usá al menos 6 caracteres.";
  }
  if (code === "auth/too-many-requests") {
    return DEFAULT_MESSAGES.throttled;
  }
  if (code === "auth/network-request-failed") {
    return DEFAULT_MESSAGES.network;
  }
  return "No pudimos crear la cuenta. Revisá los datos e intentá nuevamente.";
}

export function getFirebasePasswordResetErrorMessage(error) {
  const code = normalizeErrorCode(error);
  if (code === "auth/user-not-found") {
    return "No existe una cuenta registrada con ese email.";
  }
  if (code === "auth/invalid-email") {
    return "El email ingresado no es válido.";
  }
  if (code === "auth/too-many-requests") {
    return DEFAULT_MESSAGES.throttled;
  }
  if (code === "auth/network-request-failed") {
    return DEFAULT_MESSAGES.network;
  }
  return "No pudimos enviar el correo de recuperación.";
}

export function getCompanySignupErrorMessage(error) {
  const code = normalizeErrorCode(error);
  if (code === "email_already_in_use") {
    return "Ese email ya está registrado. Si ya tenés cuenta, iniciá sesión.";
  }
  if (code === "company_already_registered") {
    return "Ya existe una institución registrada con ese nombre. Si ya fue dada de alta, iniciá sesión o recuperá la contraseña.";
  }
  if (code === "company_user_already_exists") {
    return "Esa institución ya tiene una cuenta de acceso vinculada. Usá inicio de sesión o recuperación de contraseña.";
  }
  if (code === "employment_user_email_already_exists" || code === "employment_user_already_exists") {
    return "Ya existe un usuario registrado con ese email.";
  }
  if (code === "company_required") {
    return "No pudimos vincular la institución creada. Intentá nuevamente.";
  }
  if (code === "terms_required") {
    return "Debes aceptar términos, privacidad y validación administrativa.";
  }
  if (code === "auth/network-request-failed") {
    return DEFAULT_MESSAGES.network;
  }
  if (code === "auth/too-many-requests") {
    return DEFAULT_MESSAGES.throttled;
  }
  return "No pudimos completar el alta de la institución. Intentá nuevamente.";
}
