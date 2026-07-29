import { getAdminDb } from "@/lib/firebase-admin";
import { COURSE_COLLECTIONS } from "@/lib/courses/collections";
import {
  PaymentCreateSchema,
  PaymentUpdateSchema,
  type Payment,
} from "@/lib/courses/schemas";
import { err } from "@/lib/courses/server/errors";
import { nowIso, removeUndefined } from "@/lib/courses/server/utils";

function toPayment(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) {
  return { id: doc.id, ...(doc.data() as any) } as Payment;
}

export async function createPayment(input: unknown) {
  const parsed = PaymentCreateSchema.parse(input);
  const db = getAdminDb();
  const ref = db.collection(COURSE_COLLECTIONS.payments).doc();
  const now = nowIso();

  const payload = removeUndefined({
    ...parsed,
    status: parsed.status || "pending",
    createdAt: now,
    updatedAt: now,
  });

  await ref.set(payload);
  const created = await ref.get();
  return toPayment(created);
}

export async function getPaymentById(id: string) {
  const db = getAdminDb();
  const snap = await db.collection(COURSE_COLLECTIONS.payments).doc(String(id)).get();
  if (!snap.exists) return null;
  return toPayment(snap);
}

export async function updatePayment(id: string, input: unknown) {
  const parsed = PaymentUpdateSchema.parse(input);
  const db = getAdminDb();
  const ref = db.collection(COURSE_COLLECTIONS.payments).doc(String(id));
  const existing = await ref.get();
  if (!existing.exists) throw err(404, "payment_not_found");

  const payload = removeUndefined({
    ...parsed,
    updatedAt: nowIso(),
  });

  await ref.set(payload, { merge: true });
  const updated = await ref.get();
  return toPayment(updated);
}
