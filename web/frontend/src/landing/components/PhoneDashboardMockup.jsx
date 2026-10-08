import { Bell, CircleUserRound, FileText, FlaskConical, Home, Info, Leaf, Sprout, WandSparkles } from 'lucide-react';
const nutrientRows = [{
  label: 'Nitrogen',
  value: '100.0',
  width: '88%',
  tone: 'good'
}, {
  label: 'Phosphorus',
  value: '61.0',
  width: '55%',
  tone: 'good'
}, {
  label: 'Potassium',
  value: '160.0',
  width: '72%',
  tone: 'good'
}, {
  label: 'pH',
  value: '5.0',
  width: '34%',
  tone: 'low'
}, {
  label: 'Moisture',
  value: '20.0',
  width: '24%',
  tone: 'low'
}];
export default function PhoneDashboardMockup() {
  return <div className="landing-phone-pro" aria-label="SoilSense farmer mobile dashboard preview">
      <div className="landing-phone-pro-notch" />

      <div className="landing-phone-pro-screen">
        <header className="landing-mobile-topbar">
          <button type="button" aria-label="Information"><Info /></button>
          <strong>SoilSense</strong>
          <div className="landing-mobile-topbar-actions">
            <button type="button" aria-label="Notifications"><Bell /></button>
            <button type="button" aria-label="Profile"><CircleUserRound /></button>
          </div>
        </header>

        <div className="landing-mobile-greeting">
          <strong>Good Afternoon, Farmer</strong>
          <small>Field A</small>
        </div>

        <section className="landing-mobile-health-card">
          <div className="landing-mobile-health-head">
            <span>Soil Health Index</span>
            <Leaf />
          </div>
          <strong>89<span>%</span></strong>
          <p>High Condition</p>
          <small>Last updated 1m ago</small>
        </section>

        <section className="landing-mobile-nutrient-card">
          <div className="landing-mobile-section-head">
            <strong>Nutrient Levels</strong>
            <span>View All</span>
          </div>

          <div className="landing-mobile-nutrient-list">
            {nutrientRows.map(item => <div className="landing-mobile-nutrient-row" key={item.label}>
                <span className="landing-mobile-nutrient-label">{item.label}</span>
                <span className="landing-mobile-nutrient-track" aria-hidden="true">
                  <i className={`landing-mobile-nutrient-fill is-${item.tone}`} style={{
                width: item.width
              }} />
                </span>
                <strong className={`is-${item.tone}`}>{item.value}</strong>
              </div>)}
          </div>
        </section>

        <section className="landing-mobile-smart-card">
          <div className="landing-mobile-section-head">
            <strong>Smart Recommendations</strong>
            <span className="landing-mobile-ai-ready"><WandSparkles /> AI READY</span>
          </div>
          <p>
            Soil is moderately dry. Consider checking moisture before the next scan
            and review the latest crop guidance.
          </p>
        </section>

        <nav className="landing-mobile-bottom-nav" aria-label="Mobile app preview navigation">
          <MobileNavItem icon={Home} label="Home" active />
          <MobileNavItem icon={FlaskConical} label="Analysis" />
          <MobileNavItem icon={Sprout} label="Crops" />
          <MobileNavItem icon={FileText} label="Reports" />
        </nav>
      </div>
    </div>;
}
function MobileNavItem({
  icon: Icon,
  label,
  active = false
}) {
  return <span className={active ? 'is-active' : ''}>
      <Icon />
      <small>{label}</small>
    </span>;
}
