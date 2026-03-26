import { redirect } from "next/navigation";
import { createClient } from "@/libs/supabase/server";
import config from "@/config";


import { 
  LayoutDashboard, 
  Building2, 
  FileText, 
  Settings, 
  CreditCard,
  Sparkles,
  Flag,
  Package,
  Target,
  Video,
  BarChart2,
  TestTube
} from 'lucide-react';
import DashboardContainer from '@/components/ui/Layout/DashboardContainer';

// This is a server-side component to ensure the user is logged in.
// If not, it will redirect to the login page.
// It's applied to all subpages of /dashboard in /app/dashboard/*** pages
// You can also add custom static UI elements like a Navbar, Sidebar, Footer, etc..
// See https://shipfa.st/docs/tutorials/private-page
export default async function LayoutPrivate({ children }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(config.auth.loginUrl);
  }

  const adminEmails = [
    ...(process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL.trim().toLowerCase()] : []),
    ...(process.env.ADMIN_EMAILS
      ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
      : []),
  ];
  const isAdmin = adminEmails.includes((user.email || "").toLowerCase());

  const allSidebarItems = [
    { name: 'Dashboard', href: '/dashboard', iconName: 'LayoutDashboard', devOnly: true },
    { name: 'Tutorial Videos', href: '/tutorials', iconName: 'Video' },
    { name: 'Campaigns', href: '/campaigns', iconName: 'Flag', devOnly: true },
    { name: 'ContentMagic.ai', href: '/content-magic', iconName: 'Sparkles' },
    { name: 'Offers', href: '/offers', iconName: 'Package' },
    { name: 'ICPs', href: '/icps', iconName: 'Building2' },
    { name: 'Quests', href: '/quests', iconName: 'Target', devOnly: true },
    { name: 'Settings', href: '/settings', iconName: 'Settings' },
    { name: 'Billing', href: '/billing', iconName: 'CreditCard' },
    { name: 'Admin', href: '/admin', iconName: 'ShieldCheck', adminOnly: true },
    { name: 'Tests', href: '/tests', iconName: 'TestTube', devOnly: true },
    { name: 'Visibility Tracking', href: '/geo-seo-visibility-tracking', iconName: 'BarChart2', devOnly: true },
  ];

  // Filter out dev-only items in production
  // Use custom env var that can't be optimized away at build time
  // Default to HIDING dev items for safety (only show if explicitly enabled)
  const showDevItemsEnv = process.env.SHOW_DEV_SIDEBAR_ITEMS;
  const rawNodeEnv = process.env.NODE_ENV;
  
  // Only show dev items if BOTH conditions are met:
  // 1. SHOW_DEV_SIDEBAR_ITEMS is explicitly set to 'true'
  // 2. NODE_ENV is 'development'
  // This ensures dev items are hidden by default in production
  const shouldShowDevItems = showDevItemsEnv === 'true' && rawNodeEnv === 'development';
  
  const sidebarItems = allSidebarItems.filter(item => {
    if (item.devOnly) return shouldShowDevItems;
    if (item.adminOnly) return isAdmin;
    return true;
  });

    // const sidebarItems = [
    // { name: 'Dashboard', href: '/dashboard' },
    // { name: 'ICPs', href: '/icps' },
    // { name: 'Prompts', href: '/prompts' },
    // { name: 'Settings', href: '/settings' },
    // { name: 'Billing', href: '/billing' },
    // ];

    
  return (
    <DashboardContainer 
      navigationItems={sidebarItems}
      user={user}
    >
      {children}
    </DashboardContainer>
  );
}
