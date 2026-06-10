"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  LoaderCircle,
  Lock,
  LogIn,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { GPTLogo } from "@/components/ui/gpt-logo";
import { apiUrl } from "@/lib/utils";

export default function LoginPage() {
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null);
  const [alreadyAuthenticated, setAlreadyAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    void fetch(apiUrl("/api/auth/check"), { cache: "no-store" })
      .then((response) => response.json() as Promise<{
        authenticated?: boolean;
        authEnabled?: boolean;
      }>)
      .then((data) => {
        if (!isCurrent) return;

        if (data.authenticated) {
          setAlreadyAuthenticated(true);
          setAuthEnabled(true);
          return;
        }

        setAuthEnabled(data.authEnabled ?? true);
      })
      .catch(() => {
        if (!isCurrent) return;
        setAuthEnabled(true);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        window.location.replace(process.env.NEXT_PUBLIC_BASE_PATH || "/");
      } else {
        setError(data.error || "Erro ao fazer login");
      }
    } catch {
      setError("Erro ao conectar com o servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gc-dynamic-bg relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div aria-hidden="true" className="gc-ambient-overlay pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="gc-subtle-grid pointer-events-none absolute inset-0 opacity-35" />
      <div className="relative z-10 w-full max-w-[30rem]">
        <div className="gc-login-panel rounded-[2.2rem] border p-5 backdrop-blur-xl md:p-8">
          <div className="relative z-10">
            <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Seguro e clínico
                </div>
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Acesso ao workspace
                  </p>
                  <h1 className="mt-1 text-[2.2rem] font-semibold tracking-[-0.05em] text-foreground sm:text-4xl">
                    Gaúcho Chat
                  </h1>
                </div>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-[0.96rem]">
                  O teu login pode ser simples, mas a entrada merece a mesma calma visual do resto do workspace.
                </p>
              </div>

              <div className="self-start">
                <div className="gc-refined-accent-surface rounded-[1.55rem] border p-3 shadow-[0_18px_36px_rgba(15,118,110,0.14)] sm:rounded-[1.75rem] sm:p-4">
                  <div className="gc-refined-soft-surface flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-[1.25rem] border sm:h-[5.5rem] sm:w-[5.5rem] sm:rounded-[1.45rem]">
                    <GPTLogo size={46} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6 rounded-[1.6rem] border border-primary/12 bg-white/45 px-4 py-3 text-sm text-muted-foreground backdrop-blur-sm dark:bg-white/[0.03]">
              {authEnabled === false
                ? "A proteção do app está desligada. Pode entrar direto."
                : "Entre com seu usuario e senha para continuar"}
            </div>

            {authEnabled === null ? (
              <div className="gc-refined-soft-surface flex items-center justify-center gap-2 rounded-2xl border px-4 py-4 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                <span>Verificando acesso...</span>
              </div>
            ) : authEnabled === false ? (
              <button
                type="button"
                onClick={() =>
                  window.location.replace(process.env.NEXT_PUBLIC_BASE_PATH || "/")
                }
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <LogIn className="h-4 w-4" />
                <span>Entrar no chat</span>
              </button>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                {alreadyAuthenticated && (
                  <button
                    type="button"
                    onClick={() =>
                      window.location.replace(process.env.NEXT_PUBLIC_BASE_PATH || "/")
                    }
                    className="gc-refined-soft-surface flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/20 hover:text-primary"
                  >
                    <span className="inline-flex items-center gap-2">
                      <LogIn className="h-4 w-4" />
                      Continuar com sessão atual
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}

                <div className="space-y-3">
                  <label
                    htmlFor="username"
                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    Usuário
                  </label>
                  <div className="gc-login-field flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all">
                    <UserRound className="h-4 w-4 text-muted-foreground/70" />
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Digite seu usuario"
                      className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground/55"
                      autoFocus
                      disabled={loading}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label
                    htmlFor="password"
                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    Senha
                  </label>
                  <div className="gc-login-field flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all">
                    <Lock className="h-4 w-4 text-muted-foreground/70" />
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Digite sua senha"
                      className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground/55"
                      disabled={loading}
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !username || !password}
                  className="flex w-full items-center justify-center gap-2 rounded-[1.45rem] bg-primary px-4 py-3.5 font-medium text-primary-foreground shadow-[0_16px_36px_rgba(15,118,110,0.16)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <span>Entrando...</span>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" />
                      <span>Entrar</span>
                    </>
                  )}
                </button>

                <div className="gc-refined-soft-surface flex items-center justify-between gap-3 rounded-[1.45rem] border px-4 py-3 text-xs text-muted-foreground/80">
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Sessão protegida por credencial local
                  </span>
                  <span>LGPD-ready</span>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
