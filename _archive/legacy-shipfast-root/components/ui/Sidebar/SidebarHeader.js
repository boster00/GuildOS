"use client";
import React from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function SidebarHeader({ onClose, isCollapsed, onToggleCollapse }) {
  return (
    <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
      <div className="flex items-center space-x-3 min-w-0">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">CJ</span>
        </div>
        {!isCollapsed && (
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900">CJGEO</h1>
            <p className="text-xs text-gray-500">Visibility Intelligence</p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {/* Desktop collapse toggle */}
        <button
          className="hidden lg:flex p-1 rounded-md hover:bg-gray-100 transition-colors"
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          )}
        </button>
        {/* Mobile close button */}
        <button
          className="lg:hidden p-1 rounded-md hover:bg-gray-100"
          onClick={onClose}
        >
          <X className="w-6 h-6 text-gray-500" />
        </button>
      </div>
    </div>
  );
}