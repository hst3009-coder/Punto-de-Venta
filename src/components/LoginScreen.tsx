import React, { useState } from 'react';
import { StoreIdentity } from '../types';
import { authService } from '../lib/firebase';
import { Lock, AlertCircle, Sparkles } from 'lucide-react';

interface LoginScreenProps {
  storeIdentity: StoreIdentity;
  onLoginSuccess: (user: any) => void;
  initialError?: string | null;
}

export function LoginScreen({ storeIdentity, onLoginSuccess, initialError }: LoginScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await authService.signInWithGoogle();
      const user = result.user;
      
      // Client-side verification of authorized email
      if (user && user.email) {
        const emailLower = user.email.toLowerCase();
        const authorizedEmail = (import.meta.env.VITE_AUTHORIZED_EMAIL || 'hst.30.09@gmail.com').toLowerCase();
        if (emailLower === authorizedEmail) {
          onLoginSuccess(user);
        } else {
          // Sign out unauthorized user immediately
          await authService.signOut();
          setError('Esta cuenta no tiene acceso a este sistema.');
        }
      } else {
        setError('No se pudo obtener el correo de la cuenta de Google.');
      }
    } catch (err: any) {
      console.error('Error during Google sign-in:', err);
      // Clean up common firebase errors
      if (err.code === 'auth/popup-closed-by-user') {
        setError('La ventana de inicio de sesión fue cerrada.');
      } else {
        setError(err.message || 'Error al iniciar sesión con Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 selection:bg-indigo-500 selection:text-white animate-fade-in">
      
      {/* Decorative gradient background elements */}
      <div className="absolute top-0 left-0 right-0 h-[450px] bg-gradient-to-b from-indigo-50/50 to-transparent -z-10" />
      
      <div className="w-full max-w-md">
        
        {/* Main Card */}
        <div className="bg-white rounded-[32px] shadow-xl border border-slate-100 p-8 md:p-10 flex flex-col items-center relative overflow-hidden animate-scale-up">
          
          {/* Subtle top decoration */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600" />
          
          {/* Store Logo/Emoji Icon */}
          <div className="w-20 h-20 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-4xl mb-6 shadow-inner relative group">
            <span className="group-hover:scale-110 transition-transform duration-300">
              {storeIdentity.logoUrl || '🛒'}
            </span>
            <div className="absolute -bottom-1.5 -right-1.5 bg-white border border-slate-100 rounded-lg p-1 shadow-sm">
              <Lock className="w-3.5 h-3.5 text-indigo-600" />
            </div>
          </div>

          {/* Store Name & Slogan */}
          <div className="text-center space-y-2 mb-8">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-1.5">
              {storeIdentity.name || 'MI NEGOCIO'}
              <Sparkles className="w-5 h-5 text-indigo-500 shrink-0" />
            </h1>
            <p className="text-xs text-slate-400 font-bold tracking-normal uppercase max-w-xs mx-auto">
              {storeIdentity.slogan || 'Terminal Inteligente'}
            </p>
          </div>

          {/* Alert / Error Messages */}
          {(error || initialError) && (
            <div className="w-full bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-3 mb-6 animate-scale-up">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-black text-rose-800 uppercase tracking-wide">Acceso Denegado</h4>
                <p className="text-xs font-medium text-rose-600 leading-relaxed">
                  {error || initialError}
                </p>
              </div>
            </div>
          )}

          {/* Access Notice */}
          <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center mb-8">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">
              Acceso Restringido
            </span>
            <p className="text-xs text-slate-600 font-semibold leading-relaxed">
              Este sistema es privado y de uso exclusivo para el personal autorizado.
            </p>
          </div>

          {/* Button: Sign In with Google */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-sm border border-slate-200 hover:border-slate-300 rounded-2xl px-6 py-4 shadow-sm hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-indigo-600 font-extrabold">Verificando cuenta...</span>
              </div>
            ) : (
              <>
                {/* Standard Google G Logo */}
                <svg className="w-5 h-5 mr-3 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Iniciar sesión con Google</span>
              </>
            )}
          </button>

        </div>
        
        {/* Footer info */}
        <p className="text-center text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mt-6">
          © {new Date().getFullYear()} {storeIdentity.name || 'MI NEGOCIO'} • Panel de Control
        </p>
        
      </div>
    </div>
  );
}
