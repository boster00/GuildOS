// ARCHIVED: Original path was components/ui/TopBar/TopBar.js

"use client";
import React from 'react';
import { Menu } from 'lucide-react';
import UserProfile from './UserProfile';
import ButtonAccount from '../../ButtonAccount';

export default function TopBar({ onMenuClick, user }) {
  return (
    <div className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200">
      <div className="flex items-center justify-between h-16 px-6">
        <button
          className="lg:hidden p-2 rounded-md hover:bg-gray-100 transition-colors"
          onClick={onMenuClick}
        >
          <Menu className="w-6 h-6 text-gray-600" />
        </button>
{/*         
        <div className="flex items-center space-x-4 ml-auto">
          <UserProfile user={user} />
        </div> */}
        <div className="flex items-center space-x-4 ml-auto">
          <ButtonAccount user={user} />
        </div>
      </div>
    </div>
  );
}