import React, { useState, useEffect, useRef } from 'react';
import { Lock, X, CheckCircle2, AlertTriangle, KeyRound, Eye, EyeOff, ShieldAlert } from 'lucide-react';

interface PinLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  correctPin?: string;
  title?: string;
  description?: string;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_SEC = 60;
const SESSION_LOCKOUT_KEY = 'beeline_pin_lockout_until';
const SESSION_ATTEMPTS_KEY = 'beeline_pin_failed_attempts';

export const PinLockModal: React.FC<PinLockModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  correctPin = '2508',
  title = "Rahbar Rejimiga Kirish",
  description = "Sof foydalar, ta'minotchi qarzlari va tan narxlar faqat do'kon egasi uchun himoyalangan. Davom etish uchun 4 xonali PIN-kodni kiriting."
}) => {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [showNumbers, setShowNumbers] = useState<boolean>(false);
  const [remainingLockout, setRemainingLockout] = useState<number>(0);
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    const saved = sessionStorage.getItem(SESSION_ATTEMPTS_KEY);
    return saved ? parseInt(saved, 10) || 0 : 0;
  });

  const inputRef = useRef<HTMLInputElement>(null);

  // Check active lockout on mount and open
  useEffect(() => {
    if (!isOpen) return;

    const checkLockout = () => {
      const lockoutUntilStr = sessionStorage.getItem(SESSION_LOCKOUT_KEY);
      if (lockoutUntilStr) {
        const lockoutUntil = parseInt(lockoutUntilStr, 10);
        const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
        if (remaining > 0) {
          setRemainingLockout(remaining);
          setError(`Xavfsizlik: Ko'p noto'g'ri urinish tufayli bloklandi. ${remaining}s kuting.`);
          return;
        } else {
          sessionStorage.removeItem(SESSION_LOCKOUT_KEY);
          sessionStorage.setItem(SESSION_ATTEMPTS_KEY, '0');
          setFailedAttempts(0);
          setRemainingLockout(0);
          setError('');
        }
      }
    };

    checkLockout();
    setPin('');
    setIsSuccess(false);

    const timer = setInterval(() => {
      checkLockout();
    }, 1000);

    setTimeout(() => {
      if (remainingLockout <= 0) {
        inputRef.current?.focus();
      }
    }, 120);

    return () => clearInterval(timer);
  }, [isOpen, remainingLockout]);

  if (!isOpen) return null;

  const isLockedOut = remainingLockout > 0;

  const handleDigit = (digit: string) => {
    if (isLockedOut) return;
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError('');
      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    if (isLockedOut) return;
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    if (isLockedOut) return;
    setPin('');
    setError('');
  };

  const verifyPin = (codeToVerify: string) => {
    if (isLockedOut) return;

    if (codeToVerify === correctPin) {
      setIsSuccess(true);
      setError('');
      sessionStorage.removeItem(SESSION_LOCKOUT_KEY);
      sessionStorage.setItem(SESSION_ATTEMPTS_KEY, '0');
      setFailedAttempts(0);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 350);
    } else {
      const newFailed = failedAttempts + 1;
      setFailedAttempts(newFailed);
      sessionStorage.setItem(SESSION_ATTEMPTS_KEY, newFailed.toString());

      if (newFailed >= MAX_FAILED_ATTEMPTS) {
        const lockUntil = Date.now() + LOCKOUT_DURATION_SEC * 1000;
        sessionStorage.setItem(SESSION_LOCKOUT_KEY, lockUntil.toString());
        setRemainingLockout(LOCKOUT_DURATION_SEC);
        setError(`Xavfsizlik: 5 marta xato kiritildi! PIN ${LOCKOUT_DURATION_SEC} soniyaga bloklandi.`);
        setPin('');
      } else {
        const left = MAX_FAILED_ATTEMPTS - newFailed;
        setError(`PIN-kod noto'g'ri! ${left} ta urinish qoldi.`);
        setTimeout(() => {
          setPin('');
        }, 500);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isLockedOut) return;
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      handleDigit(e.key);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      handleBackspace();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 space-y-4 text-center relative animate-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer transition-colors"
          title="Yopish"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Shield / Key Icon */}
        <div className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg border-2 transition-all ${
          isLockedOut
            ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
            : 'bg-amber-400 text-stone-950 border-amber-300'
        }`}>
          {isLockedOut ? (
            <ShieldAlert className="w-7 h-7 stroke-[2.2]" />
          ) : (
            <KeyRound className="w-7 h-7 stroke-[2.2]" />
          )}
        </div>

        {/* Title and Description */}
        <div className="space-y-1">
          <h3 className="font-black text-lg text-stone-900 flex items-center justify-center gap-1.5">
            <span>{isLockedOut ? "Xavfsizlik Himoyasi Faollashdi" : title}</span>
          </h3>
          <p className="text-xs text-stone-500 leading-relaxed max-w-xs mx-auto">
            {isLockedOut
              ? "Ko'p marotaba noto'g'ri PIN kiritilgani sababli tizim vaqtincha bloklandi."
              : description}
          </p>
        </div>

        {/* Hidden Input for Mobile Native Numeric Keyboard */}
        <input
          ref={inputRef}
          type="password"
          disabled={isLockedOut}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={pin}
          onChange={(e) => {
            if (isLockedOut) return;
            const val = e.target.value.replace(/\D/g, '');
            if (val.length <= 4) {
              setPin(val);
              setError('');
              if (val.length === 4) {
                verifyPin(val);
              }
            }
          }}
          className="opacity-0 absolute -z-10 w-1 h-1"
        />

        {/* PIN Indicators (4 display circles/squares) */}
        <div 
          className={`flex justify-center items-center gap-3 py-1.5 ${isLockedOut ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          onClick={() => !isLockedOut && inputRef.current?.focus()}
        >
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            const currentDigit = pin[index];
            return (
              <div
                key={index}
                className={`w-11 h-13 rounded-2xl flex items-center justify-center text-xl font-black transition-all border-2 ${
                  isSuccess
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                    : isLockedOut
                    ? 'bg-rose-50 border-rose-300 text-rose-400'
                    : error
                    ? 'bg-red-50 border-red-400 text-red-700'
                    : isFilled
                    ? 'bg-amber-50 border-amber-400 text-stone-950 shadow-xs'
                    : 'bg-stone-50 border-stone-200 text-stone-400'
                }`}
              >
                {isFilled ? (showNumbers ? currentDigit : '●') : ''}
              </div>
            );
          })}
        </div>

        {/* Toggle Show Numbers */}
        {!isLockedOut && (
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setShowNumbers(!showNumbers)}
              className="text-[11px] text-stone-500 hover:text-stone-800 flex items-center gap-1 font-medium transition-colors cursor-pointer"
            >
              {showNumbers ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showNumbers ? "Raqamlarni yashirish" : "Raqamlarni ko'rsatish"}</span>
            </button>
          </div>
        )}

        {/* Error / Lockout / Success Feedback Banner */}
        {isLockedOut ? (
          <div className="text-xs font-bold text-rose-700 bg-rose-50 py-2.5 px-3 rounded-xl border border-rose-300 flex items-center justify-center gap-2 animate-in fade-in">
            <Lock className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Qayta urinish: {remainingLockout} soniyadan so'ng</span>
          </div>
        ) : error ? (
          <div className="text-xs font-bold text-red-600 bg-red-50 py-2 px-3 rounded-xl border border-red-200 flex items-center justify-center gap-1.5 animate-in fade-in">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        ) : isSuccess ? (
          <div className="text-xs font-bold text-emerald-700 bg-emerald-50 py-2 px-3 rounded-xl border border-emerald-200 flex items-center justify-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>PIN tasdiqlandi! Rahbar rejimiga o'tildi.</span>
          </div>
        ) : (
          <div className="text-[11px] text-stone-400">
            Faqat do'kon rahbari uchun himoyalangan
          </div>
        )}

        {/* Numeric Keypad */}
        <div className={`grid grid-cols-3 gap-2 pt-1 max-w-[260px] mx-auto ${isLockedOut ? 'opacity-40 pointer-events-none' : ''}`}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={isLockedOut}
              onClick={() => handleDigit(digit)}
              className="h-11 rounded-xl bg-stone-100 hover:bg-stone-200 active:bg-amber-300 text-stone-900 font-bold text-lg flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            disabled={isLockedOut}
            onClick={handleClear}
            className="h-11 rounded-xl bg-stone-100 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center transition-colors cursor-pointer uppercase disabled:opacity-50"
          >
            Tozalash
          </button>
          <button
            type="button"
            disabled={isLockedOut}
            onClick={() => handleDigit('0')}
            className="h-11 rounded-xl bg-stone-100 hover:bg-stone-200 active:bg-amber-300 text-stone-900 font-bold text-lg flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            disabled={isLockedOut}
            onClick={handleBackspace}
            className="h-11 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-base flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
            title="O'chirish"
          >
            ⌫
          </button>
        </div>

        {/* Footer Cancel Button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
          >
            Bekor qilish (Kassir rejimida qolish)
          </button>
        </div>
      </div>
    </div>
  );
};
