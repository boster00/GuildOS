# AI Suggestion Component - Implementation Plan

## Overview
Create a reusable `AISuggestionButton` component that handles all AI suggestion workflows across the application, replacing the current duplicated code patterns.

## Component Name
`AISuggestionButton` (or `AISuggest` for brevity)

## Props Interface

### Required Props

1. **`prompt`** (string | function)
   - The AI prompt to send
   - Can be a string or a function that returns a string (for dynamic prompts)
   - Function receives `context` object with all available context data

2. **`onSelect`** (function)
   - Callback when user selects a suggestion
   - Signature: `(suggestion: any, index: number) => void`
   - Can handle simple state updates or complex logic

### Optional Props

3. **`aiConfig`** (object)
   - `vendor`: string (default: "ChatGPT" / "openai")
   - `model`: string (default: from env or "gpt-4o")
   - `systemContext`: string (optional, for system-level instructions)

4. **`validation`** (function | object)
   - Pre-flight validation before calling AI
   - Function: `(context) => boolean | string`
     - Returns `true` if valid, or error message string if invalid
   - Object: `{ required: ['field1', 'field2'], message: 'Custom error' }`
   - If validation fails, shows alert and doesn't call AI

5. **`responseHandler`** (function)
   - Custom function to parse/transform AI response
   - Signature: `(rawResponse: any) => any[]`
   - Default: Handles JSON parsing, markdown stripping, array normalization
   - Examples:
     - ICP: Filter objects with `name` and `description`
     - Transactional facts: Convert to single string
     - Article titles: Filter strings

6. **`displayConfig`** (object)
   - `format`: 'list' | 'preformatted' | 'structured' | 'custom'
   - `renderItem`: function for custom rendering (when format is 'custom')
   - `title`: string (dropdown header, default: "AI Suggestions")
   - `emptyMessage`: string (shown when no suggestions)

7. **`buttonConfig`** (object)
   - `label`: string (default: "AI Suggest")
   - `icon`: React component (default: Sparkles)
   - `variant`: string (default: "outline")
   - `className`: string
   - `disabled`: boolean | function (can be dynamic based on context)
   - `position`: 'inline' | 'separate-row' | 'custom' (default: 'inline')

8. **`context`** (object)
   - Any data needed for prompt generation or validation
   - Passed to prompt function, validation function, and response handler
   - Example: `{ icp, offer, formData, phase, etc }`

9. **`onError`** (function)
   - Custom error handler
   - Signature: `(error: Error) => void`
   - Default: Shows alert with error message

10. **`onSuccess`** (function)
    - Called after successful AI generation
    - Signature: `(suggestions: any[]) => void`

11. **`loadingState`** (object)
    - External loading state management
    - `isGenerating`: boolean (controlled from parent)
    - `setIsGenerating`: function (if parent wants to control loading)

12. **`suggestionsState`** (object)
    - External suggestions state management
    - `suggestions`: array (controlled from parent)
    - `setSuggestions`: function (if parent wants to control suggestions)

13. **`showSuggestionsState`** (object)
    - External visibility state management
    - `showSuggestions`: boolean
    - `setShowSuggestions`: function

14. **`feedbackConfig`** (object)
    - Enable "Give feedback and try again" feature
    - `enabled`: boolean (default: false)
    - `onFeedbackSubmit`: function (optional, custom feedback handler)
    - `placeholder`: string (default: "What would you like to change or improve?")

## Internal State (if not provided externally)

- `isGenerating`: boolean
- `suggestions`: array
- `showSuggestions`: boolean
- `error`: Error | null
- `feedbackText`: string (if feedback enabled)
- `showFeedbackInput`: boolean (if feedback enabled)
- `previousSuggestions`: array (for feedback context)

## Component Structure

```jsx
<AISuggestionButton
  prompt={(context) => `Generate campaign names for ${context.offer?.name}`}
  onSelect={(suggestion) => setCampaignName(suggestion)}
  aiConfig={{
    vendor: "openai",
    model: "gpt-4o"
  }}
  validation={(context) => {
    if (!context.offer?.name) return "Please select an offer first";
    return true;
  }}
  context={{ offer, icp, formData }}
  buttonConfig={{
    label: "AI Suggest",
    position: "separate-row"
  }}
/>
```

## Response Handling Patterns

### Pattern 1: Simple String Array (Default)
```javascript
// AI returns: ["Suggestion 1", "Suggestion 2", "Suggestion 3"]
// Displayed as clickable list items
```

### Pattern 2: Object Array (ICP)
```javascript
// AI returns: [{name: "ICP 1", description: "..."}, ...]
// Custom renderItem function
responseHandler: (response) => {
  return response.filter(s => s && s.name && s.description);
}
displayConfig: {
  format: 'structured',
  renderItem: (suggestion) => (
    <div>
      <div className="font-semibold">{suggestion.name}</div>
      <div className="text-sm">{suggestion.description}</div>
    </div>
  )
}
```

### Pattern 3: Single String (Transactional Facts)
```javascript
// AI returns: "Long formatted text..."
// Displayed as preformatted text
responseHandler: (response) => {
  // Convert to single string
  return [finalString];
}
displayConfig: {
  format: 'preformatted'
}
```

### Pattern 4: Structured JSON (Article Outline)
```javascript
// AI returns: {sections: [{heading: "...", html: "..."}]}
// Custom handler converts to HTML
responseHandler: (response) => {
  // Parse and convert to HTML
  return [htmlString];
}
onSelect: (html) => {
  editorRef.current.setHtml(html);
}
```

## Validation Patterns

### Pattern 1: Simple Required Fields
```javascript
validation: {
  required: ['icp_id', 'offer_id'],
  message: "Please select ICP and Offer first"
}
```

### Pattern 2: Custom Validation Function
```javascript
validation: (context) => {
  if (context.field === 'icp' && !context.offer_id) {
    return "Please select an offer first";
  }
  if (context.field === 'transactional_facts' && 
      (!context.newOffer?.name || !context.newOffer?.description)) {
    return "Please enter offer name and description first";
  }
  return true;
}
```

## Placement Patterns

### Pattern 1: Direct State Update
```javascript
onSelect: (suggestion) => {
  setCampaignName(suggestion);
}
```

### Pattern 2: Field-Specific Logic
```javascript
onSelect: (suggestion, index) => {
  if (field === 'icp') {
    setNewIcp({ name: suggestion.name, description: suggestion.description });
  } else if (field === 'transactional_facts') {
    setNewOffer(prev => ({
      ...prev,
      transactional_facts: "⚠️ Replace...\n\n" + suggestion
    }));
  } else {
    handleChange(field, suggestion);
  }
}
```

### Pattern 3: HTML Insertion
```javascript
onSelect: (html) => {
  if (editorRef.current) {
    editorRef.current.setHtml(html);
    setArticleContent(html);
  }
}
```

## Implementation Strategy

### Phase 1: Create Component Template
1. Create `components/ui/AISuggestionButton.js`
2. Implement basic structure with required props
3. Add internal state management
4. Implement default response handling
5. Implement default UI (button + dropdown)

### Phase 2: Add Advanced Features
1. Add validation system
2. Add custom response handlers
3. Add custom display formats
4. Add feedback feature
5. Add error handling

### Phase 3: Migration
1. Replace one instance in CampaignSettings (e.g., campaign name)
2. Test thoroughly
3. Replace remaining instances one by one
4. Keep old code commented for reference
5. Remove old code after all instances migrated

### Phase 4: Documentation
1. Add JSDoc comments
2. Create usage examples
3. Document all props and patterns

## File Structure

```
components/
  ui/
    AISuggestionButton.js          # Main component
    AISuggestionButton.stories.js   # Storybook examples (optional)
libs/
  ai-suggestions/
    responseHandlers.js             # Common response handlers
    validators.js                   # Common validation functions
    displayFormats.js               # Common display format renderers
```

## Example Usage Scenarios

### Scenario 1: Simple Campaign Name
```jsx
<AISuggestionButton
  prompt={(ctx) => PROMPT_TEMPLATES.campaignName(
    ctx.offer?.name,
    ctx.offer?.description,
    ctx.icp?.name
  )}
  onSelect={(suggestion) => handleChange('name', suggestion)}
  validation={{ required: ['icp_id', 'offer_id'] }}
  context={{ offer, icp, formData }}
  aiConfig={{ model: 'gpt-4o' }}
/>
```

### Scenario 2: ICP with Object Response
```jsx
<AISuggestionButton
  prompt={(ctx) => PROMPT_TEMPLATES.icp(ctx.offer?.name, ctx.offer?.description)}
  onSelect={(suggestion) => {
    setNewIcp({ name: suggestion.name, description: suggestion.description });
  }}
  validation={(ctx) => ctx.offer_id ? true : "Please select an offer first"}
  responseHandler={(response) => response.filter(s => s?.name && s?.description)}
  displayConfig={{
    format: 'structured',
    renderItem: (s) => (
      <>
        <div className="font-semibold">{s.name}</div>
        <div className="text-sm">{s.description}</div>
      </>
    )
  }}
  context={{ offer_id: formData.offer_id, offer }}
  aiConfig={{ model: 'gpt-5.1' }}
/>
```

### Scenario 3: Transactional Facts (Preformatted)
```jsx
<AISuggestionButton
  prompt={(ctx) => PROMPT_TEMPLATES.transactionalFacts(
    ctx.newOffer?.name,
    ctx.newOffer?.description
  )}
  onSelect={(suggestion) => {
    setNewOffer(prev => ({
      ...prev,
      transactional_facts: "⚠️ Replace...\n\n" + suggestion
    }));
  }}
  validation={(ctx) => {
    if (!ctx.newOffer?.name || !ctx.newOffer?.description) {
      return "Please enter offer name and description first";
    }
    return true;
  }}
  responseHandler={(response) => {
    // Convert to single string
    const final = Array.isArray(response) && response.length === 1
      ? response[0]
      : response.join('\n\n---\n\n');
    return [final];
  }}
  displayConfig={{ format: 'preformatted' }}
  context={{ newOffer }}
  aiConfig={{ model: 'gpt-4o' }}
/>
```

## Open Questions / Decisions Needed

1. **Component Library**: Should this be in `components/ui/` or `components/ai/`?
2. **State Management**: Should we always use internal state, or always require external state?
3. **Styling**: Use DaisyUI components or custom styled?
4. **Feedback Feature**: Should this be built-in or a separate component?
5. **Error Handling**: Toast notifications vs alerts vs custom handler?
6. **Loading States**: Should button show loading spinner, or separate loading indicator?
7. **Accessibility**: What ARIA labels and keyboard navigation needed?

## Next Steps

1. Review this plan with team
2. Decide on open questions
3. Create component skeleton
4. Implement one use case end-to-end
5. Test and refine
6. Migrate remaining instances

