import { CircleHelp, RefreshCw } from 'lucide-react';

export function OverviewErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="error-state">
      <div className="error-icon"><CircleHelp size={24} /></div>
      <h2>We couldn’t load the command center</h2>
      <p>Check your admin session or API connection, then try again.</p>
      <button type="button" className="primary-button" onClick={onRetry}><RefreshCw size={16} /> Try again</button>
    </div>
  );
}

