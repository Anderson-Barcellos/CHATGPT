import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, isAuthEnabled, verifyAuthToken } from "@/lib/server/auth";
import { ViewportProbe } from "./ViewportProbe";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Sonda temporária do iOS 27 (web app da tela inicial). Remover junto com o
// link em SettingsDrawer quando a correção do layout estiver calibrada.
export default async function ViewportProbePage() {
  if (isAuthEnabled()) {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token || !(await verifyAuthToken(token))) redirect("/login");
  }
  return <ViewportProbe />;
}
