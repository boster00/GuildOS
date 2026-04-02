"use client";
import React from 'react';
import SidebarHeader from './SidebarHeader';
import SidebarNavigation from './SidebarNavigation';
import ButtonAccount from '../../ButtonAccount';

export default function Sidebar({ isOpen, onClose, navigationItems, user, isCollapsed, onToggleCollapse }) {
  return (
    // ✅ Remove fixed positioning - let parent control layout
    <div className="h-full bg-white shadow-lg border-r border-gray-200 flex flex-col">
      <SidebarHeader 
        onClose={onClose} 
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
      />
      
      <div className="flex-1 overflow-y-auto">
        <SidebarNavigation 
          items={navigationItems} 
          onItemClick={onClose}
          isCollapsed={isCollapsed}
        />
      </div>

      
      <div className={`flex items-center w-full ${isCollapsed ? 'justify-center' : 'space-x-4 ml-auto'}`}>
        <ButtonAccount user={user} showText={!isCollapsed} />
      </div>
    </div>
  );
}