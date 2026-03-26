// ARCHIVED: Original path was app/(private)/dashboard/components/MetricsCard.js

import React from "react";
import styles from "./MetricsCard.module.css";

export default function MetricsCard({ title, value, icon: IconComponent, trend, trendUp, onClick }) {
  return (
    <div 
      className={`${styles.metricsCard} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
    >
      <div className={styles.cardContent}>
        <div className={styles.cardLayout}>
          <div className={styles.textSection}>
            <p className={styles.cardTitle}>{title}</p>
            <p className={styles.cardValue}>{value}</p>
            {trend && (
              <div className={styles.trendSection}>
                <span className={`${styles.trendIcon} ${trendUp ? styles.trendUp : styles.trendDown}`}>
                  {trendUp ? '↗' : '↘'}
                </span>
                <span className={`${styles.trendText} ${trendUp ? styles.trendUp : styles.trendDown}`}>
                  {trend}
                </span>
              </div>
            )}
          </div>
          {IconComponent && (
            <div className={styles.iconSection}>
              {typeof IconComponent === 'function' ? <IconComponent /> : IconComponent}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}