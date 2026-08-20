"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Plus, Save, Award, Building2, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTableEnhanced } from "@/components/ui/data-table-enhanced";
import { useAuth } from "@/provider/auth.provider";
import { authedFetch, asArray } from "@/lib/auth/authed-fetch";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { PORTAL_ROLES } from "@/lib/courses/constants";
import { DashboardPageShellSkeleton } from "@/components/courses/dashboard/page-skeletons";

function normalizeString(value) {
  return String(value || "").trim();
}

function getUserAdminErrorMessage(error) {
  const code = String(error?.message || error?.code || "").trim();
  if (code === "portal_user_email_already_exists" || code === "portal_user_already_exists") {
    return "Ya existe un usuario del portal con ese email.";
  }
  if (code === "institution_user_already_exists") {
    return "La institucion seleccionada ya tiene un usuario institucional vinculado.";
  }
  return error?.message || "No se pudo completar la operación.";
}

export default function DashboardUsuariosPage() {
  const { user } = useAuth();
  const { actor, loading: actorLoading, error: actorError } = useCourseActor();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    email: "",
    uid: "",
    firstName: "",
    lastName: "",
    displayName: "",
    fullName: "",
    documentNumber: "",
    agency: "",
    employeeFileNumber: "",
    phone: "",
    isMember: false,
    password: "",
    role: "admin",
    companyId: "",
    isActive: true,
  });

  const refresh = async () => {
    if (!user) return;
    const [usersData, companiesData] = await Promise.all([
      authedFetch(user, "/api/courses/users", { method: "GET" }),
      authedFetch(user, "/api/institutions", { method: "GET" }),
    ]);
    setUsers(asArray(usersData?.users));
    setCompanies(asArray(companiesData?.institutions));
  };

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!user) return;
      setLoading(true);
      try {
        await refresh();
      } catch (e) {
        toast.error(e?.message || "Error cargando usuarios", { position: "top-right" });
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [user]);

  const filtered = useMemo(() => users, [users]);

  const roleBadge = (roleValue) => {
    const role = normalizeString(roleValue).toLowerCase();
    if (role === "admin") {
      return <Badge variant="soft" color="default">Administrador</Badge>;
    }
    if (role === "alumno" || role === "student") {
      return <Badge variant="soft" color="info">Alumno</Badge>;
    }
    if (role === "institution") {
      return <Badge variant="soft" color="warning">Institucional</Badge>;
    }
    return <Badge variant="soft" color="secondary">{roleValue || "Sin rol"}</Badge>;
  };

  const columns = useMemo(() => {
    return [
      {
        id: "user",
        header: "Usuario",
        accessorKey: "email",
        enableSorting: true,
        meta: { enableColumnFilter: true },
        cell: ({ row }) => {
          const u = row.original;
          const fullName =
            [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
            u.displayName ||
            u.fullName ||
            "Sin nombre";
          return (
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[#4338CA] ring-1 ring-[#E0E7FF]">
                <Users2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[#0F172A]">{fullName}</div>
                <div className="truncate text-xs text-[#64748B]">{u.email || "-"}</div>
                {(u.documentNumber || u.agency || u.employeeFileNumber) ? (
                  <div className="mt-0.5 truncate text-[11px] text-[#94A3B8]">
                    {[
                      u.documentNumber ? `DNI ${u.documentNumber}` : "",
                      u.agency ? `Agencia ${u.agency}` : "",
                      u.employeeFileNumber ? `Legajo ${u.employeeFileNumber}` : "",
                    ].filter(Boolean).join(" · ")}
                  </div>
                ) : null}
              </div>
            </div>
          );
        },
      },
      {
        id: "role",
        header: "Rol",
        accessorKey: "role",
        enableSorting: true,
        meta: { enableColumnFilter: true },
        size: 180,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {roleBadge(row.original.role)}
          </div>
        ),
      },
      {
        id: "company",
        header: "Institucion",
        accessorKey: "companyName",
        enableSorting: true,
        meta: { enableColumnFilter: true },
        size: 220,
        cell: ({ row }) => {
          const name = row.original.companyName || row.original.institutionName || null;
          return (
            <div className="flex items-start gap-2 text-sm">
              {name ? (
                <>
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#94A3B8]" />
                  <span className="text-[#0F172A]">{name}</span>
                </>
              ) : (
                <span className="text-[#94A3B8]">Sin institucion</span>
              )}
            </div>
          );
        },
      },
      {
        id: "contact",
        header: "Contacto",
        accessorKey: "phone",
        enableSorting: true,
        meta: { enableColumnFilter: true },
        size: 240,
        cell: ({ row }) => {
          const u = row.original;
          const contactEmail = u.contactEmail || u.email;
          return (
            <div className="grid gap-1 text-xs text-[#475569]">
              {u.phone ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[#64748B]">Tel.</span>
                  <span className="text-[#0F172A]">{u.phone}</span>
                </div>
              ) : null}
              {contactEmail ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[#64748B]">Email</span>
                  <span className="truncate text-[#0F172A]">{contactEmail}</span>
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "flags",
        header: "Estado",
        accessorKey: "isActive",
        enableSorting: true,
        meta: { enableColumnFilter: false },
        size: 260,
        cell: ({ row }) => {
          const u = row.original;
          const isMember = Boolean(u.isMember);
          const isActive = u.isActive !== false;
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="soft"
                color={isActive ? "success" : "destructive"}
              >
                {isActive ? "Activo" : "Inactivo"}
              </Badge>
              {isMember ? (
                <Badge variant="soft" color="warning" className="inline-flex items-center gap-1">
                  <Award className="h-3 w-3" />
                  Socio ACAV
                </Badge>
              ) : (
                <Badge variant="soft" color="secondary">No socio</Badge>
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Acciones",
        enableSorting: false,
        meta: { enableColumnFilter: false },
        size: 140,
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <Button
                type="button"
                variant="outline"
                onClick={() => openEdit(u)}
                className="h-9 rounded-2xl border-[#E5E7EB] bg-white text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
              >
                Editar
              </Button>
            </div>
          );
        },
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const companyOptions = useMemo(() => {
    return companies.map((c) => ({ id: c.id, name: c.name }));
  }, [companies]);

  const openCreate = () => {
    setForm({
      email: "",
      uid: "",
      firstName: "",
      lastName: "",
      displayName: "",
      fullName: "",
      documentNumber: "",
      agency: "",
      employeeFileNumber: "",
      phone: "",
      isMember: false,
      password: "",
      role: "admin",
      companyId: "",
      isActive: true,
    });
    setCreateOpen(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      email: u.email || "",
      uid: u.uid || "",
      firstName: u.firstName || "",
      lastName: u.lastName || "",
      displayName: u.displayName || "",
      fullName: u.fullName || "",
      documentNumber: u.documentNumber || "",
      agency: u.agency || "",
      employeeFileNumber: u.employeeFileNumber || "",
      phone: u.phone || "",
      isMember: Boolean(u.isMember),
      password: "",
      role: u.role || "admin",
      companyId: u.companyId || "",
      isActive: u.isActive !== false,
    });
    setEditOpen(true);
  };

  const validateForm = (mode) => {
    const role = normalizeString(form.role);
    if (mode === "create" && !normalizeString(form.email)) return "Email es obligatorio";
    if (mode === "create" && !normalizeString(form.firstName)) return "Nombre es obligatorio";
    if (mode === "create" && !normalizeString(form.lastName)) return "Apellido es obligatorio";
    if (mode === "create" && !normalizeString(form.documentNumber)) return "DNI es obligatorio";
    if (mode === "create" && !normalizeString(form.password)) return "Contraseña es obligatoria";
    if (!PORTAL_ROLES.includes(role)) return "Rol inválido";
    return "";
  };

  const handleCreate = async () => {
    if (!user) return;
    const error = validateForm("create");
    if (error) {
      toast.error(error, { position: "top-right" });
      return;
    }
    try {
      setSaving(true);
      await authedFetch(user, "/api/courses/users", {
        method: "POST",
        body: JSON.stringify({
          email: normalizeString(form.email),
          uid: normalizeString(form.uid) || undefined,
          firstName: normalizeString(form.firstName) || undefined,
          lastName: normalizeString(form.lastName) || undefined,
          displayName: normalizeString(form.displayName) || undefined,
          fullName: normalizeString(form.fullName) || undefined,
          documentNumber: normalizeString(form.documentNumber) || undefined,
          agency: normalizeString(form.agency) || undefined,
          employeeFileNumber: normalizeString(form.employeeFileNumber) || undefined,
          phone: normalizeString(form.phone) || undefined,
          isMember: Boolean(form.isMember),
          password: normalizeString(form.password) || undefined,
          role: normalizeString(form.role),
          companyId: normalizeString(form.companyId) || undefined,
          isActive: Boolean(form.isActive),
        }),
      });
      toast.success("Usuario del portal creado", { position: "top-right" });
      setCreateOpen(false);
      await refresh();
    } catch (e) {
      toast.error(getUserAdminErrorMessage(e), { position: "top-right" });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!user || !editing?.uid) return;
    const error = validateForm("edit");
    if (error) {
      toast.error(error, { position: "top-right" });
      return;
    }
    try {
      setSaving(true);
      const passwordValue = normalizeString(form.password);
      await authedFetch(user, `/api/courses/users/${editing.uid}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: normalizeString(form.displayName) || undefined,
          firstName: normalizeString(form.firstName) || undefined,
          lastName: normalizeString(form.lastName) || undefined,
          fullName: normalizeString(form.fullName) || undefined,
          documentNumber: normalizeString(form.documentNumber) || undefined,
          agency: normalizeString(form.agency) || undefined,
          employeeFileNumber: normalizeString(form.employeeFileNumber) || undefined,
          phone: normalizeString(form.phone) || undefined,
          isMember: typeof form.isMember === "boolean" ? form.isMember : undefined,
          role: normalizeString(form.role),
          companyId: normalizeString(form.companyId) || undefined,
          isActive: Boolean(form.isActive),
          ...(passwordValue.length >= 6 ? { password: passwordValue } : {}),
        }),
      });
      toast.success("Usuario actualizado", { position: "top-right" });
      setEditOpen(false);
      setEditing(null);
      await refresh();
    } catch (e) {
      toast.error(getUserAdminErrorMessage(e), { position: "top-right" });
    } finally {
      setSaving(false);
    }
  };

  if (actorLoading || loading) {
    return <DashboardPageShellSkeleton filterColumns={2} rowCount={6} />;
  }

  if (actorError) {
    return (
      <div className="py-8 px-2 mx-auto">
        <div className="rounded-3xl border border-border/60 bg-card p-8">
          <h1 className="text-2xl font-bold text-foreground">No se pudo cargar el perfil</h1>
          <p className="mt-3 text-sm text-muted-foreground">{actorError}</p>
        </div>
      </div>
    );
  }

  if (actor?.role !== "admin") {
    return (
      <div className="py-8 px-2 mx-auto">
        <div className="rounded-3xl border border-border/60 bg-card p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Usuarios</div>
          <h1 className="mt-3 text-2xl font-bold text-foreground">Acceso restringido</h1>
          <p className="mt-3 text-sm text-muted-foreground">Solo administradores pueden gestionar usuarios y roles.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-2 mx-auto space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Usuarios</div>
          <h1 className="mt-3 text-3xl font-bold text-foreground">Gestion de usuarios y roles</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gestiona perfiles del portal: rol, institucion asociada y estado activo.
          </p>
        </div>

        <Button onClick={openCreate} className="inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      <DataTableEnhanced
        data={filtered}
        columns={columns}
        searchPlaceholder="Buscar por nombre, email, DNI, rol, institucion o contacto"
        searchableColumnKeys={[
          "email",
          "firstName",
          "lastName",
          "displayName",
          "fullName",
          "role",
          "documentNumber",
          "agency",
          "employeeFileNumber",
          "companyName",
          "institutionName",
          "phone",
          "contactEmail",
        ]}
        defaultPageSize={20}
        defaultSorting={[{ id: "user", desc: false }]}
        showFiltersRow
        showColumnVisibility
        emptyTitle="No hay usuarios para mostrar"
        emptySubtitle="Crea el primer perfil del portal para una institucion o administrador, o ajusta los filtros actuales."
        onRowClick={(row) => openEdit(row)}
        toolbarLeft={
          <div className="hidden items-center gap-2 md:flex">
            <Badge variant="soft" color="secondary">
              Total {users.length}
            </Badge>
            {users.filter((u) => u.role === "admin").length ? (
              <Badge variant="soft" color="default">
                Admin {users.filter((u) => u.role === "admin").length}
              </Badge>
            ) : null}
            {users.filter((u) => String(u.role || "").toLowerCase() === "alumno").length ? (
              <Badge variant="soft" color="info">
                Alumnos {users.filter((u) => String(u.role || "").toLowerCase() === "alumno").length}
              </Badge>
            ) : null}
          </div>
        }
      />

      <Dialog open={createOpen} onOpenChange={(open) => setCreateOpen(open)}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-[720px] overflow-y-auto pr-8">
          <DialogHeader>
            <DialogTitle>Crear usuario del portal</DialogTitle>
          </DialogHeader>

          <div className="grid gap-6">
            <div className="grid gap-2">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Nombre <span className="text-destructive">*</span></Label>
                <Input value={form.firstName} onChange={(e) => setForm((s) => ({ ...s, firstName: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Apellido <span className="text-destructive">*</span></Label>
                <Input value={form.lastName} onChange={(e) => setForm((s) => ({ ...s, lastName: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>DNI <span className="text-destructive">*</span></Label>
              <Input
                value={form.documentNumber}
                inputMode="numeric"
                placeholder="Ej: 12345678"
                onChange={(e) => setForm((s) => ({ ...s, documentNumber: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Nombre visible (opcional)</Label>
              <Input value={form.displayName} onChange={(e) => setForm((s) => ({ ...s, displayName: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Teléfono</Label>
              <Input value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} placeholder="Opcional" />
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Agencia</Label>
                <Input value={form.agency} onChange={(e) => setForm((s) => ({ ...s, agency: e.target.value }))} placeholder="Opcional" />
              </div>
              <div className="grid gap-2">
                <Label>Legajo</Label>
                <Input value={form.employeeFileNumber} onChange={(e) => setForm((s) => ({ ...s, employeeFileNumber: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Contraseña <span className="text-destructive">*</span></Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                placeholder="Mínimo 6 caracteres. Esta es la contraseña definitiva."
              />
            </div>
            <div className="flex items-start gap-3 rounded-3xl border border-border/60 bg-background p-5">
              <Checkbox
                checked={Boolean(form.isMember)}
                onCheckedChange={(v) => setForm((s) => ({ ...s, isMember: Boolean(v) }))}
              />
              <div className="grid gap-1">
                <Label>Socio ACAV</Label>
                <p className="text-xs leading-6 text-muted-foreground">Marcar si el usuario es socio registrado.</p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Rol</Label>
                <Select value={form.role} onValueChange={(v) => setForm((s) => ({ ...s, role: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {PORTAL_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Institucion (opcional)</Label>
                <Select
                  value={form.companyId || "none"}
                  onValueChange={(v) => setForm((s) => ({ ...s, companyId: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar institucion" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin institucion</SelectItem>
                    {companyOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-3xl border border-border/60 bg-background p-5">
              <Checkbox
                checked={Boolean(form.isActive)}
                onCheckedChange={(v) => setForm((s) => ({ ...s, isActive: Boolean(v) }))}
              />
              <div className="grid gap-1">
                <Label>Usuario activo</Label>
                <p className="text-xs leading-6 text-muted-foreground">Si esta inactivo, seguira autenticando pero no tendra acceso al modulo de cursos.</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} className={saving ? "pointer-events-none" : ""}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(open) => setEditOpen(open)}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-[720px] overflow-y-auto pr-8">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>

          <div className="grid gap-6">
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input value={form.email} disabled />
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Nombre</Label>
                <Input value={form.firstName} onChange={(e) => setForm((s) => ({ ...s, firstName: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Apellido</Label>
                <Input value={form.lastName} onChange={(e) => setForm((s) => ({ ...s, lastName: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>DNI</Label>
              <Input
                value={form.documentNumber}
                inputMode="numeric"
                onChange={(e) => setForm((s) => ({ ...s, documentNumber: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Nombre visible</Label>
              <Input value={form.displayName} onChange={(e) => setForm((s) => ({ ...s, displayName: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Teléfono</Label>
              <Input value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} placeholder="Opcional" />
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Agencia</Label>
                <Input value={form.agency} onChange={(e) => setForm((s) => ({ ...s, agency: e.target.value }))} placeholder="Opcional" />
              </div>
              <div className="grid gap-2">
                <Label>Legajo</Label>
                <Input value={form.employeeFileNumber} onChange={(e) => setForm((s) => ({ ...s, employeeFileNumber: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Cambiar contraseña</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                placeholder="Dejar en blanco para no cambiar. Mínimo 6 caracteres."
              />
            </div>
            <div className="flex items-start gap-3 rounded-3xl border border-border/60 bg-background p-5">
              <Checkbox
                checked={Boolean(form.isMember)}
                onCheckedChange={(v) => setForm((s) => ({ ...s, isMember: Boolean(v) }))}
              />
              <div className="grid gap-1">
                <Label>Socio ACAV</Label>
                <p className="text-xs leading-6 text-muted-foreground">Marcar si el usuario es socio registrado.</p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Rol</Label>
                <Select value={form.role} onValueChange={(v) => setForm((s) => ({ ...s, role: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {PORTAL_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Institucion (opcional)</Label>
                <Select
                  value={form.companyId || "none"}
                  onValueChange={(v) => setForm((s) => ({ ...s, companyId: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar institucion" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin institucion</SelectItem>
                    {companyOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-3xl border border-border/60 bg-background p-5">
              <Checkbox
                checked={Boolean(form.isActive)}
                onCheckedChange={(v) => setForm((s) => ({ ...s, isActive: Boolean(v) }))}
              />
              <div className="grid gap-1">
                <Label>Usuario activo</Label>
                <p className="text-xs leading-6 text-muted-foreground">Desactivar corta el acceso al módulo de cursos.</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} className={saving ? "pointer-events-none" : ""}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
