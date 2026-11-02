import { redirect } from "next/navigation";

export default function ChangelogRedirect() {
  redirect("/docs?tab=changelog");
}
