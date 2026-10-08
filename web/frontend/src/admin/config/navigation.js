import { Activity, BarChart3, Headphones, LayoutDashboard, Settings, Smartphone, Users } from 'lucide-react';

export const adminNavGroups = [{
  label: 'OVERVIEW',
  links: [{ to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
}, {
  label: 'MANAGEMENT',
  links: [
    { to: '/admin/farmers', label: 'Farmer Management', icon: Users },
    { to: '/admin/devices', label: 'Device Management', icon: Smartphone },
  ],
}, {
  label: 'OPERATIONS',
  links: [
    { to: '/admin/support', label: 'Support & Diagnostics', icon: Headphones },
    { to: '/admin/reports', label: 'Reports & Analytics', icon: BarChart3 },
    { to: '/admin/activity', label: 'Admin Activity', icon: Activity },
  ],
}, {
  label: 'SYSTEM',
  links: [{ to: '/admin/settings', label: 'Settings', icon: Settings }],
}];
