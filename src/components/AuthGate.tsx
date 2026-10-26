import React, { FormEvent, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../db/supabase';

export const AuthGate: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;

    setIsSubmitting(true);
    setMessage('');
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage(
          data.session
            ? 'Compte créé. Connexion en cours…'
            : 'Compte créé. Vérifiez votre e-mail pour confirmer votre inscription.'
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Une erreur de connexion est survenue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-7">
          <p className="text-xs font-extrabold tracking-widest text-emerald-700">PADEL PRO</p>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-900">
            {isSignUp ? 'Créer un compte' : 'Connexion'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Connectez-vous pour accéder aux tournois et les synchroniser en temps réel.
          </p>
        </div>

        {!isSupabaseConfigured ? (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
            Supabase n’est pas configuré. Définissez VITE_SUPABASE_URL et
            VITE_SUPABASE_PUBLISHABLE_KEY dans .env.local, puis redémarrez Vite.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              Adresse e-mail
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Mot de passe
              <input
                type="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                minLength={6}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            {message && (
              <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
                {message}
              </p>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Veuillez patienter…' : isSignUp ? 'Créer mon compte' : 'Se connecter'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setMessage('');
              }}
              className="w-full py-1 text-sm font-semibold text-emerald-700 hover:text-emerald-900"
            >
              {isSignUp ? 'J’ai déjà un compte' : 'Créer un compte'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
};
