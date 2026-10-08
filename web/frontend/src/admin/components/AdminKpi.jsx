export default function AdminKpi({
  icon: Icon,
  label,
  value,
  tone = ''
}) {
  return <article className="admin-kpi">
      {Icon && <span className={`admin-kpi-icon ${tone}`}><Icon /></span>}
      <div><small>{label}</small><strong>{value}</strong></div>
    </article>;
}
