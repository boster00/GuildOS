"use client";
import { useState } from "react";

export default function ArticleDisplay({ html, onInsertSection }) {
  const [dragOverSection, setDragOverSection] = useState(null);

  const handleDragOver = (e, sectionId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOverSection(sectionId);
  };

  const handleDragLeave = () => {
    setDragOverSection(null);
  };

  const handleDrop = (e, sectionId) => {
    e.preventDefault();
    setDragOverSection(null);
    
    try {
      const sectionData = JSON.parse(e.dataTransfer.getData("text/plain"));
      onInsertSection(sectionData, sectionId);
    } catch (error) {
    }
  };

  // Parse HTML and wrap sections with drag-drop handlers
  const enhanceHtmlWithDragDrop = (htmlString) => {
    if (!htmlString) return "";
    
    // Create a temporary div to parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");
    
    // Find all top-level sections (direct children of body)
    const sections = doc.body.children;
    
    Array.from(sections).forEach((section, idx) => {
      const sectionId = `section-${idx}`;
      section.setAttribute("data-section-id", sectionId);
      section.setAttribute("data-droppable", "true");
      
      // Add visual feedback class
      if (dragOverSection === sectionId) {
        section.classList.add("border-4", "border-primary", "border-dashed", "bg-primary/5");
      }
    });
    
    return doc.body.innerHTML;
  };

  const enhancedHtml = enhanceHtmlWithDragDrop(html);

  return (
    <div 
      className="prose max-w-none"
      onDragOver={(e) => {
        e.preventDefault();
        const target = e.target.closest("[data-droppable]");
        if (target) {
          const sectionId = target.getAttribute("data-section-id");
          handleDragOver(e, sectionId);
        }
      }}
      onDragLeave={handleDragLeave}
      onDrop={(e) => {
        const target = e.target.closest("[data-droppable]");
        if (target) {
          const sectionId = target.getAttribute("data-section-id");
          handleDrop(e, sectionId);
        }
      }}
    >
      <div dangerouslySetInnerHTML={{ __html: enhancedHtml }} />
    </div>
  );
}
