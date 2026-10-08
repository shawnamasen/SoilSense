import { Activity, BarChart3, Droplets, Leaf, ShieldCheck, Sparkles, Sprout } from 'lucide-react';
const benefits = [{
  icon: BarChart3,
  title: 'Smart Insights',
  detail: 'AI-Powered Analysis'
}, {
  icon: Leaf,
  title: 'Better Decisions',
  detail: 'Data-Driven Farming'
}, {
  icon: Sprout,
  title: 'Higher Yield',
  detail: 'Sustainable Future'
}];
function SoilSenseLogo() {
  return <div className="ss-logo" aria-label="SoilSense">
      <div className="ss-logo-mark">
        <Sprout />
      </div>

      <div>
        <div className="ss-logo-name">
          Soil<span>Sense</span>
        </div>

        <div className="ss-logo-tagline">
          Smart Soil. Better Harvest.
        </div>
      </div>
    </div>;
}
function SoilMiniChart() {
  return <div className="soil-mini-chart" aria-hidden="true">
      <svg viewBox="0 0 240 90" preserveAspectRatio="none">
        <defs>
          <linearGradient id="soilChartArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9af01d" stopOpacity="0.3" />

            <stop offset="100%" stopColor="#9af01d" stopOpacity="0" />
          </linearGradient>
        </defs>

        <line x1="0" y1="25" x2="240" y2="25" className="soil-chart-grid-line" />

        <line x1="0" y1="50" x2="240" y2="50" className="soil-chart-grid-line" />

        <line x1="0" y1="75" x2="240" y2="75" className="soil-chart-grid-line" />

        <path className="soil-chart-area" d="
            M 0 72
            C 22 67, 35 70, 52 58
            C 70 44, 82 62, 101 50
            C 120 38, 132 45, 150 31
            C 170 15, 185 39, 201 22
            C 218 6, 229 17, 240 10
            L 240 90
            L 0 90
            Z
          " />

        <path className="soil-chart-line" d="
            M 0 72
            C 22 67, 35 70, 52 58
            C 70 44, 82 62, 101 50
            C 120 38, 132 45, 150 31
            C 170 15, 185 39, 201 22
            C 218 6, 229 17, 240 10
          " />

        <circle cx="52" cy="58" r="3" className="soil-chart-point" />

        <circle cx="101" cy="50" r="3" className="soil-chart-point" />

        <circle cx="150" cy="31" r="3" className="soil-chart-point" />

        <circle cx="201" cy="22" r="3" className="soil-chart-point" />

        <circle cx="240" cy="10" r="3" className="soil-chart-point" />
      </svg>
    </div>;
}
function SoilAnalyticsCard() {
  return <div className="soil-analytics-card">
      <div className="soil-analytics-heading">
        <div>
          <strong>Soil Health Score</strong>
          <span>Current reading</span>
        </div>

        <Activity />
      </div>

      <div className="soil-score-row">
        <strong>87%</strong>
        <span>Good</span>
      </div>

      <SoilMiniChart />

      <div className="soil-score-track">
        <span />
      </div>

      <div className="soil-reading-grid">
        <div>
          <span>N</span>
          <strong>42</strong>
        </div>

        <div>
          <span>P</span>
          <strong>31</strong>
        </div>

        <div>
          <span>K</span>
          <strong>38</strong>
        </div>

        <div>
          <Droplets />
          <strong>64%</strong>
        </div>
      </div>

      <div className="soil-ai-status">
        <Sparkles />
        AI analysis ready
      </div>
    </div>;
}
export default function AuthShell({
  title,
  subtitle,
  children,
  variant = 'login'
}) {
  const isSignup = variant === 'signup';
  return <main className={`auth-page auth-page-${variant}`}>
      <div className="auth-split">
        <section className={`auth-hero auth-hero-${variant}`} aria-label="About SoilSense">
          <div className="auth-hero-overlay" />
          <div className="auth-hero-grid" />
          <div className="auth-hero-circle" />

          <div className="auth-hero-content">
            <div className="auth-hero-copy">
              <h1>
                {isSignup ? <>
                    Start smarter.
                    <span>Grow stronger.</span>
                  </> : <>
                    Smarter Soil.
                    <span>Better Harvests.</span>
                  </>}
              </h1>

              <p>
                {isSignup ? 'Create your SoilSense account and turn soil readings into clearer crop, fertilizer, and farm-management decisions.' : 'AI-powered soil analysis and intelligent recommendations for modern farmers.'}
              </p>
            </div>

            <div className="auth-hero-benefits">
              {benefits.map(({
              icon: Icon,
              title: benefitTitle,
              detail
            }) => <article className="auth-hero-benefit" key={benefitTitle}>
                    <div className="auth-hero-benefit-icon">
                      <Icon />
                    </div>

                    <div>
                      <strong>{benefitTitle}</strong>
                      <span>{detail}</span>
                    </div>
                  </article>)}
            </div>

            <div className="auth-hero-badge">
              <ShieldCheck />
              AI-powered soil analysis
            </div>
          </div>

          <SoilAnalyticsCard />
        </section>

        <section className="auth-panel">
          <section className={`auth-card auth-card-${variant}`}>
            <div className="auth-card-accent" />

            <SoilSenseLogo />

            <header className="auth-card-header">
              <h2>{title}</h2>
              <p>{subtitle}</p>
            </header>

            {children}
          </section>
        </section>
      </div>
    </main>;
}
