"use client";
import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, X, ArrowUp, ArrowDown, Trash2, Plus, Wand2, RefreshCw, Copy, Code } from "lucide-react";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";
import ComponentPickerModal from "./ComponentPickerModal";
import QuickActionPopupChangeTemplate from "./QuickActionPopupChangeTemplate";
import QuickActionPopupAIFill from "./QuickActionPopupAIFill";
import QuickActionPopupEditHtml from "./QuickActionPopupEditHtml";
import { initMonkey } from "@/libs/monkey";
import "@/app/(private)/content-magic/editor.css";

export default function ContentMagicQuickActions({ 
  selectedElements,
  shadowRoot,
  customCssEnabled = false,
}) {
  const { setSelectedElements: setSelectedElementsFromContext, editorContainerRef, editorRef } = useWritingGuide();

  // Debug: log when selectedElements or refs change (quick actions visibility path)
  useEffect(() => {
    const count = selectedElements?.length ?? 0;
    const hasContainer = !!editorContainerRef?.current;
    const hasEditor = !!editorRef?.current;
    const editorNode = editorRef?.current?.getEditorNode?.();
  }, [selectedElements, editorContainerRef, editorRef]);
  
  // Helper function to recursively find parent section element
  const findParentSection = (element) => {
    if (!element) return null;
    if (element.tagName === 'SECTION') return element;
    if (element.parentElement) return findParentSection(element.parentElement);
    return null;
  };

  // Calculate position relative to section and container
  const calculateSectionPosition = (sectionElement, containerRef) => {
    if (!sectionElement || !containerRef?.current) return null;
    
    const sectionRect = sectionElement.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    const scrollTop = containerRef.current.scrollTop;
    const scrollLeft = containerRef.current.scrollLeft;
    
    return {
      top: `${sectionRect.top - containerRect.top + scrollTop + 8}px`,
      right: `${containerRect.right - sectionRect.right + 8}px`,
    };
  };
  
  // Get first selected element from selectedElements (memoized)
  const firstSelectedElement = useMemo(() => {
    return selectedElements?.[0]?.element || null;
  }, [selectedElements]);

  // Target for all quick actions is the selected section (parent section of the selected element)
  const selectedSection = useMemo(() => {
    return findParentSection(firstSelectedElement) || firstSelectedElement;
  }, [firstSelectedElement]);
  
  // State for active section and position
  const [activeSection, setActiveSection] = useState(null);
  const [sectionPosition, setSectionPosition] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showComponentPicker, setShowComponentPicker] = useState(false);
  const [showAIFillDialog, setShowAIFillDialog] = useState(false);
  const [showFormatChangeModal, setShowFormatChangeModal] = useState(false);
  const [showEditHtmlPopup, setShowEditHtmlPopup] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside (use composedPath for shadow DOM)
  useEffect(() => {
    const handleClickOutside = (event) => {
      const path = event.composedPath && event.composedPath();
      const clickedInside = dropdownRef.current && (path ? path.includes(dropdownRef.current) : dropdownRef.current.contains(event.target));
      if (!clickedInside) {
        setIsOpen(false);
      }
    };

    const attachTarget = shadowRoot || document;
    if (isOpen) {
      attachTarget.addEventListener("mousedown", handleClickOutside);
      return () => attachTarget.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, shadowRoot]);

  /**
   * Notify the editor that content changed (e.g. after a quick action).
   * Uses the editor's imperative API so history/undo captures the change reliably
   * (works in both light and shadow DOM; no reliance on synthetic input events).
   */
  const notifyEditorContentChanged = () => {
    const api = editorRef?.current;
    if (api?.snapshotHistoryFromDom) {
      api.snapshotHistoryFromDom();
    } else {
      // Fallback: dispatch input on .editorContent (legacy path)
      const editorElement = selectedSection?.closest('.editorContent');
      if (editorElement) {
        editorElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      }
    }
  };

  // Handle move up action - moves the selected section
  const handleMoveUp = () => {
    if (!selectedSection || !selectedElements || selectedElements.length === 0) {
      setIsOpen(false);
      return;
    }

    const parent = selectedSection.parentElement;
    if (!parent) {
      setIsOpen(false);
      return;
    }

    const previousSibling = selectedSection.previousElementSibling;
    if (previousSibling) {
      parent.insertBefore(selectedSection, previousSibling);
      notifyEditorContentChanged();
    }
    
    setIsOpen(false);
  };

  // Handle move down action - moves the selected section
  const handleMoveDown = () => {
    if (!selectedSection || !selectedElements || selectedElements.length === 0) {
      setIsOpen(false);
      return;
    }

    const parent = selectedSection.parentElement;
    if (!parent) {
      setIsOpen(false);
      return;
    }

    const nextSibling = selectedSection.nextElementSibling;
    if (nextSibling) {
      if (nextSibling.nextSibling) {
        parent.insertBefore(selectedSection, nextSibling.nextSibling);
      } else {
        parent.appendChild(selectedSection);
      }
      notifyEditorContentChanged();
    }
    
    setIsOpen(false);
  };

  // Handle remove action - removes the selected section
  const handleRemove = () => {
    if (!selectedSection || !selectedElements || selectedElements.length === 0) {
      setIsOpen(false);
      return;
    }

    selectedSection.remove();

    // Clear selection
    if (window.getSelection) {
      const selection = window.getSelection();
      selection.removeAllRanges();
    }

    // Clear selected elements from context
    if (setSelectedElementsFromContext) {
      setSelectedElementsFromContext([]);
    }

    notifyEditorContentChanged();
    setIsOpen(false);
  };

  // Handle unfocus action - clears selection without removing elements
  const handleUnfocus = () => {
    // Clear browser selection
    if (window.getSelection) {
      const selection = window.getSelection();
      selection.removeAllRanges();
    }

    // Clear selected elements from context
    if (setSelectedElementsFromContext) {
      setSelectedElementsFromContext([]);
    }

    setIsOpen(false);
  };

  // Handle duplicate action - clones the selected section
  const handleDuplicate = () => {
    if (!selectedSection || !selectedElements || selectedElements.length === 0) {
      setIsOpen(false);
      return;
    }

    const parent = selectedSection.parentElement;
    if (!parent) {
      setIsOpen(false);
      return;
    }

    const clonedSection = selectedSection.cloneNode(true);
    clonedSection.classList.remove('selected', 'is-selected');
    const selectedInClone = clonedSection.querySelectorAll('.selected, .is-selected');
    selectedInClone.forEach(el => {
      el.classList.remove('selected', 'is-selected');
    });

    if (selectedSection.nextSibling) {
      parent.insertBefore(clonedSection, selectedSection.nextSibling);
    } else {
      parent.appendChild(clonedSection);
    }

    notifyEditorContentChanged();
    setIsOpen(false);
  };

  // Handle edit HTML action - opens HTML editor popup for the selected section
  const handleEditHtml = () => {
    if (!selectedSection || !selectedElements || selectedElements.length === 0) {
      setIsOpen(false);
      return;
    }

    setShowEditHtmlPopup(true);
    setIsOpen(false);
  };


  // Calculate position based on active section
  useEffect(() => {
    if (!selectedSection || !selectedElements || selectedElements.length === 0 || !editorContainerRef?.current) {
      setActiveSection(null);
      setSectionPosition(null);
      return;
    }

    const updatePosition = () => {
      const section = selectedSection;
      if (!section) {
        setActiveSection(null);
        setSectionPosition(null);
        return;
      }

      // Check if section is within editor
      // editorRef from context is the ref object, so we access .current to get the editor component
      const editorComponent = editorRef?.current;
      const editorNode = editorComponent?.getEditorNode?.();
      
      
      if (!editorNode || !editorNode.contains(section)) {
        setActiveSection(null);
        setSectionPosition(null);
        return;
      }

      // Check if section (or its contents) has change wrappers (AI response pending) or accept/keep buttons
      const hasChangeWrappers = selectedSection.closest('.change-wrapper') !== null;
      const hasActionButtons = selectedSection.closest('.change-from, .change-to') !== null ||
                               selectedSection.querySelector('.change-action-btn') !== null ||
                               selectedSection.closest('.change-from-content, .change-to-content') !== null;
      if (hasChangeWrappers || hasActionButtons) {
        setActiveSection(null);
        setSectionPosition(null);
        return;
      }

      // Calculate position relative to section
      const position = calculateSectionPosition(section, editorContainerRef);
      setActiveSection(section);
      setSectionPosition(position);
    };

    // Update position immediately
    updatePosition();

    // Update on scroll/resize
    const handleScroll = () => updatePosition();
    const handleResize = () => updatePosition();
    
    if (editorContainerRef.current) {
      editorContainerRef.current.addEventListener('scroll', handleScroll);
    }
    window.addEventListener('resize', handleResize);
    
    return () => {
      if (editorContainerRef.current) {
        editorContainerRef.current.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [selectedSection, selectedElements, editorContainerRef, editorRef]);

  // Add slight border to active section
  useEffect(() => {
    if (!activeSection) return;

    // Add border class to active section
    activeSection.style.border = '1px solid rgba(59, 130, 246, 0.3)';
    activeSection.style.borderRadius = '4px';

    return () => {
      // Clean up border when section changes
      if (activeSection) {
        activeSection.style.border = '';
        activeSection.style.borderRadius = '';
      }
    };
  }, [activeSection]);

  if (!selectedSection || !selectedElements || selectedElements.length === 0 || !sectionPosition || !activeSection) {
    return null;
  }
  const buttonStyle = {
    position: 'absolute',
    top: sectionPosition.top,
    right: sectionPosition.right,
    zIndex: 99999,
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        className="quick-actions-btn"
        style={buttonStyle}
        title="Quick Actions"
        contentEditable={false}
      >
        Quick Actions
        <ChevronDown className="w-3 h-3 ml-1 inline" />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="quick-actions-dropdown"
          style={{
            position: 'absolute',
            top: sectionPosition ? `calc(${sectionPosition.top} + 2.5rem)` : '2.5rem',
            right: sectionPosition?.right || '8px',
            zIndex: 100000,
            minWidth: '500px',
          }}
          contentEditable={false}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <div className="quick-actions-header">
            <span className="text-sm font-semibold">Quick Actions</span>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleUnfocus();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                className="text-xs px-2 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
                title="Unfocus - Clear selection"
              >
                Unfocus
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setIsOpen(false);
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mega Menu Grid - 2 Columns */}
          <div className="quick-actions-grid">
            {/* Column 1: Component Actions */}
            <div className="quick-actions-column">
              <div className="quick-actions-column-header">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Component</span>
              </div>
              <div className="quick-actions-column-content">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowComponentPicker(true);
                    setIsOpen(false);
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  className="quick-actions-option text-blue-600 hover:bg-blue-50"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  <span>Insert</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowFormatChangeModal(true);
                    setIsOpen(false);
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  className="quick-actions-option text-purple-600 hover:bg-purple-50"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  <span>Change Template</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleMoveUp();
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  className="quick-actions-option"
                >
                  <ArrowUp className="w-4 h-4 mr-2" />
                  <span>Move Up</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleMoveDown();
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  className="quick-actions-option"
                >
                  <ArrowDown className="w-4 h-4 mr-2" />
                  <span>Move Down</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleDuplicate();
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  className="quick-actions-option text-green-600 hover:bg-green-50"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  <span>Duplicate</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleRemove();
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  className="quick-actions-option text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  <span>Remove</span>
                </button>
              </div>
            </div>

            {/* Column 2: Content Actions */}
            <div className="quick-actions-column">
              <div className="quick-actions-column-header">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Content</span>
              </div>
              <div className="quick-actions-column-content">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowAIFillDialog(true);
                    setIsOpen(false);
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  className="quick-actions-option text-purple-600 hover:bg-purple-50"
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  <span>AI Edit</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleEditHtml();
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  className="quick-actions-option text-blue-600 hover:bg-blue-50"
                >
                  <Code className="w-4 h-4 mr-2" />
                  <span>Edit HTML</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .quick-actions-btn {
          background-color: #3b82f6;
          color: white;
          padding: 0.375rem 0.75rem;
          font-size: 0.875rem;
          font-weight: 600;
          border-radius: 0.375rem;
          cursor: pointer;
          border: none;
          display: flex;
          align-items: center;
          transition: all 0.2s;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .quick-actions-btn:hover {
          background-color: #2563eb;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
        }

        .quick-actions-dropdown {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          overflow: hidden;
        }

        .quick-actions-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #e5e7eb;
          background-color: #f9fafb;
        }

        .quick-actions-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
        }

        .quick-actions-column {
          display: flex;
          flex-direction: column;
          border-right: 1px solid #e5e7eb;
        }

        .quick-actions-column:last-child {
          border-right: none;
        }

        .quick-actions-column-header {
          padding: 0.75rem 1rem;
          background-color: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .quick-actions-column-content {
          display: flex;
          flex-direction: column;
          padding: 0.5rem 0;
          max-height: 400px;
          overflow-y: auto;
        }

        .quick-actions-option {
          padding: 0.625rem 1rem;
          text-align: left;
          border: none;
          background: white;
          cursor: pointer;
          transition: background-color 0.15s;
          font-size: 0.875rem;
          color: #374151;
          display: flex;
          align-items: center;
          width: 100%;
        }

        .quick-actions-option:hover {
          background-color: #f3f4f6;
        }

        .quick-actions-option-variant {
          padding-left: 1.75rem;
          font-size: 0.8125rem;
          color: #6b7280;
        }
      `}</style>

      {/* Component Picker Modal */}
      {showComponentPicker && (
        <ComponentPickerModal
          isOpen={showComponentPicker}
          onClose={() => setShowComponentPicker(false)}
          onInsert={(insertedElement) => {
            // Clear selection after insert
            if (setSelectedElementsFromContext) {
              setSelectedElementsFromContext([]);
            }
            // Optionally focus the new element
            if (insertedElement && window.getSelection) {
              const selection = window.getSelection();
              selection.removeAllRanges();
              const range = document.createRange();
              range.selectNodeContents(insertedElement);
              selection.addRange(range);
            }
            // Record in history so Undo works for Insert
            notifyEditorContentChanged();
          }}
          focusedSectionElement={activeSection}
        />
      )}

      {/* AI Fill Popup */}
      <QuickActionPopupAIFill
        isOpen={showAIFillDialog}
        onClose={() => setShowAIFillDialog(false)}
        selectedElement={selectedSection}
        editorShadowRoot={shadowRoot}
        customCssEnabled={customCssEnabled}
        onApply={(filledHtml, elementToReplace) => {
          const targetElement = elementToReplace || selectedSection;
          if (targetElement) {
            targetElement.outerHTML = filledHtml;
            notifyEditorContentChanged();
          }
          // Clear selection
          if (setSelectedElementsFromContext) {
            setSelectedElementsFromContext([]);
          }
        }}
      />

      {/* Change Template Popup */}
      <QuickActionPopupChangeTemplate
        isOpen={showFormatChangeModal}
        onClose={() => setShowFormatChangeModal(false)}
        selectedElement={selectedSection}
        editorShadowRoot={shadowRoot}
        customCssEnabled={customCssEnabled}
        onApply={(convertedHtml, elementToReplace) => {
          const targetElement = elementToReplace || selectedSection;
          if (targetElement) {
            targetElement.outerHTML = convertedHtml;
            notifyEditorContentChanged();
          }
          // Clear selection
          if (setSelectedElementsFromContext) {
            setSelectedElementsFromContext([]);
          }
        }}
      />

      {/* Edit HTML Popup */}
      <QuickActionPopupEditHtml
        isOpen={showEditHtmlPopup}
        onClose={() => setShowEditHtmlPopup(false)}
        selectedElement={selectedSection}
        editorShadowRoot={shadowRoot}
        customCssEnabled={customCssEnabled}
        onSave={(updatedHtml) => {
          const targetElement = selectedSection;
          if (targetElement) {
            targetElement.outerHTML = updatedHtml;
            notifyEditorContentChanged();
          }
          // Clear selection
          if (setSelectedElementsFromContext) {
            setSelectedElementsFromContext([]);
          }
        }}
      />
    </>
  );
}
