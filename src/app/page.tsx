import { redirect } from "next/navigation";

// Root path: send to dashboard (middleware bounces unauthenticated users to /login).
export default function Home() {
  redirect("/dashboard");
}
