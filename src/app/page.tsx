import { redirect } from "next/navigation";

// Root path: send directly to the RMS kiosk screen
export default function Home() {
  redirect("/rms/screen/scr-b");
}
