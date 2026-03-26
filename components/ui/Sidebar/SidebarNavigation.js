"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Building2, 
  FileText, 
  Settings, 
  Target,
  CreditCard,
  Search,
  FileEdit,
  Sparkles,
  Star,
  Flag,
  Package,
  Video,
  BarChart2,
  FlaskConical,
  TestTube,
  ShieldCheck
} from 'lucide-react';
import VideoModal from '@/components/VideoModal';


const iconMap = {
  LayoutDashboard: LayoutDashboard,
  Building2: Building2,
  FileText: FileText,
  Settings: Settings,
  Target: Target,
  CreditCard: CreditCard,
  Search: Search,
  FileEdit: FileEdit,
  Sparkles: Sparkles,
  Star: Star,
  Flag: Flag,        // Added new icon
  Package: Package,  // Added new icon
  Video: Video,      // Added video icon
  BarChart2: BarChart2,
  FlaskConical: FlaskConical,
  TestTube: TestTube,
  ShieldCheck: ShieldCheck,
};

export default function SidebarNavigation({ items, onItemClick, isCollapsed }) {
  const pathname = usePathname();
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);

  const handleItemClick = (item, e) => {
    if (item.videoUrl) {
      e.preventDefault();
      setSelectedVideo({ url: item.videoUrl, title: item.name });
      setIsVideoModalOpen(true);
      if (onItemClick) onItemClick();
    } else if (onItemClick) {
      onItemClick();
    }
  };

  return (
    <>
      <nav className="mt-6">
        <div className={`px-3 space-y-1 ${isCollapsed ? 'px-2' : ''}`}>
          {items.map((item) => {
            // ✅ Get the actual icon component from the iconName string
            const IconComponent = iconMap[item.iconName];
            const isActive = pathname === item.href && !item.videoUrl;
            const isVideoItem = !!item.videoUrl;
            
            const Component = isVideoItem ? 'button' : Link;
            const baseClassName = `
              flex items-center text-sm font-medium rounded-lg transition-colors group relative
              ${isCollapsed ? 'justify-center px-3 py-3' : 'px-3 py-3'}
              ${isActive 
                ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-500' 
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }
            `;
            
            const props = isVideoItem 
              ? { 
                  onClick: (e) => handleItemClick(item, e),
                  className: `w-full ${baseClassName}`,
                  title: isCollapsed ? item.name : undefined
                }
              : {
                  href: item.href,
                  className: baseClassName,
                  onClick: onItemClick,
                  title: isCollapsed ? item.name : undefined
                };
            
            return (
              <Component
                key={item.name}
                {...props}
              >
                {IconComponent && (
                  <IconComponent className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'} transition-colors ${
                    isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                  }`} />
                )}
                {!isCollapsed && <span>{item.name}</span>}
                
                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50">
                    {item.name}
                  </div>
                )}
              </Component>
            );
          })}
        </div>
      </nav>

      {selectedVideo && (
        <VideoModal
          isOpen={isVideoModalOpen}
          onClose={() => {
            setIsVideoModalOpen(false);
            setSelectedVideo(null);
          }}
          videoUrl={selectedVideo.url}
          title={selectedVideo.title}
        />
      )}
    </>
  );
}