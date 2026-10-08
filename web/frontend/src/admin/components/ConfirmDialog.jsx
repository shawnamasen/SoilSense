import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmDialog({ open, title, children, confirmLabel = 'Confirm', tone = 'primary', busy = false, onConfirm, onCancel }) {
  if (!open) return null;
  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget && !busy) onCancel?.();
  }}>
    <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title">
      <div className="admin-modal-head">
        <span className={`admin-modal-icon ${tone === 'danger' ? 'danger' : ''}`}><AlertTriangle /></span>
        <div><h2 id="admin-confirm-title">{title}</h2></div>
        <button className="admin-icon-btn" type="button" onClick={onCancel} disabled={busy} aria-label="Close"><X /></button>
      </div>
      <div className="admin-modal-body">{children}</div>
      <div className="admin-modal-actions">
        <button className="admin-btn" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className={`admin-btn ${tone === 'danger' ? 'danger' : 'primary'}`} type="button" onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmLabel}</button>
      </div>
    </div>
  </div>;
}
