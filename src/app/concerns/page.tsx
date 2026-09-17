import { redirect } from "next/navigation";

// "Concerns" evolved into the full ticketing system at /tickets. This
// redirect keeps any old bookmarks/links working.
export default function ConcernsRedirect() {
  redirect("/tickets");
}
