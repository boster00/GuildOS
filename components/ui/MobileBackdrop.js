"use client";
import React from 'react';

export default function MobileBackdrop({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
      onClick={onClose}
    />
  );
}