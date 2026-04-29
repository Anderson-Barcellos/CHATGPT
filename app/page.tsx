import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GauchoChatShellV2 } from "@/components/workspace-v2/GauchoChatShellV2";
import {
  AUTH_COOKIE_NAME,
  isAuthEnabled,
  verifyAuthToken,
} from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function Home() {
  if (isAuthEnabled()) {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!token || !(await verifyAuthToken(token))) {
      redirect(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`);
    }
  }

  return <GauchoChatShellV2 />;
}
