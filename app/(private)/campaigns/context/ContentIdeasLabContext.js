"use client";

import React, { createContext, useContext, useState } from "react";

const ContentIdeasLabContext = createContext(null);

export function ContentIdeasLabProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [generatedIdeas, setGeneratedIdeas] = useState([]);
  const [selectedIdeas, setSelectedIdeas] = useState(new Set());
  const [volumeData, setVolumeData] = useState("");
  const [ideasWithVolumes, setIdeasWithVolumes] = useState([]);
  const [finalTitles, setFinalTitles] = useState({});
  const [finalBriefs, setFinalBriefs] = useState({});

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen(prev => !prev);

  return (
    <ContentIdeasLabContext.Provider
      value={{
        isOpen,
        open,
        close,
        toggle,
        generatedIdeas,
        setGeneratedIdeas,
        selectedIdeas,
        setSelectedIdeas,
        volumeData,
        setVolumeData,
        ideasWithVolumes,
        setIdeasWithVolumes,
        finalTitles,
        setFinalTitles,
        finalBriefs,
        setFinalBriefs,
      }}
    >
      {children}
    </ContentIdeasLabContext.Provider>
  );
}

export function useContentIdeasLab() {
  const context = useContext(ContentIdeasLabContext);
  if (!context) {
    throw new Error("useContentIdeasLab must be used within ContentIdeasLabProvider");
  }
  return context;
}

