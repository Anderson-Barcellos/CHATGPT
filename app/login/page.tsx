"use client";

import { useState } from "react";
import { Lock, LogIn } from "lucide-react";
import { apiUrl } from "@/lib/utils";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
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
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-panel-strong)] p-8 shadow-[0_26px_90px_rgba(10,18,34,0.24)] backdrop-blur-xl">
          <div className="flex flex-col items-center mb-8">
            <div className="mb-4 rounded-full border border-primary/20 bg-primary/10 p-4">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h1 className="gc-text-gradient text-2xl font-bold">
              Gaúcho Chat
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Entre com sua senha para continuar
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="password" className="sr-only">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full rounded-lg border border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-control)] px-4 py-3 text-foreground transition-all placeholder:text-muted-foreground/55 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                autoFocus
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
          </form>

        </div>
      </div>
    </div>
  );
}
