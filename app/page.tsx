import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ChatShell } from "@/components/layout/ChatShell";
import {
  AUTH_COOKIE_NAME,
  isAuthEnabled,
  verifyAuthToken,
} from "@/lib/server/auth";

export default async function Home() {
  if (isAuthEnabled()) {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!token || !(await verifyAuthToken(token))) {
      redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`);
    }
  }

  return <ChatShell />;
}
