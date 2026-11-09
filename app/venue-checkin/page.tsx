import { redirect } from "next/navigation"

// The venue dashboard moved to /venue.
export default function VenueCheckinPage() {
  redirect("/venue")
}
