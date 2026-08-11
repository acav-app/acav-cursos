const fs = require("fs");
const path = require("path");
const json = require(path.join(__dirname, "..", "usuarios.json"));
const report = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "import-users-report-1786466005238.json"), "utf8")
);

const normalize = (v) => String(v || "").toLowerCase().trim();
const byEmail = {};
json.forEach((row, idx) => {
  const email = normalize(row.email_contacto);
  if (!byEmail[email]) byEmail[email] = [];
  byEmail[email].push({ idx, row });
});

const processed = new Set(report.results.map((r) => normalize(r.email)));
const missing = Object.keys(byEmail).filter((e) => !processed.has(e));
const duplicates = Object.entries(byEmail)
  .filter(([, arr]) => arr.length > 1)
  .map(([email, arr]) => ({
    email,
    veces: arr.length,
    ocurrencias: arr.map(({ idx, row }) => ({
      idx,
      nombre: row.nombre_y_apellido,
      dni: row.dni,
      agencia: row.agencia,
      legajo: row.legajo,
      socio: row.es_socio,
    })),
  }));

const authNoProfile = report.results.filter(
  (r) => r.alreadyExistedInAuth && !r.alreadyHadProfile
);

console.log("== RESUMEN IMPORTACION ==");
console.log("Proyecto Firebase:", report.projectId);
console.log("Dry Run:", report.dryRun);
console.log("Filas totales en usuarios.json:", json.length);
console.log("Emails unicos en JSON:", Object.keys(byEmail).length);
console.log("Usuarios procesados:", report.results.length);
console.log("Fallidos:", report.failures.length);
console.log("Emails NO procesados (faltantes):", missing.length, missing.length ? missing : "-");
console.log("");
console.log("== CREADOS vs ACTUALIZADOS ==");
console.log("Auth nuevos:", report.summary.authCreated, "| Auth actualizados:", report.summary.authUpdated);
console.log(
  "Perfiles Firestore nuevos:",
  report.summary.profileCreated,
  "| Perfiles Firestore actualizados:",
  report.summary.profileUpdated
);
console.log(
  "Cuentas de Auth que ya existian pero no tenian perfil en employmentUsers:",
  authNoProfile.length
);
authNoProfile.forEach((r) => console.log("  -", r.email));
console.log("");
console.log("== ENTRADAS DUPLICADAS EN JSON (se mergeo el primer match + faltantes) ==");
console.log("Cantidad emails repetidos:", duplicates.length, "(total filas skipeadas: 16)");
duplicates.forEach(({ email, veces, ocurrencias }, i) => {
  console.log(`\n#${i + 1} ${email} (${veces} filas)`);
  ocurrencias.forEach((o) =>
    console.log(
      `   [index ${o.idx + 1}] ${o.nombre} | DNI ${o.dni} | Agencia="${o.agencia}" | Legajo=${o.legajo} | SOCIO=${o.socio}`
    )
  );
});
console.log("");
console.log("== ADVERTENCIAS ==");
report.summary.warnings.forEach((w) => console.log("- " + w));
