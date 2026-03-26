// ARCHIVED: Original path was app/(private)/dashboard/components/VisibilityChart.js

"use client";
import React, { useState } from "react";
import styles from "./VisibilityChart.module.css";

// Simple Line Chart Component (no external dependencies)
function SimpleLineChart({ data, width = "100%", height = 320 }) {
  if (!data || data.length === 0) {
    return (
      <div className={styles.chartPlaceholder} style={{ height }}>
        <p>No data available</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.visibility));
  const minValue = Math.min(...data.map(d => d.visibility));
  const range = maxValue - minValue || 1;

  // Calculate points for SVG path
  const points = data.map((item, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((item.visibility - minValue) / range) * 80; // 80% of height for data, 20% padding
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className={styles.chartContainer} style={{ height }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className={styles.chartSvg}>
        {/* Grid lines */}
        <defs>
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e5e7eb" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {/* Y-axis labels */}
        <g className={styles.yAxisLabels}>
          {[0, 25, 50, 75, 100].map(value => (
            <text key={value} x="2" y={100 - (value * 0.8) + 2} className={styles.axisLabel}>
              {Math.round(minValue + (value / 100) * range)}
            </text>
          ))}
        </g>
        
        {/* Data line */}
        <polyline
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          points={points}
          className={styles.dataLine}
        />
        
        {/* Data points */}
        {data.map((item, index) => {
          const x = (index / (data.length - 1)) * 100;
          const y = 100 - ((item.visibility - minValue) / range) * 80;
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="1.5"
              fill="#3b82f6"
              className={styles.dataPoint}
            />
          );
        })}
      </svg>
      
      {/* X-axis labels */}
      <div className={styles.xAxisLabels}>
        {data.map((item, index) => {
          if (index % Math.ceil(data.length / 6) === 0 || index === data.length - 1) {
            return (
              <span
                key={index}
                className={styles.xAxisLabel}
                style={{ left: `${(index / (data.length - 1)) * 100}%` }}
              >
                {item.date}
              </span>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

// Custom Select Component
function CustomSelect({ value, onChange, options, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={styles.selectContainer}>
      <button
        className={styles.selectTrigger}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{options.find(opt => opt.value === value)?.label || placeholder}</span>
        <span className={styles.selectArrow}>▼</span>
      </button>
      {isOpen && (
        <div className={styles.selectDropdown}>
          {options.map(option => (
            <button
              key={option.value}
              className={styles.selectOption}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VisibilityChart({ 
  data = [], 
  icps = [], 
  prompts = [], 
  isLoading = false 
}) {
  const [selectedIcp, setSelectedIcp] = useState("all");
  const [selectedPrompt, setSelectedPrompt] = useState("all");

  // Generate sample data if none provided
  const chartData = data.length > 0 ? data : [
    { date: "Jan 1", visibility: 45 },
    { date: "Jan 8", visibility: 52 },
    { date: "Jan 15", visibility: 58 },
    { date: "Jan 22", visibility: 62 },
    { date: "Jan 29", visibility: 68 },
    { date: "Feb 5", visibility: 65 },
    { date: "Feb 12", visibility: 72 },
  ];

  const icpOptions = [
    { value: "all", label: "All ICPs" },
    ...icps.map(icp => ({ value: icp.id, label: icp.name }))
  ];

  const promptOptions = [
    { value: "all", label: "All Prompts" },
    ...prompts.map(prompt => ({ 
      value: prompt.id, 
      label: prompt.text?.substring(0, 30) + "..." || `Prompt ${prompt.id}`
    }))
  ];

  if (isLoading) {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Prompt Visibility Over Time</h3>
        </div>
        <div className={styles.cardContent}>
          <div className={styles.loadingSkeleton} style={{ height: 320 }}>
            Loading chart...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.cardHeaderContent}>
          <h3 className={styles.cardTitle}>Prompt Visibility Over Time</h3>
          <div className={styles.filtersContainer}>
            <CustomSelect
              value={selectedIcp}
              onChange={setSelectedIcp}
              options={icpOptions}
              placeholder="All ICPs"
            />
            <CustomSelect
              value={selectedPrompt}
              onChange={setSelectedPrompt}
              options={promptOptions}
              placeholder="All Prompts"
            />
          </div>
        </div>
      </div>
      <div className={styles.cardContent}>
        <SimpleLineChart data={chartData} height={320} />
      </div>
    </div>
  );
}