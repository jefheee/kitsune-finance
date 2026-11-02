import { redirect } from "next/navigation";

export default function TermsRedirect() {
  redirect("/docs?tab=terms");
}
