"use client";
import React, { useState, useEffect } from 'react';
import MobileBackdrop from '../MobileBackdrop';
import Sidebar from '../Sidebar/Sidebar';
import CreditMeter from '@/components/CreditMeter';
import MeteringToggle from '@/components/MeteringToggle';
import OutOfCreditsBanner from '@/components/OutOfCreditsBanner';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

export default function DashboardContainer({ children, navigationItems, user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (savedState !== null) {
      setSidebarCollapsed(savedState === 'true');
    }
    setMounted(true);
  }, []);

  const handleSidebarToggle = () => setSidebarOpen(!sidebarOpen);
  const handleSidebarClose = () => setSidebarOpen(false);
  
  const handleToggleCollapse = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newState));
  };

  // Get sidebar width based on collapsed state
  const sidebarWidth = sidebarCollapsed ? 'lg:w-20' : 'lg:w-64';
  const contentPadding = sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64';

  // Prevent hydration mismatch by not rendering collapsed state until mounted
  const isCollapsed = mounted ? sidebarCollapsed : false;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <MobileBackdrop 
        isOpen={sidebarOpen} 
        onClose={handleSidebarClose} 
      />

      {/* Sidebar - Fixed width, full height */}
      <div className={`hidden lg:flex ${sidebarWidth} lg:flex-col lg:fixed lg:inset-y-0 transition-all duration-300`}>
        <Sidebar
          isOpen={true} // Always open on desktop
          onClose={handleSidebarClose}
          navigationItems={navigationItems}
          user={user}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />
      </div>

      {/* Mobile Sidebar */}
      <div className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <Sidebar
          isOpen={sidebarOpen}
          onClose={handleSidebarClose}
          navigationItems={navigationItems}
          user={user}
          isCollapsed={false}
          onToggleCollapse={() => {}}
        />
      </div>

      {/* Main content area */}
      <div className={`flex-1 ${contentPadding} transition-all duration-300`}>
        <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-base-200 bg-base-100">
          <MeteringToggle />
          <CreditMeter />
        </div>
        <OutOfCreditsBanner />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}