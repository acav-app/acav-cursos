"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

  const filtered = useMemo(() => {
    const q = normalizeString(query).toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.email, u.displayName, u.firstName, u.lastName, u.role, u.companyName].some((v) =>
        String(v || "").toLowerCase().includes(q)
      )
    );
  }, [users, query]);

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
      await authedFetch(user, `/api/courses/users/${editing.uid}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: normalizeString(form.displayName) || undefined,
          firstName: normalizeString(form.firstName) || undefined,
          lastName: normalizeString(form.lastName) || undefined,
          role: normalizeString(form.role),
          companyId: normalizeString(form.companyId) || undefined,
          isActive: Boolean(form.isActive),
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
      <div className="py-8 px-2 max-w-6xl mx-auto">
        <div className="rounded-3xl border border-border/60 bg-card p-8">
          <h1 className="text-2xl font-bold text-foreground">No se pudo cargar el perfil</h1>
          <p className="mt-3 text-sm text-muted-foreground">{actorError}</p>
        </div>
      </div>
    );
  }

  if (actor?.role !== "admin") {
    return (
      <div className="py-8 px-2 max-w-6xl mx-auto">
        <div className="rounded-3xl border border-border/60 bg-card p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Usuarios</div>
          <h1 className="mt-3 text-2xl font-bold text-foreground">Acceso restringido</h1>
          <p className="mt-3 text-sm text-muted-foreground">Solo administradores pueden gestionar usuarios y roles.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-2 max-w-6xl mx-auto">
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

      <div className="mt-8 rounded-3xl border border-border/60 bg-card p-6">
        <div className="grid gap-3 md:grid-cols-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por email, nombre, rol o institucion" />
          <div className="text-sm text-muted-foreground md:text-right self-center">{filtered.length} usuario(s)</div>
        </div>

        <div className="mt-6 grid gap-3">
          {filtered.map((u) => (
            <div key={u.uid} className="rounded-3xl border border-border/60 bg-background p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-foreground truncate">{u.email}</div>
                  <div className="text-sm text-muted-foreground">
                    {[u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.displayName || "Sin nombre"} · {u.role} · {u.isActive === false ? "inactivo" : "activo"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Institucion: {u.companyName || "Sin institucion vinculada"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => openEdit(u)}>
                    Editar
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {!filtered.length ? (
            <div className="rounded-3xl border border-border/60 bg-background p-8 text-center">
              <div className="text-lg font-semibold text-foreground">No hay usuarios para mostrar.</div>
              <p className="mt-2 text-sm text-muted-foreground">Crea el primer perfil del portal para una institucion o admin.</p>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={(open) => setCreateOpen(open)}>
        <DialogContent className="w-[95vw] max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Crear usuario del portal</DialogTitle>
          </DialogHeader>

          <div className="grid gap-6">
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
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
              <Label>Nombre visible (opcional)</Label>
              <Input value={form.displayName} onChange={(e) => setForm((s) => ({ ...s, displayName: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Contraseña inicial</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
              />
              <p className="text-xs text-muted-foreground">
                Contraseña temporal, luego puede recuperarla desde “¿Olvidaste tu contraseña?”.
              </p>
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
        <DialogContent className="w-[95vw] max-w-[720px]">
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
              <Label>Nombre visible</Label>
              <Input value={form.displayName} onChange={(e) => setForm((s) => ({ ...s, displayName: e.target.value }))} />
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
