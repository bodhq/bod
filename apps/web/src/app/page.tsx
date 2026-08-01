import { redirect } from "next/navigation";

export default function RootPage() {
  // Kořenová cesta automaticky přesměruje do aplikace
  redirect("/app");
}
