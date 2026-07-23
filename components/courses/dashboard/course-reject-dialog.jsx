"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/provider/auth.provider";
import { authedFetch } from "@/lib/auth/authed-fetch";

export default function JobRejectDialog({ open, onClose, jobId, onDone }) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const disabled = useMemo(() => !String(reason || "").trim() || saving, [reason, saving]);

  const handleReject = async () => {
    if (!user || !jobId) return;
    try {
      setSaving(true);
      const data = await authedFetch(user, `/api/courses/${jobId}/reject`, {
        method: "POST",
        body: JSON.stringify({ rejectionReason: reason }),
      });
      toast.success("Curso rechazado", { position: "top-right" });
      setReason("");
      onDone?.(data?.job);
      onClose();
    } catch (e) {
      toast.error(e?.message || "Error rechazando curso", { position: "top-right" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rechazar curso</DialogTitle>
          <DialogDescription>Ingresá el motivo para comunicarlo a la institucion.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Textarea rows={5} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo de rechazo" />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleReject} disabled={disabled}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Rechazar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
