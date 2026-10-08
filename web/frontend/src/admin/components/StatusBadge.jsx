export default function StatusBadge({
  children,
  tone = ''
}) {
  return <span className={`admin-status ${tone}`}>{children}</span>;
}
