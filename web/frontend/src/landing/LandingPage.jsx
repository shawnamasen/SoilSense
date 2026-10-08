import { ArrowRight, CheckCircle2, Cpu, Leaf, PackageCheck, ShieldCheck, Smartphone, Sparkles, Sprout, Wifi } from 'lucide-react';
import { Link } from 'react-router-dom';
import HeroProductShowcase from './components/HeroProductShowcase';
import LandingHeader from './components/LandingHeader';
import SectionHeading from './components/SectionHeading';
import { businessOptions, landingFeatures, productPoints, trustPoints, workflowSteps } from './data';
import './landing.css';
export default function LandingPage() {
  return <main className="landing-page">
      <LandingHeader />

      <section id="home" className="landing-hero">
        <div className="landing-hero-field" />
        <div className="landing-hero-lines" />

        <div className="landing-shell landing-hero-layout">
          <div className="landing-hero-copy">
            <div className="landing-pill">
              <Sparkles /> Smart agriculture · clearer decisions
            </div>

            <h1>
              Smarter Soil.
              <span>Better Harvests.</span>
            </h1>

            <p className="landing-hero-lead">
              SoilSense combines a portable soil sensing device, cloud-connected monitoring,
              and AI-assisted recommendations to help farmers understand their soil and make
              better-informed crop and soil-management decisions.
            </p>

            <div className="landing-hero-benefits">
              {trustPoints.slice(0, 3).map(({
              icon: Icon,
              label
            }) => <span key={label}><Icon /> {label}</span>)}
            </div>

            <div className="landing-hero-actions">
              <Link className="landing-btn landing-btn-primary landing-btn-large" to="/signup">
                Explore SoilSense <ArrowRight />
              </Link>
              <a className="landing-btn landing-btn-outline landing-btn-large" href="#how">
                See how it works
              </a>
            </div>

            <div className="landing-hero-note">
              <ShieldCheck />
              <span>Decision-support system for farmer use, device management, and connected soil records.</span>
            </div>
          </div>

          <HeroProductShowcase />
        </div>
      </section>

      <section className="landing-proof-strip" aria-label="SoilSense platform summary">
        <div className="landing-shell landing-proof-grid">
          <Proof value="5" label="Core soil indicators" />
          <Proof value="7-in-1" label="Sensor hardware" />
          <Proof value="Mobile" label="Farmer monitoring" />
          <Proof value="AI-assisted" label="Decision support" />
        </div>
      </section>

      <section id="features" className="landing-section landing-features-section">
        <div className="landing-shell">
          <SectionHeading eyebrow="Why SoilSense" title="One connected experience from soil reading to practical next steps" text="SoilSense is designed to make soil information easier to collect, understand, revisit, and use without turning the farmer into a data analyst." />

          <div className="landing-feature-grid">
            {landingFeatures.map(({
            icon: Icon,
            title,
            text
          }, index) => <article className="landing-feature-card" key={title}>
                <div className="landing-feature-topline">
                  <span className="landing-feature-icon"><Icon /></span>
                  <small>{String(index + 1).padStart(2, '0')}</small>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>)}
          </div>
        </div>
      </section>

      <section id="how" className="landing-section landing-how-section">
        <div className="landing-shell">
          <SectionHeading eyebrow="How SoilSense works" title="From the field to the farmer in four understandable steps" text="The workflow keeps the device, farmer, mobile app, cloud, and admin portal in clear roles instead of mixing every feature together." light />

          <div className="landing-steps">
            {workflowSteps.map((step, index) => <article className="landing-step-card" key={step.number}>
                <span className="landing-step-number">{step.number}</span>
                <div className="landing-step-dot" />
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                {index < workflowSteps.length - 1 && <ArrowRight className="landing-step-arrow" />}
              </article>)}
          </div>
        </div>
      </section>

      <section id="device" className="landing-section landing-device-section">
        <div className="landing-shell landing-device-layout">
          <div className="landing-device-visual">
            <div className="landing-device-visual-bg" />
            <img src="/soilsense-device-final.webp" alt="SoilSense portable soil sensing device concept" />
            <span className="landing-device-visual-chip chip-scan"><Wifi /> Connected workflow</span>
            <span className="landing-device-visual-chip chip-field"><Leaf /> Field-oriented design</span>
          </div>

          <div className="landing-device-copy">
            <SectionHeading eyebrow="Meet the SoilSense device" title="A portable field tool built around one simple action: scan the soil" text="The current device concept follows the stick-style prototype direction: a handheld body, scan control, connected electronics, portable power, and a soil probe at the base." align="left" />

            <div className="landing-check-list">
              {productPoints.map(point => <span key={point}><CheckCircle2 /> {point}</span>)}
            </div>

            <div className="landing-device-callout">
              <Cpu />
              <div>
                <strong>The farmer operates the device.</strong>
                <p>The administrator manages registration, assignment, support, and platform status—not the farmer&apos;s day-to-day soil monitoring.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-experience-section">
        <div className="landing-shell">
          <SectionHeading eyebrow="Designed around real responsibilities" title="Farmer experience in the field. Admin support behind the product." text="The mobile and web sides are intentionally different so each user sees the tools they actually need." />

          <div className="landing-role-grid landing-role-grid-wide">
            <RoleCard icon={Smartphone} eyebrow="Mobile app" title="Farmer" text="Pair the SoilSense device, perform scans, view N/P/K/pH/moisture, review analysis and recommendations, check history, reports, and notifications." bullets={['Own soil readings', 'Crop decision support', 'History & reports']} />
            <RoleCard icon={Cpu} eyebrow="Web portal" title="System Administrator" text="Manage registered farmers, device inventory and assignment, support cases, aggregate analytics, and business distribution records." bullets={['Device status', 'Customer support', 'Business operations']} />
          </div>
        </div>
      </section>

      <section id="plans" className="landing-section landing-business-section">
        <div className="landing-shell">
          <SectionHeading eyebrow="Plans & business options" title="Choose a SoilSense option that fits how you want to use the platform" text="The earlier pricing concept is restored here so the business side feels concrete and easy to understand. These amounts can still be updated later when your final costing is approved." light />

          <div className="landing-business-grid">
            {businessOptions.map(option => <article className={`landing-business-card ${option.featured ? 'is-featured' : ''}`} key={option.title}>
                {option.featured && <span className="landing-business-featured">Most flexible</span>}
                <span className="landing-business-icon"><PackageCheck /></span>
                <small>{option.eyebrow}</small>
                <h3>{option.title}</h3>
                <div className="landing-business-price">
                  <strong>{option.price}</strong>
                  {option.period && <span>{option.period}</span>}
                </div>
                <p>{option.text}</p>
                <div className="landing-business-features">
                  {option.features.map(feature => <span key={feature}><CheckCircle2 /> {feature}</span>)}
                </div>
                {option.href.startsWith('/') ? <Link className="landing-business-link" to={option.href}>{option.action} <ArrowRight /></Link> : <a className="landing-business-link" href={option.href}>{option.action} <ArrowRight /></a>}
              </article>)}
          </div>
        </div>
      </section>

      <section id="contact" className="landing-contact-section">
        <div className="landing-shell landing-contact-card">
          <div className="landing-contact-mark"><Sprout /></div>
          <div className="landing-contact-copy">
            <span className="landing-eyebrow">Ready for the next step?</span>
            <h2>Build a smarter soil workflow around the farmer—not around guesswork.</h2>
            <p>Explore SoilSense, create a farmer account, or sign in to continue with the platform.</p>
          </div>
          <div className="landing-contact-actions">
            <Link className="landing-btn landing-btn-primary landing-btn-large" to="/signup">Get started <ArrowRight /></Link>
            <Link className="landing-btn landing-btn-glass landing-btn-large" to="/login">Sign in</Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-shell landing-footer-grid">
          <div className="landing-footer-brand">
            <span className="landing-brand-mark"><Sprout /></span>
            <span>
              <strong>Soil<span>Sense</span></strong>
              <small>Smart Soil. Better Harvest.</small>
            </span>
          </div>

          <div className="landing-footer-links">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#device">Device</a>
            <a href="#plans">Business</a>
          </div>

          <p>© 2026 SoilSense. AI-powered soil components detection and crop management decision support.</p>
        </div>
      </footer>
    </main>;
}
function Proof({
  value,
  label
}) {
  return <div className="landing-proof-item">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>;
}
function RoleCard({
  icon: Icon,
  eyebrow,
  title,
  text,
  bullets
}) {
  return <article className="landing-role-card">
      <div className="landing-role-card-head">
        <span className="landing-role-icon"><Icon /></span>
        <span><small>{eyebrow}</small><strong>{title}</strong></span>
      </div>
      <p>{text}</p>
      <div className="landing-role-bullets">
        {bullets.map(bullet => <span key={bullet}><CheckCircle2 /> {bullet}</span>)}
      </div>
    </article>;
}
