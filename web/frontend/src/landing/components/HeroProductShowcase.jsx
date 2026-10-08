import PhoneDashboardMockup from './PhoneDashboardMockup';
export default function HeroProductShowcase() {
  return <div className="landing-hero-product" aria-label="SoilSense device and mobile application preview">
      <div className="landing-hero-product-orbit orbit-one" />
      <div className="landing-hero-product-orbit orbit-two" />
      <div className="landing-device-halo" />

      <img className="landing-hero-device" src="/soilsense-device-final.webp" alt="SoilSense portable soil sensing device concept" />

      <PhoneDashboardMockup />
    </div>;
}
