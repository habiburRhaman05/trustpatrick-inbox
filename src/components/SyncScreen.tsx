import { useEffect, useState } from 'react';

const STEPS = [
  { icon: '🔗', label: 'Connecting to CRM' },
  { icon: '📇', label: 'Finding contacts tagged positive-replied…' },
  { icon: '💬', label: 'Loading your conversations…' },
  { icon: '✨', label: 'Almost ready — tidying things up…' },
];

const STEP_MS = 1400;

interface Props {
  subtitle?: string;
  error?: string | null;
  onRetry?: () => void;
}

export function SyncScreen({ subtitle, error, onRetry }: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (error) return;
    const id = setInterval(() => {
      setStep((s) => (s < STEPS.length - 1 ? s + 1 : s));
    }, STEP_MS);
    return () => clearInterval(id);
  }, [error]);

  if (error) {
    return (
      <div className="sync-screen">
        <div className="sync-card">
          <span className="sync-emoji">😕</span>
          <h2>We couldn't sync with CRM</h2>
          <p className="sync-error">{error}</p>
          {onRetry && (
            <button className="btn btn-primary" onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  // Creeps toward — but never reaches — 100% while the request is in flight.
  const progress = ((step + 1) / (STEPS.length + 1)) * 100;

  return (
    <div className="sync-screen" role="status" aria-live="polite" aria-busy="true">
      <div className="sync-card">
        <style>{`
          .spinner {
            width: 48px;
            height: 48px;
            border: 4px solid rgba(0, 0, 0, 0.08);
            border-top-color: #3498db;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 1.2rem;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .sync-step-label {
            font-size: 0.95rem;
            color: #555;
            margin-top: 0.75rem;
            text-align: center;
          }
        `}</style>

        <div className="spinner" />
        <h2>Getting your inbox ready</h2>
        {subtitle && <p className="sync-subtitle">{subtitle}</p>}

        <div className="sync-progress">
          <div className="sync-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <p className="sync-step-label">
          {STEPS[step].icon} {STEPS[step].label}
        </p>
      </div>
    </div>
  );
}