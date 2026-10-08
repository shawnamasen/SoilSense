import { BarChart3, BrainCircuit, Cloud, History, Leaf, ScanLine, Smartphone, Wifi } from 'lucide-react';
export const landingFeatures = [{
  icon: ScanLine,
  title: 'Complete soil snapshot',
  text: 'Bring N, P, K, pH, and moisture into one clear field workflow instead of checking information in separate places.'
}, {
  icon: BrainCircuit,
  title: 'AI-assisted insights',
  text: 'Organize sensor readings into understandable soil analysis, crop suitability, and management recommendations.'
}, {
  icon: Smartphone,
  title: 'Farmer-first mobile experience',
  text: 'Farmers monitor their own readings, history, recommendations, alerts, and reports from the SoilSense mobile app.'
}, {
  icon: Cloud,
  title: 'Connected field-to-cloud flow',
  text: 'When the device is connected, readings can move from the field device to the farmer account through the cloud.'
}, {
  icon: History,
  title: 'History that stays useful',
  text: 'Keep previous soil scans organized for comparison, reporting, and better follow-up decisions over time.'
}, {
  icon: BarChart3,
  title: 'Business and support portal',
  text: 'The web admin side manages registered farmers, devices, support cases, platform analytics, and distribution records.'
}];
export const workflowSteps = [{
  number: '01',
  title: 'Scan the soil',
  text: 'Insert the SoilSense probe into the target area and start a soil scan.'
}, {
  number: '02',
  title: 'Send the reading',
  text: 'The connected device prepares the soil data for synchronization to the SoilSense platform.'
}, {
  number: '03',
  title: 'Analyze the result',
  text: 'SoilSense organizes the core indicators and prepares AI-assisted decision support.'
}, {
  number: '04',
  title: 'Act with context',
  text: 'The farmer reviews readings, recommendations, history, reports, and alerts on mobile.'
}];
export const productPoints = ['Portable stick-style field form factor', '7-in-1 soil sensor hardware integration', 'Five core SoilSense indicators: N, P, K, pH, and moisture', 'ESP32-based connected device workflow', 'Farmer pairing and mobile account ownership', 'Cloud-backed history, reports, and recommendations'];
export { businessPlans as businessOptions } from '../shared/businessPlans';
export const trustPoints = [{
  icon: Leaf,
  label: 'Farmer-centered'
}, {
  icon: Wifi,
  label: 'Connected workflow'
}, {
  icon: BrainCircuit,
  label: 'AI-assisted'
}, {
  icon: Smartphone,
  label: 'Mobile monitoring'
}];
