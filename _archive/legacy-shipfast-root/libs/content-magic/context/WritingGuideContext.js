"use client";
import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from "react";
import { getAllRules } from "../rules/index.js";

const WritingGuideContext = createContext(null);

export function WritingGuideProvider({ children, article, initialRuleStates = {}, customCssEnabled = false }) {
  useEffect(() => {
  }, [customCssEnabled]);
  // ============================================
  // Editor Ref
  // ============================================
  const editorRef = useRef(null);
  const editorContainerRef = useRef(null);

  // ============================================
  // Article State
  // ============================================
  const [articleState, setArticleState] = useState(() => {
    // Initialize article state
    const contentLen = article?.content_html != null ? String(article.content_html).length : 0;
    if (typeof console !== "undefined" && console.log) {
    }
    if (article?.id && contentLen === 0 && typeof console !== "undefined" && console.warn) {
    }

    const initialArticle = {
      ...article,
      editorRef
    };

    // Backward compatibility: If campaignSettings exists, duplicate ICP and Offer to context
    if (initialArticle.context?.campaignSettings) {
      const { campaignSettings } = initialArticle.context;
      
      // Ensure context object exists
      if (!initialArticle.context) {
        initialArticle.context = {};
      }
      
      // Duplicate ICP if it exists in campaignSettings and not already in context
      if (campaignSettings.icp && !initialArticle.context.icp) {
        initialArticle.context.icp = campaignSettings.icp;
      }
      
      // Duplicate Offer if it exists in campaignSettings and not already in context
      if (campaignSettings.offer && !initialArticle.context.offer) {
        initialArticle.context.offer = campaignSettings.offer;
      }
    }
    
    return initialArticle;
  });
  
  // Backward compatibility: Duplicate campaignSettings to context on mount
  // This ensures the duplication happens even if the article prop structure changes
  useEffect(() => {
    if (articleState.context?.campaignSettings) {
      const { campaignSettings } = articleState.context;
      
      // Only update if context.icp or context.offer don't already exist
      const needsUpdate = 
        (campaignSettings.icp && !articleState.context.icp) ||
        (campaignSettings.offer && !articleState.context.offer);
      
      if (needsUpdate) {
        setArticleState(prev => {
          // Ensure context exists
          const updatedContext = { ...(prev.context || {}) };
          
          // Preserve campaignSettings
          if (prev.context?.campaignSettings) {
            updatedContext.campaignSettings = prev.context.campaignSettings;
          }
          
          // Duplicate ICP if it exists in campaignSettings and not already in context
          if (campaignSettings.icp && !updatedContext.icp) {
            updatedContext.icp = campaignSettings.icp;
          }
          
          // Duplicate Offer if it exists in campaignSettings and not already in context
          if (campaignSettings.offer && !updatedContext.offer) {
            updatedContext.offer = campaignSettings.offer;
          }
          
          return {
            ...prev,
            context: updatedContext,
          };
        });
      }
    }
  }, []); // Run only once on mount

  // ============================================
  // Rules State - indexed by rule key
  // ============================================
  const [rulesState, setRulesState] = useState(() => {
    const initial = {};
    getAllRules().forEach(rule => {
      initial[rule.key] = {
        active: initialRuleStates[rule.key]?.active ?? true,
        executed: initialRuleStates[rule.key]?.executed ?? false,
        results: initialRuleStates[rule.key]?.results ?? null,
        error: initialRuleStates[rule.key]?.error ?? null,
        loading: initialRuleStates[rule.key]?.loading ?? false,
        ...initialRuleStates[rule.key]?.data,
      };
    });
    return initial;
  });

  // ============================================
  // UI State
  // ============================================
  const [selectedRuleKey, setSelectedRuleKey] = useState(null);
  
  // ============================================
  // Selected Elements State (shared with AI Assistant)
  // ============================================
  const [selectedElementsState, setSelectedElementsState] = useState([]);
  const setSelectedElements = useCallback((next) => {
    setSelectedElementsState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      const count = Array.isArray(value) ? value.length : 0;
      return value;
    });
  }, [articleState?.id]);
  const selectedElements = selectedElementsState;

  // ============================================
  // Article Mutations
  // ============================================
  const updateArticle = useCallback((updates) => {
    setArticleState(prev => ({
      ...prev,
      ...updates,
    }));
  }, []);

  // ============================================
  // Editor Mutations
  // ============================================
  const setEditorRef = useCallback((ref) => {
    editorRef.current = ref;
  }, [articleState?.id]);

  const setEditorContainerRef = useCallback((ref) => {
    editorContainerRef.current = ref;
  }, [articleState?.id]);

  const getEditorHtml = useCallback(() => {
    return editorRef.current?.getHtml?.() || "";
  }, []);

  const setEditorHtml = useCallback((html) => {
    if (editorRef.current?.setHtml) {
      editorRef.current.setHtml(html);
    }
  }, []);

  const getEditorElement = useCallback(() => {
    return editorRef.current;
  }, []);

  // ============================================
  // Rule State Mutations
  // ============================================
  const updateRuleState = useCallback((ruleKey, updates) => {
    setRulesState(prev => ({
      ...prev,
      [ruleKey]: {
        ...prev[ruleKey],
        ...updates,
      },
    }));
  }, []);

  const setRuleResults = useCallback((ruleKey, results, options = {}) => {
    updateRuleState(ruleKey, {
      results,
      executed: options.executed !== false,
      error: options.error || null,
      loading: false,
    });
  }, [updateRuleState]);

  const setRuleLoading = useCallback((ruleKey, loading) => {
    updateRuleState(ruleKey, { loading });
  }, [updateRuleState]);

  const setRuleError = useCallback((ruleKey, error) => {
    updateRuleState(ruleKey, { 
      error, 
      loading: false,
      executed: true,
    });
  }, [updateRuleState]);

  const toggleRuleActive = useCallback((ruleKey, active) => {
    updateRuleState(ruleKey, { active });
  }, [updateRuleState]);

  const setRuleData = useCallback((ruleKey, dataKey, value) => {
    setRulesState(prev => ({
      ...prev,
      [ruleKey]: {
        ...prev[ruleKey],
        [dataKey]: value,
      },
    }));
  }, []);

  const getRuleState = useCallback((ruleKey) => {
    return rulesState[ruleKey] || null;
  }, [rulesState]);

  // ============================================
  // UI State Mutations
  // ============================================
  const openRuleModal = useCallback((ruleKey) => {
    setSelectedRuleKey(ruleKey);
  }, []);

  const closeRuleModal = useCallback(() => {
    setSelectedRuleKey(null);
  }, []);

  // ============================================
  // Persistence
  // ============================================
  const saveContext = useCallback(async () => {
    if (!articleState.id) return;

    try {
      const { initMonkey } = await import("@/libs/monkey");
      const monkey = await initMonkey();
      await monkey.apiCall("/api/content-magic/save-context", {
        articleId: articleState.id,
        article: articleState,
        rules: rulesState,
      });
    } catch (err) {
    }
  }, [articleState, rulesState]);

  const value = useMemo(() => ({
    // Article
    article: articleState,
    updateArticle,

    // Editor
    editorRef,
    setEditorRef,
    editorContainerRef,
    setEditorContainerRef,
    getEditorHtml,
    setEditorHtml,
    getEditorElement,

    // Rules
    rules: rulesState,
    updateRuleState,
    setRuleResults,
    setRuleLoading,
    setRuleError,
    toggleRuleActive,
    setRuleData,
    getRuleState,

    // UI
    selectedRuleKey,
    openRuleModal,
    closeRuleModal,

    // Selected Elements (shared with AI Assistant)
    selectedElements,
    setSelectedElements,

    // Persistence
    saveContext,

    // Custom CSS (editor toggle; used by rule previews e.g. Edit Draft)
    customCssEnabled,
  }), [
    articleState,
    updateArticle,
    rulesState,
    selectedRuleKey,
    selectedElements,
    setSelectedElements,
    saveContext,
    customCssEnabled,
  ]);

  return (
    <WritingGuideContext.Provider value={value}>
      {children}
    </WritingGuideContext.Provider>
  );
}

export function useWritingGuide() {
  const context = useContext(WritingGuideContext);
  if (!context) {
    throw new Error("useWritingGuide must be used within WritingGuideProvider");
  }
  return context;
}