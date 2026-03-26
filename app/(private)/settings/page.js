"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Code } from "lucide-react";
import styles from "./Settings.module.css";
import TemplateManagementTab from "./components/TemplateManagementTab";

export default function Settings() {
  const pathname = usePathname();
  
  const features = [
    {
      id: "page-templates",
      title: "Import Templates",
      description: "Manage and import your page component templates",
      href: "/settings/page-templates",
      icon: FileText,
      color: "blue"
    },
    {
      id: "custom-css",
      title: "Import CSS",
      description: "Add and import custom CSS styles for your content",
      href: "/settings/custom-css",
      icon: Code,
      color: "purple"
    }
  ];
  
  // Check if we're on the main settings page (not a subpage)
  const isMainPage = pathname === "/settings";
  
  // Get color classes
  const getColorClasses = (color) => {
    const colors = {
      blue: "bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700",
      purple: "bg-purple-50 border-purple-200 hover:bg-purple-100 text-purple-700"
    };
    return colors[color] || colors.blue;
  };
  
  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Settings</h1>
        <p className={styles.pageSubtitle}>
          Customize component templates and page configurations for your content
        </p>
      </div>

      {/* Feature Cards Grid */}
      {isMainPage && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Link
                key={feature.id}
                href={feature.href}
                className={`block p-6 rounded-lg border-2 transition-all hover:shadow-lg ${getColorClasses(feature.color)}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg bg-white/50 ${getColorClasses(feature.color).replace('bg-', 'bg-').replace('border-', 'border-')}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm opacity-80">{feature.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Show TemplateManagementTab only on Page Type Configuration route */}
      {/* Note: This can be added later if needed for a specific route */}
    </div>
  );
}