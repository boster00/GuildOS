"use client";
import React from 'react';

export default function UserProfile({ user = { name: 'User', initials: 'U' } }) {
  return (
    <div className="flex items-center space-x-4">
      <div className="text-sm text-gray-600">
        Welcome back!
      </div>
      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-600 transition-colors">
        <span className="text-white text-sm font-medium">
          {user.initials}
        </span>
      </div>
    </div>
  );
}