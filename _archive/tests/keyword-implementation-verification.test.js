// ARCHIVED: Original path was tests/keyword-implementation-verification.test.js

/**
 * Test suite for keyword implementation verification and retry logic
 * 
 * This tests the new from/to format with verification and retry functionality
 */

// Mock stripHtml function
function stripHtml(html) {
  if (!html) return '';
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

// Verification function (copy from batch route)
function verifyKeywordSuggestions(articleHtml, keywordSuggestions) {
  const articleText = stripHtml(articleHtml);
  let workingText = articleText;
  
  const results = {
    verified: [],
    failed: []
  };
  
  keywordSuggestions.forEach(sugg => {
    const keyword = sugg.keyword;
    const keywordId = sugg.keywordId;
    
    if (!sugg.suggestions || !Array.isArray(sugg.suggestions)) {
      return;
    }
    
    sugg.suggestions.forEach((s, idx) => {
      if (!s.from || !s.to) {
        results.failed.push({
          keywordId,
          keyword,
          suggestionIndex: idx,
          from: s.from || '',
          to: s.to || '',
          reason: "missing from or to string"
        });
        return;
      }
      
      const found = workingText.includes(s.from);
      
      if (!found) {
        const inOriginal = articleText.includes(s.from);
        const reason = inOriginal 
          ? "overlaps with previous suggestion or was already replaced"
          : "from string not found in article";
          
        results.failed.push({
          keywordId,
          keyword,
          suggestionIndex: idx,
          from: s.from,
          to: s.to,
          reason
        });
      } else {
        results.verified.push({
          keywordId,
          keyword,
          from: s.from,
          to: s.to
        });
        
        workingText = workingText.replace(s.from, s.to);
      }
    });
  });
  
  return results;
}

// Test cases
console.log('=== Keyword Implementation Verification Tests ===\n');

// Test 1: Valid suggestions that should pass
console.log('Test 1: Valid suggestions that exist in article');
const articleHtml1 = `
  <p>We provide comprehensive testing solutions for researchers.</p>
  <p>Our laboratory offers quality analysis services.</p>
  <p>Contact us for all your research needs.</p>
`;

const suggestions1 = [{
  keywordId: 'kw-1',
  keyword: 'ELISA services',
  suggestions: [
    { from: 'testing solutions', to: 'ELISA services' },
    { from: 'quality analysis services', to: 'quality ELISA services' }
  ]
}];

const result1 = verifyKeywordSuggestions(articleHtml1, suggestions1);
console.log('Verified:', result1.verified.length, '(expected 2)');
console.log('Failed:', result1.failed.length, '(expected 0)');
console.log('Status:', result1.verified.length === 2 && result1.failed.length === 0 ? '✓ PASS' : '✗ FAIL');
console.log('');

// Test 2: Non-existent from string should fail
console.log('Test 2: Non-existent from string');
const suggestions2 = [{
  keywordId: 'kw-2',
  keyword: 'antibodies',
  suggestions: [
    { from: 'this text does not exist', to: 'antibodies this text does not exist' }
  ]
}];

const result2 = verifyKeywordSuggestions(articleHtml1, suggestions2);
console.log('Verified:', result2.verified.length, '(expected 0)');
console.log('Failed:', result2.failed.length, '(expected 1)');
console.log('Failure reason:', result2.failed[0]?.reason);
console.log('Status:', result2.verified.length === 0 && result2.failed.length === 1 ? '✓ PASS' : '✗ FAIL');
console.log('');

// Test 3: Overlapping suggestions (same from string used twice)
console.log('Test 3: Overlapping suggestions');
const suggestions3 = [{
  keywordId: 'kw-3',
  keyword: 'peptide synthesis',
  suggestions: [
    { from: 'testing solutions', to: 'peptide synthesis solutions' },
    { from: 'testing solutions', to: 'peptide synthesis testing solutions' } // Same from string
  ]
}];

const result3 = verifyKeywordSuggestions(articleHtml1, suggestions3);
console.log('Verified:', result3.verified.length, '(expected 1 - first one succeeds)');
console.log('Failed:', result3.failed.length, '(expected 1 - second one fails because first replaced it)');
console.log('Failure reason:', result3.failed[0]?.reason);
console.log('Status:', result3.verified.length === 1 && result3.failed.length === 1 ? '✓ PASS' : '✗ FAIL');
console.log('');

// Test 4: HTML stripping works correctly
console.log('Test 4: HTML stripping');
const articleHtml4 = '<p><strong>Our laboratory</strong> offers <em>premium services</em> for researchers.</p>';
const suggestions4 = [{
  keywordId: 'kw-4',
  keyword: 'ELISA',
  suggestions: [
    { from: 'premium services', to: 'premium ELISA services' } // Text without HTML tags
  ]
}];

const result4 = verifyKeywordSuggestions(articleHtml4, suggestions4);
console.log('Verified:', result4.verified.length, '(expected 1)');
console.log('Failed:', result4.failed.length, '(expected 0)');
console.log('Status:', result4.verified.length === 1 && result4.failed.length === 0 ? '✓ PASS' : '✗ FAIL');
console.log('');

// Test 5: Missing from or to should fail
console.log('Test 5: Missing from or to fields');
const suggestions5 = [{
  keywordId: 'kw-5',
  keyword: 'assays',
  suggestions: [
    { from: 'testing', to: '' }, // Empty to
    { from: '', to: 'assays testing' }, // Empty from
    { to: 'only to field' } // Missing from
  ]
}];

const result5 = verifyKeywordSuggestions(articleHtml1, suggestions5);
console.log('Verified:', result5.verified.length, '(expected 0)');
console.log('Failed:', result5.failed.length, '(expected 3)');
console.log('Status:', result5.verified.length === 0 && result5.failed.length === 3 ? '✓ PASS' : '✗ FAIL');
console.log('');

// Test 6: Multiple keywords with well-spaced suggestions
console.log('Test 6: Multiple keywords');
const articleHtml6 = `
  <h2>Introduction</h2>
  <p>We provide comprehensive testing solutions.</p>
  <h2>Services</h2>
  <p>Our laboratory offers quality analysis.</p>
  <h2>Conclusion</h2>
  <p>Contact us for research support.</p>
`;

const suggestions6 = [
  {
    keywordId: 'kw-6a',
    keyword: 'ELISA services',
    suggestions: [
      { from: 'testing solutions', to: 'ELISA services' }
    ]
  },
  {
    keywordId: 'kw-6b',
    keyword: 'antibody production',
    suggestions: [
      { from: 'quality analysis', to: 'quality antibody production analysis' }
    ]
  }
];

const result6 = verifyKeywordSuggestions(articleHtml6, suggestions6);
console.log('Verified:', result6.verified.length, '(expected 2)');
console.log('Failed:', result6.failed.length, '(expected 0)');
console.log('Status:', result6.verified.length === 2 && result6.failed.length === 0 ? '✓ PASS' : '✗ FAIL');
console.log('');

// Summary
console.log('=== Test Summary ===');
const allTests = [result1, result2, result3, result4, result5, result6];
const passedTests = [
  result1.verified.length === 2 && result1.failed.length === 0,
  result2.verified.length === 0 && result2.failed.length === 1,
  result3.verified.length === 1 && result3.failed.length === 1,
  result4.verified.length === 1 && result4.failed.length === 0,
  result5.verified.length === 0 && result5.failed.length === 3,
  result6.verified.length === 2 && result6.failed.length === 0,
].filter(Boolean).length;

console.log(`Tests passed: ${passedTests}/6`);
console.log(passedTests === 6 ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED');
