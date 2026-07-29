import { redirect } from "next/navigation";

export default async function CampusPaymentsPage({ params: { lang } }) {
  redirect(`/${lang}/dashboard/pagos`);
}
