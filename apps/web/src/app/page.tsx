import { redirect } from "next/navigation";

export default function RootPage() {
  // kořenová cesta automaticky přesměruje do aplikace
  redirect("/app");
}
