'use client';

import { parseVisitQrPayload, visitTypeLabelEs } from '@veka/shared';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { checkInVisit } from '@/app/(panel)/seguridad/actions';
import { GlassCard } from '@/components/ui/GlassCard';

interface VisitCheckInPanelProps {
  condominiumId: string;
}

interface CheckInResult {
  visitorName: string;
  unitIdentifier: string;
  visitType: string;
  validUntil: string;
  alreadyCheckedIn: boolean;
}

type Html5QrcodeInstance = {
  isScanning: boolean;
  start: (
    config: { facingMode: string },
    options: { fps: number; qrbox: { width: number; height: number } },
    onSuccess: (decoded: string) => void,
    onError: () => void,
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
};

const SCANNER_ID = 'veka-visit-qr-scanner';

export function VisitCheckInPanel({ condominiumId }: VisitCheckInPanelProps) {
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manualRef, setManualRef] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [pending, startTransition] = useTransition();
  const handlingRef = useRef(false);

  const stopScanner = useCallback(async () => {
    if (!scannerRef.current) return;
    try {
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
      scannerRef.current.clear();
    } catch {
      // Scanner may already be stopped.
    }
    scannerRef.current = null;
    setScanning(false);
  }, []);

  const processPayload = useCallback(
    (raw: string) => {
      if (handlingRef.current) return;
      handlingRef.current = true;
      setError(null);
      setResult(null);

      startTransition(async () => {
        const response = await checkInVisit({
          condominiumId,
          payload: raw,
        });

        handlingRef.current = false;

        if ('error' in response && response.error) {
          setError(response.error);
          return;
        }

        if ('visit' in response && response.visit) {
          setResult({
            visitorName: response.visit.visitorName,
            unitIdentifier: response.visit.unitIdentifier,
            visitType: response.visit.visitType,
            validUntil: response.visit.validUntil,
            alreadyCheckedIn: response.alreadyCheckedIn ?? false,
          });
        }
      });
    },
    [condominiumId],
  );

  const startScanner = useCallback(async () => {
    setError(null);
    setResult(null);

    if (scannerRef.current?.isScanning) return;

    const { Html5Qrcode } = await import('html5-qrcode');
    const scanner = new Html5Qrcode(SCANNER_ID) as unknown as Html5QrcodeInstance;
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          void stopScanner();
          processPayload(decoded);
        },
        () => {
          // Ignore scan misses between frames.
        },
      );
      setScanning(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir la cámara.');
      scannerRef.current = null;
      setScanning(false);
    }
  }, [processPayload, stopScanner]);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  return (
    <GlassCard>
      <h2 className="text-lg font-semibold text-[var(--text)]">Escanear pase de visita</h2>
      <p className="mt-1 text-sm text-muted">
        Escanea el QR del residente o ingresa la referencia manualmente para registrar el ingreso.
      </p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-black/5">
        <div id={SCANNER_ID} className="min-h-[260px] w-full" />
        {!scanning ? (
          <div className="flex items-center justify-center border-t border-[var(--border)] bg-[var(--surface-muted)] px-4 py-6 text-sm text-muted">
            Toca «Iniciar cámara» para escanear el pase.
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {!scanning ? (
          <button type="button" onClick={() => void startScanner()} className="glass-btn-primary">
            Iniciar cámara
          </button>
        ) : (
          <button type="button" onClick={() => void stopScanner()} className="glass-btn-secondary">
            Detener cámara
          </button>
        )}
      </div>

      <form
        className="mt-5 grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!manualRef.trim()) return;
          processPayload(manualRef.trim());
        }}
      >
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-[var(--text)]">Referencia manual</span>
          <input
            value={manualRef}
            onChange={(event) => setManualRef(event.target.value)}
            placeholder="Pega el JSON del QR o los 32 caracteres del token"
            className="glass-input"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !manualRef.trim()}
          className="glass-btn-secondary disabled:opacity-60"
        >
          {pending ? 'Validando…' : 'Validar referencia'}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      {result ? (
        <div className="mt-4 rounded-2xl border border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-4 py-3 text-sm">
          <p className="font-semibold text-accent">
            {result.alreadyCheckedIn ? 'Visita ya registrada dentro' : 'Ingreso autorizado'}
          </p>
          <p className="mt-1 text-[var(--text)]">
            {result.visitorName} · {visitTypeLabelEs(result.visitType as 'visit' | 'service' | 'rental')} · Unidad{' '}
            {result.unitIdentifier}
          </p>
          <p className="mt-1 text-muted">
            Válido hasta{' '}
            {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(
              new Date(result.validUntil),
            )}
          </p>
        </div>
      ) : null}
    </GlassCard>
  );
}
