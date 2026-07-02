'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { GlassBackground } from '@/components/ui/GlassBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    const redirectRes = await fetch('/api/auth/redirect');
    const redirectData = (await redirectRes.json()) as { path?: string };
    router.push(redirectData.path ?? '/');
    router.refresh();
  }

  return (
    <GlassBackground>
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <GlassCard className="w-full max-w-md">
          <p className="text-sm font-medium text-accent">Panel administrativo</p>
          <h1 className="serif-title mt-2 text-3xl text-[var(--text)]">
            Bienvenido a <span className="text-accent italic">Veka</span>
          </h1>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block text-sm font-medium text-muted">
              Correo
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input mt-1"
              />
            </label>

            <label className="block text-sm font-medium text-muted">
              Contraseña
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input mt-1"
              />
            </label>

            {error ? <p className="text-sm text-red-300">{error}</p> : null}

            <button type="submit" disabled={loading} className="glass-btn-primary w-full">
              {loading ? 'Entrando…' : 'Iniciar sesión'}
            </button>
          </form>
        </GlassCard>
      </div>
    </GlassBackground>
  );
}
