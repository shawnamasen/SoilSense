export default function DetailRow({
  label,
  value
}) {
  return <div className="admin-detail-row"><span>{label}</span><strong>{value}</strong></div>;
}
