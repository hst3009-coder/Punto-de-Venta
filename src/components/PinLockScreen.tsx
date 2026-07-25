import React, { useState, useEffect } from 'react';
import { Employee } from '../types';
import { firestoreService } from '../lib/firebase';
import { verifyPin } from '../lib/crypto';
import { Lock, Delete, Unlock, AlertTriangle, Clock, RefreshCw, UserCheck } from 'lucide-react';

interface PinLockScreenProps {
  onUnlock: (employee: Employee) => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    try {
      const val = sessionStorage.getItem('pin_failed_attempts');
      return val ? parseInt(val, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [lockoutTimeLeft, setLockoutTimeLeft] = useState<number>(() => {
    try {
      const untilStr = sessionStorage.getItem('pin_lockout_until');
      if (untilStr) {
        const until = parseInt(untilStr, 10);
        const remaining = Math.ceil((until - Date.now()) / 1000);
        if (remaining > 0) {
          return remaining;
        } else {
          sessionStorage.removeItem('pin_lockout_until');
          sessionStorage.removeItem('pin_failed_attempts');
        }
      }
    } catch {
      // ignore
    }
    return 0;
  });

  const [error, setError] = useState<string | null>(() => {
    try {
      const untilStr = sessionStorage.getItem('pin_lockout_until');
      if (untilStr) {
        const until = parseInt(untilStr, 10);
        const remaining = Math.ceil((until - Date.now()) / 1000);
        if (remaining > 0) {
          return `Demasiados intentos fallidos. Teclado bloqueado por ${remaining} segundos.`;
        }
      }
    } catch {
      // ignore
    }
    return null;
  });
  const [verifying, setVerifying] = useState(false);

  // Load active employees
  useEffect(() => {
    const unsubscribe = firestoreService.subscribeToCollection<Employee>('employees',
      (data) => {
        setEmployees(data.filter(e => e.active));
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching employees:', err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Handle lockout countdown
  useEffect(() => {
    if (lockoutTimeLeft <= 0) return;
    const interval = setInterval(() => {
      try {
        const untilStr = sessionStorage.getItem('pin_lockout_until');
        if (untilStr) {
          const until = parseInt(untilStr, 10);
          const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
          setLockoutTimeLeft(remaining);
          if (remaining <= 0) {
            sessionStorage.removeItem('pin_lockout_until');
            sessionStorage.removeItem('pin_failed_attempts');
            setFailedAttempts(0);
            setError(null);
          }
        } else {
          setLockoutTimeLeft(prev => {
            const next = prev - 1;
            if (next <= 0) {
              sessionStorage.removeItem('pin_lockout_until');
              sessionStorage.removeItem('pin_failed_attempts');
              setFailedAttempts(0);
              setError(null);
              return 0;
            }
            return next;
          });
        }
      } catch {
        setLockoutTimeLeft(prev => Math.max(0, prev - 1));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTimeLeft]);

  const handleKeyPress = (num: string) => {
    if (lockoutTimeLeft > 0 || verifying) return;
    if (pin.length < 6) {
      setPin(prev => prev + num);
      setError(null);
    }
  };

  const handleBackspace = () => {
    if (lockoutTimeLeft > 0 || verifying) return;
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (lockoutTimeLeft > 0 || verifying) return;
    setPin('');
  };

  const handleConfirm = async () => {
    if (lockoutTimeLeft > 0 || verifying) return;
    if (!pin) {
      setError('Por favor, ingresa tu PIN de seguridad.');
      return;
    }
    if (pin.length < 4) {
      setError('El PIN debe tener al menos 4 dígitos.');
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      let foundEmployee: Employee | null = null;

      // Verify the input PIN against each active employee's hashed credentials
      if (employees.length === 0) {
        // Si no hay empleados registrados en la base de datos, permitimos ingresar con el PIN maestro "0000" para la configuración inicial
        if (pin === '0000') {
          foundEmployee = {
            id: 'initial-admin',
            name: 'Administrador Inicial',
            role: 'admin',
            active: true
          };
        }
      } else {
        for (const emp of employees) {
          if (emp.pinHash && emp.pinSalt) {
            const isMatch = await verifyPin(pin, emp.pinHash, emp.pinSalt);
            if (isMatch) {
              foundEmployee = emp;
              break;
            }
          }
        }
      }

      if (foundEmployee) {
        try {
          sessionStorage.removeItem('pin_failed_attempts');
          sessionStorage.removeItem('pin_lockout_until');
        } catch {
          // ignore
        }
        setFailedAttempts(0);
        onUnlock(foundEmployee);
      } else {
        const nextFailedCount = failedAttempts + 1;
        setFailedAttempts(nextFailedCount);
        try {
          sessionStorage.setItem('pin_failed_attempts', String(nextFailedCount));
        } catch {
          // ignore
        }
        setPin('');
        
        if (nextFailedCount >= 5) {
          const lockoutUntil = Date.now() + 30000;
          try {
            sessionStorage.setItem('pin_lockout_until', String(lockoutUntil));
          } catch {
            // ignore
          }
          setLockoutTimeLeft(30);
          setError('Demasiados intentos fallidos. Teclado bloqueado por 30 segundos.');
        } else {
          setError(`PIN incorrecto. Intento ${nextFailedCount} de 5.`);
        }
      }
    } catch (err) {
      console.error('Error in PIN validation:', err);
      setError('Ocurrió un error al validar el PIN. Inténtalo de nuevo.');
    } finally {
      setVerifying(false);
    }
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lockoutTimeLeft > 0 || verifying) return;
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        handleConfirm();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, employees, lockoutTimeLeft, verifying, failedAttempts]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 text-white select-none overflow-hidden font-sans">
      <div className="w-full max-w-sm px-6 py-8 flex flex-col justify-center items-center h-full">
        {/* Brand / Logo */}
        <div className="flex flex-col items-center gap-2 mb-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-2 shadow-inner">
            {lockoutTimeLeft > 0 ? (
              <Clock className="w-7 h-7 animate-pulse text-rose-400" />
            ) : verifying ? (
              <RefreshCw className="w-7 h-7 animate-spin text-indigo-400" />
            ) : (
              <Lock className="w-7 h-7 text-indigo-400" />
            )}
          </div>
          <h2 className="text-xl font-black tracking-tight text-slate-100">Terminal de Caja Cerrada</h2>
          <p className="text-xs text-slate-450 max-w-[280px]">
            {loading ? 'Sincronizando seguridad...' : 'Introduce tu PIN de seguridad para iniciar turno.'}
          </p>
        </div>

        {/* PIN Input Representation */}
        <div className="w-full max-w-[280px] mb-6 flex flex-col items-center">
          <div className="flex justify-center gap-3.5 h-12 items-center mb-2">
            {[...Array(6)].map((_, i) => {
              const hasDigit = pin.length > i;
              return (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                    hasDigit
                      ? 'bg-indigo-500 scale-125 shadow-lg shadow-indigo-500/40'
                      : 'bg-slate-750 border border-slate-700'
                  }`}
                />
              );
            })}
          </div>

          {/* Messages */}
          {error && (
            <div className={`text-center text-[11px] font-bold mt-2 px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
              lockoutTimeLeft > 0 || failedAttempts >= 4
                ? 'bg-rose-950/40 border-rose-900/50 text-rose-400'
                : 'bg-amber-950/40 border-amber-900/50 text-amber-400'
            }`}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {lockoutTimeLeft > 0 && (
            <div className="mt-2 text-xs font-black text-rose-400 bg-rose-500/10 px-3.5 py-1.5 rounded-xl border border-rose-500/20">
              Desbloqueo en: {lockoutTimeLeft}s
            </div>
          )}
        </div>

        {/* Digital Keypad Panel */}
        <div className="w-full max-w-[280px] grid grid-cols-3 gap-3.5 mb-8">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              disabled={lockoutTimeLeft > 0 || verifying || loading}
              className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-750 active:bg-slate-700/80 text-xl font-bold border border-slate-750/50 active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {num}
            </button>
          ))}
          
          {/* Action: Clear */}
          <button
            onClick={handleClear}
            disabled={lockoutTimeLeft > 0 || verifying || !pin}
            className="h-14 rounded-2xl text-xs font-black text-slate-400 hover:text-slate-200 hover:bg-slate-850 active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed uppercase tracking-wider"
          >
            Borrar
          </button>

          {/* Key: 0 */}
          <button
            onClick={() => handleKeyPress('0')}
            disabled={lockoutTimeLeft > 0 || verifying || loading}
            className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-750 active:bg-slate-700/80 text-xl font-bold border border-slate-750/50 active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            0
          </button>

          {/* Action: Confirm */}
          <button
            onClick={handleConfirm}
            disabled={lockoutTimeLeft > 0 || verifying || pin.length < 4}
            className={`h-14 rounded-2xl text-xs font-black transition-all flex items-center justify-center cursor-pointer disabled:cursor-not-allowed uppercase tracking-wider ${
              pin.length >= 4 && lockoutTimeLeft === 0 && !verifying
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 active:scale-95'
                : 'bg-slate-800/45 text-slate-500 opacity-40'
            }`}
          >
            Confirmar
          </button>
        </div>

        {/* Footer Active Check Status */}
        {!loading && employees.length === 0 && (
          <div className="text-[10px] text-indigo-300 flex items-center gap-1.5 bg-indigo-950/40 border border-indigo-900/50 px-3.5 py-2 rounded-xl text-center">
            <span>💡 Base de datos vacía: Usa el PIN maestro <strong className="text-white">0000</strong> para entrar y configurar</span>
          </div>
        )}
        {!loading && employees.length > 0 && (
          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 bg-slate-850/60 border border-slate-800/55 px-3 py-1.5 rounded-full">
            <UserCheck className="w-3 h-3 text-emerald-500" />
            <span>{employees.length} cajeros activos disponibles</span>
          </div>
        )}
      </div>
    </div>
  );
};
