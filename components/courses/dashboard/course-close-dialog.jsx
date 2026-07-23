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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/provider/auth.provider";
import { authedFetch } from "@/lib/auth/authed-fetch";
import { COURSE_CLOSE_REASONS } from "@/lib/courses/constants";

export default function JobCloseDialog({ open, onClose, jobId, onDone }) {
  const { user } = useAuth();
  const [closeReason, setCloseReason] = useState("");
  const [closeComment, setCloseComment] = useState("");
  const [saving, setSaving] = useState(false);

  const disabled = useMemo(() => !String(closeReason || "").trim() || saving, [closeReason, saving]);

  const handleClose = async () => {
    if (!user || !jobId) return;
    try {
      setSaving(true);
      const data = await authedFetch(user, `/api/courses/${jobId}/close`, {
        method: "POST",
        body: JSON.stringify({ closeReason, closeComment }),
      });
      toast.success("Curso cerrado", { position: "top-right" });
      setCloseReason("");
      setCloseComment("");
      onDone?.(data?.job);
      onClose();
    } catch (e) {
      toast.error(e?.message || "Error cerrando curso", { position: "top-right" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cerrar curso</DialogTitle>
          <DialogDescription>Definí el motivo y un comentario opcional para auditoría.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Select value={closeReason} onValueChange={setCloseReason}>
              <SelectTrigger>
                <SelectValue placeholder="Motivo de cierre" />
              </SelectTrigger>
              <SelectContent>
                {COURSE_CLOSE_REASONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Textarea
              rows={4}
              value={closeComment}
              onChange={(e) => setCloseComment(e.target.value)}
              placeholder="Comentario (opcional)"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleClose} disabled={disabled}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
