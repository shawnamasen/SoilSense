export default function SectionHeading({
  eyebrow,
  title,
  text,
  align = 'center',
  light = false
}) {
  return <div className={`landing-section-heading landing-section-heading-${align} ${light ? 'is-light' : ''}`}>
      <span className="landing-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>;
}
