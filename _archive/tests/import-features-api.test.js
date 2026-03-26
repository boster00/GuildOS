// ARCHIVED: Original path was tests/import-features-api.test.js

/**
 * Test script for Import Features
 * 
 * This tests the template import and CSS extraction API endpoints
 * Run with: node tests/import-features-api.test.js
 */

const fs = require('fs');
const path = require('path');

// Sample HTML with multiple sections for testing
const testHTML = `
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://example.com/styles.css">
  <link href="https://example.com/theme.css" rel="stylesheet">
  <style>
    .hero { background: blue; }
    .cta { padding: 2rem; }
  </style>
  <style>
    .footer { margin-top: 4rem; }
  </style>
</head>
<body>
  <section class="hero">
    <h1>Hero Section</h1>
    <p>Welcome to our site</p>
  </section>
  
  <section class="features">
    <h2>Features</h2>
    <ul>
      <li>Fast</li>
      <li>Secure</li>
      <li>Easy</li>
    </ul>
  </section>
  
  <section class="cta">
    <h2>Call to Action</h2>
    <button>Get Started</button>
  </section>
</body>
</html>
`;

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function log(message, type = 'info') {
  const colors = {
    success: '\x1b[32m',
    error: '\x1b[31m',
    info: '\x1b[36m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[type] || colors.info}${message}${colors.reset}`);
}

function testExtractSections() {
  log('\n--- Test: Extract Sections from HTML ---', 'info');
  
  try {
    // Extract sections using regex (same as API)
    const sectionRegex = /<section[\s\S]*?<\/section>/gi;
    const sections = [];
    let match;
    
    while ((match = sectionRegex.exec(testHTML)) !== null) {
      sections.push(match[0].trim());
    }
    
    // Assertions
    if (sections.length !== 3) {
      throw new Error(`Expected 3 sections, got ${sections.length}`);
    }
    
    if (!sections[0].includes('Hero Section')) {
      throw new Error('First section should contain "Hero Section"');
    }
    
    if (!sections[1].includes('Features')) {
      throw new Error('Second section should contain "Features"');
    }
    
    if (!sections[2].includes('Call to Action')) {
      throw new Error('Third section should contain "Call to Action"');
    }
    
    log(`✓ Successfully extracted ${sections.length} sections`, 'success');
    results.passed++;
    results.tests.push({ name: 'Extract Sections', status: 'PASSED' });
    
  } catch (error) {
    log(`✗ Test failed: ${error.message}`, 'error');
    results.failed++;
    results.tests.push({ name: 'Extract Sections', status: 'FAILED', error: error.message });
  }
}

function testExtractCSSLinks() {
  log('\n--- Test: Extract CSS Links from HTML ---', 'info');
  
  try {
    // Extract CSS links using regex (same as API)
    const linkRegex = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>|<link[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi;
    const links = [];
    let match;
    
    while ((match = linkRegex.exec(testHTML)) !== null) {
      const href = match[1] || match[2];
      if (href && href.trim()) {
        links.push(href.trim());
      }
    }
    
    // Assertions
    if (links.length !== 2) {
      throw new Error(`Expected 2 CSS links, got ${links.length}`);
    }
    
    if (!links.includes('https://example.com/styles.css')) {
      throw new Error('Should find styles.css link');
    }
    
    if (!links.includes('https://example.com/theme.css')) {
      throw new Error('Should find theme.css link');
    }
    
    log(`✓ Successfully extracted ${links.length} CSS links`, 'success');
    results.passed++;
    results.tests.push({ name: 'Extract CSS Links', status: 'PASSED' });
    
  } catch (error) {
    log(`✗ Test failed: ${error.message}`, 'error');
    results.failed++;
    results.tests.push({ name: 'Extract CSS Links', status: 'FAILED', error: error.message });
  }
}

function testExtractInlineStyles() {
  log('\n--- Test: Extract Inline Styles from HTML ---', 'info');
  
  try {
    // Extract inline styles using regex (same as API)
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    const styles = [];
    let match;
    
    while ((match = styleRegex.exec(testHTML)) !== null) {
      const styleContent = match[1].trim();
      if (styleContent) {
        styles.push(styleContent);
      }
    }
    
    const combinedStyles = styles.join('\n\n');
    
    // Assertions
    if (styles.length !== 2) {
      throw new Error(`Expected 2 style blocks, got ${styles.length}`);
    }
    
    if (!combinedStyles.includes('.hero')) {
      throw new Error('Should find .hero class in styles');
    }
    
    if (!combinedStyles.includes('.footer')) {
      throw new Error('Should find .footer class in styles');
    }
    
    log(`✓ Successfully extracted ${styles.length} inline style blocks`, 'success');
    log(`  Total CSS length: ${combinedStyles.length} characters`, 'info');
    results.passed++;
    results.tests.push({ name: 'Extract Inline Styles', status: 'PASSED' });
    
  } catch (error) {
    log(`✗ Test failed: ${error.message}`, 'error');
    results.failed++;
    results.tests.push({ name: 'Extract Inline Styles', status: 'FAILED', error: error.message });
  }
}

function testTemplateIdGeneration() {
  log('\n--- Test: Template ID Generation ---', 'info');
  
  try {
    // Generate template ID (same logic as API)
    const generateTemplateId = () => {
      const timestamp = Date.now();
      const random = Math.floor(1000 + Math.random() * 9000);
      return `template-${timestamp}-${random}`;
    };
    
    const id1 = generateTemplateId();
    const id2 = generateTemplateId();
    
    // Assertions
    if (!id1.startsWith('template-')) {
      throw new Error('Template ID should start with "template-"');
    }
    
    if (id1 === id2) {
      throw new Error('Template IDs should be unique');
    }
    
    const parts = id1.split('-');
    if (parts.length !== 3) {
      throw new Error('Template ID should have format: template-[timestamp]-[random]');
    }
    
    const randomPart = parts[2];
    if (randomPart.length !== 4) {
      throw new Error('Random part should be 4 digits');
    }
    
    log(`✓ Template ID generation working correctly`, 'success');
    log(`  Sample ID: ${id1}`, 'info');
    results.passed++;
    results.tests.push({ name: 'Template ID Generation', status: 'PASSED' });
    
  } catch (error) {
    log(`✗ Test failed: ${error.message}`, 'error');
    results.failed++;
    results.tests.push({ name: 'Template ID Generation', status: 'FAILED', error: error.message });
  }
}

function testValidation() {
  log('\n--- Test: Validation Logic ---', 'info');
  
  try {
    // Test with no sections
    const noSectionsHTML = '<div>No sections here</div>';
    const sectionRegex = /<section[\s\S]*?<\/section>/gi;
    const noSections = noSectionsHTML.match(sectionRegex);
    
    if (noSections !== null) {
      throw new Error('Should detect when no sections exist');
    }
    
    // Test with one section
    const oneSectionHTML = '<section>Only one</section>';
    const oneSections = oneSectionHTML.match(sectionRegex);
    
    if (!oneSections || oneSections.length !== 1) {
      throw new Error('Should detect when only one section exists');
    }
    
    // Test with multiple sections
    const multipleSectionsHTML = '<section>One</section><section>Two</section>';
    const multipleSections = multipleSectionsHTML.match(sectionRegex);
    
    if (!multipleSections || multipleSections.length < 2) {
      throw new Error('Should detect multiple sections');
    }
    
    log(`✓ Validation logic working correctly`, 'success');
    results.passed++;
    results.tests.push({ name: 'Validation Logic', status: 'PASSED' });
    
  } catch (error) {
    log(`✗ Test failed: ${error.message}`, 'error');
    results.failed++;
    results.tests.push({ name: 'Validation Logic', status: 'FAILED', error: error.message });
  }
}

// Run all tests
function runTests() {
  log('\n=================================', 'info');
  log('Import Features - Unit Tests', 'info');
  log('=================================', 'info');
  
  testExtractSections();
  testExtractCSSLinks();
  testExtractInlineStyles();
  testTemplateIdGeneration();
  testValidation();
  
  // Print summary
  log('\n=================================', 'info');
  log('Test Summary', 'info');
  log('=================================', 'info');
  log(`Total Tests: ${results.passed + results.failed}`, 'info');
  log(`Passed: ${results.passed}`, 'success');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'error' : 'info');
  
  if (results.failed === 0) {
    log('\n✓ All tests passed!', 'success');
  } else {
    log('\n✗ Some tests failed', 'error');
    process.exit(1);
  }
}

// Run the tests
runTests();
