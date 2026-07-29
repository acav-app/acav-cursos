import { redirect } from "next/navigation";

export default async function CampusPage({ params: { lang } }) {
  redirect(`/${lang}/dashboard`);
}
