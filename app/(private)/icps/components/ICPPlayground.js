"use client";

import { useState } from 'react';
import { initICP } from '@/libs/icp/class';
import styles from './ICPPlayground.module.css';
import monkey  from '@/libs/monkey';


export default function ICPPlayground() {


  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});
  const [testData, setTestData] = useState({
    name: "Test ICP " + Date.now(),
    short_desc: "Test description for manual testing",
    icp_desc: "Detailed test description for ICP validation",
    company_help: "We help test companies with testing solutions"
  });
  const [testId, setTestId] = useState('');
  const [searchQuery, setSearchQuery] = useState('test');
  const [bulkIds, setBulkIds] = useState('');

  const logResult = (testName, success, data, error) => {
    const timestamp = new Date().toLocaleTimeString();
    setResults(prev => ({
      ...prev,
      [testName]: {
        success,
        data,
        error,
        timestamp
      }
    }));
  };

  const runTest = async (testName, testFn) => {
    setLoading(prev => ({ ...prev, [testName]: true }));
    try {
      const result = await testFn();
      logResult(testName, true, result, null);
    } catch (error) {
      logResult(testName, false, null, error.message);
    }
    setLoading(prev => ({ ...prev, [testName]: false }));
  };

  // ================================
  // CORE CRUD TESTS
  // ================================
  
  const testCreate = () => runTest('create', async () => {
    const icp = await initICP(monkey);
    return await icp.create(testData);
  });

  const testGet = () => runTest('get', async () => {
    if (!testId) throw new Error('Please enter an ICP ID first');
    const icp = await initICP(monkey);
    return await icp.get(testId);
  });

  const testList = () => runTest('list', async () => {
    const icp = await initICP(monkey);
    return await icp.list();
  });

  const testUpdate = () => runTest('update', async () => {
    if (!testId) throw new Error('Please enter an ICP ID first');
    const icp = await initICP(monkey);
    return await icp.update(testId, {
      name: testData.name + " (Updated)",
      short_desc: testData.short_desc + " - Updated"
    });
  });

  const testDelete = () => runTest('delete', async () => {
    if (!testId) throw new Error('Please enter an ICP ID first');
    const icp = await initICP(monkey);
    return await icp.delete(testId);
  });

  
  // ================================
  // AI Test
  // ================================
  const testAI = () => runTest('AI', async () => {
    // Use fetch directly to match API expectations
    const url = "/api/ai";
    const query = "tell a cat joke";
    const icp = await initICP(monkey);

    const response = await icp.AI(query);
    return response;
  });

  // ================================
  // STATUS & SEARCH TESTS
  // ================================

  const testActivate = () => runTest('activate', async () => {
    if (!testId) throw new Error('Please enter an ICP ID first');
    const icp = await initICP(monkey);
    return await icp.activate(testId);
  });

  const testDeactivate = () => runTest('deactivate', async () => {
    if (!testId) throw new Error('Please enter an ICP ID first');
    const icp = await initICP(monkey);
    return await icp.deactivate(testId);
  });

  const testSearch = () => runTest('search', async () => {
    const icp = await initICP(monkey);
    return await icp.search(searchQuery);
  });

  const testFilterByStatus = () => runTest('filterByStatus', async () => {
    const icp = await initICP(monkey);
    return await icp.filterByStatus('active');
  });

  const testGetActive = () => runTest('getActive', async () => {
    const icp = await initICP(monkey);
    return await icp.getActive();
  });

  // ================================
  // ENHANCED FEATURES TESTS
  // ================================

  const testClone = () => runTest('clone', async () => {
    if (!testId) throw new Error('Please enter an ICP ID first');
    const icp = await initICP(monkey);
    return await icp.clone(testId, "Cloned ICP " + Date.now());
  });

  const testGetStats = () => runTest('getStats', async () => {
    if (!testId) throw new Error('Please enter an ICP ID first');
    const icp = await initICP(monkey);
    return await icp.getStats(testId);
  });

  const testExport = () => runTest('export', async () => {
    if (!testId) throw new Error('Please enter an ICP ID first');
    const icp = await initICP(monkey);
    return await icp.export(testId);
  });

  const testValidate = () => runTest('validate', async () => {
    const icp = await initICP(monkey);
    return await icp.validate(testData);
  });

  const testGetTemplates = () => runTest('getTemplates', async () => {
    const icp = await initICP(monkey);
    return await icp.getTemplates();
  });

  const testCreateFromTemplate = () => runTest('createFromTemplate', async () => {
    const icp = await initICP(monkey);
    return await icp.createFromTemplate('enterprise');
  });

  // ================================
  // UTILITY FUNCTIONS
  // ================================

  const clearResults = () => setResults({});

  const updateTestData = (field, value) => {
    setTestData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.playgroundHeader}>
        <h1 className={styles.pageTitle}>🧪 ICP Backend Function Testing</h1>
        <p className={styles.pageSubtitle}>Manual testing interface for all ICP class methods</p>
        <button onClick={clearResults} className={styles.clearButton}>
          Clear Results
        </button>
      </div>

      <div className={styles.playgroundContent}>
        {/* Test Data Configuration */}
        <div className={styles.configSection}>
          <h2>Test Data Configuration</h2>
          <div className={styles.configGrid}>
            <div className={styles.configField}>
              <label>Name:</label>
              <input
                type="text"
                value={testData.name}
                onChange={(e) => updateTestData('name', e.target.value)}
                className={styles.configInput}
              />
            </div>
            <div className={styles.configField}>
              <label>Short Description:</label>
              <input
                type="text"
                value={testData.short_desc}
                onChange={(e) => updateTestData('short_desc', e.target.value)}
                className={styles.configInput}
              />
            </div>
            <div className={styles.configField}>
              <label>ICP ID (for get/update/delete):</label>
              <input
                type="text"
                value={testId}
                onChange={(e) => setTestId(e.target.value)}
                placeholder="Enter ICP ID from create result"
                className={styles.configInput}
              />
            </div>
            <div className={styles.configField}>
              <label>Search Query:</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.configInput}
              />
            </div>
            <div className={styles.configField}>
              <label>Bulk IDs (comma-separated):</label>
              <input
                type="text"
                value={bulkIds}
                onChange={(e) => setBulkIds(e.target.value)}
                placeholder="id1,id2,id3"
                className={styles.configInput}
              />
            </div>
          </div>
        </div>

        {/* Test Functions */}
        <div className={styles.testSections}>
          {/* Core CRUD */}
          <div className={styles.testSection}>
            <h3>🔧 Core CRUD Operations</h3>
            <div className={styles.testGrid}>
              <button onClick={testCreate} disabled={loading.create} className={styles.testButton}>
                {loading.create ? '⏳' : '➕'} Create ICP
              </button>
              <button onClick={testGet} disabled={loading.get} className={styles.testButton}>
                {loading.get ? '⏳' : '👁️'} Get ICP
              </button>
              <button onClick={testList} disabled={loading.list} className={styles.testButton}>
                {loading.list ? '⏳' : '📋'} List ICPs
              </button>
              <button onClick={testUpdate} disabled={loading.update} className={styles.testButton}>
                {loading.update ? '⏳' : '✏️'} Update ICP
              </button>
              <button onClick={testDelete} disabled={loading.delete} className={styles.testButton}>
                {loading.delete ? '⏳' : '🗑️'} Delete ICP
              </button>
            </div>
          </div>

          {/* Status & Search */}
          <div className={styles.testSection}>
            <h3>🔍 Status & Search Operations</h3>
            <div className={styles.testGrid}>
              <button onClick={testActivate} disabled={loading.activate} className={styles.testButton}>
                {loading.activate ? '⏳' : '✅'} Activate
              </button>
              <button onClick={testDeactivate} disabled={loading.deactivate} className={styles.testButton}>
                {loading.deactivate ? '⏳' : '❌'} Deactivate
              </button>
              <button onClick={testSearch} disabled={loading.search} className={styles.testButton}>
                {loading.search ? '⏳' : '🔍'} Search
              </button>
              <button onClick={testFilterByStatus} disabled={loading.filterByStatus} className={styles.testButton}>
                {loading.filterByStatus ? '⏳' : '🔽'} Filter Active
              </button>
              <button onClick={testGetActive} disabled={loading.getActive} className={styles.testButton}>
                {loading.getActive ? '⏳' : '🎯'} Get Active
              </button>
            </div>
          </div>

          {/* Enhanced Features */}
          <div className={styles.testSection}>
            <h3>⭐ Enhanced Features</h3>
            <div className={styles.testGrid}>
              <button onClick={testClone} disabled={loading.clone} className={styles.testButton}>
                {loading.clone ? '⏳' : '📋'} Clone ICP
              </button>
              <button onClick={testGetStats} disabled={loading.getStats} className={styles.testButton}>
                {loading.getStats ? '⏳' : '📊'} Get Stats
              </button>
              <button onClick={testExport} disabled={loading.export} className={styles.testButton}>
                {loading.export ? '⏳' : '📤'} Export
              </button>
              <button onClick={testValidate} disabled={loading.validate} className={styles.testButton}>
                {loading.validate ? '⏳' : '✔️'} Validate
              </button>
            </div>
          </div>

          {/* Templates */}
          <div className={styles.testSection}>
            <h3>📋 Template Operations</h3>
            <div className={styles.testGrid}>
              <button onClick={testGetTemplates} disabled={loading.getTemplates} className={styles.testButton}>
                {loading.getTemplates ? '⏳' : '📝'} Get Templates
              </button>
              <button onClick={testCreateFromTemplate} disabled={loading.createFromTemplate} className={styles.testButton}>
                {loading.createFromTemplate ? '⏳' : '🏢'} Create Enterprise
              </button>
            </div>
          </div>
          
          <div className={styles.testSection}>
            <h3>🤖 AI Function</h3>
            <div className={styles.testGrid}>
              <button onClick={testAI} disabled={loading.AI} className={styles.testButton}>
                {loading.AI ? '⏳' : '🤖'} Test ICP.AI()
              </button>
            </div>
          </div>
        </div>

        {/* Results Area */}
        <div className={styles.resultsSection}>
          <h2>📊 Test Results</h2>
          <div className={styles.resultsContainer}>
            {Object.keys(results).length === 0 ? (
              <p className={styles.noResults}>No tests run yet. Click any test button above.</p>
            ) : (
              Object.entries(results).map(([testName, result]) => (
                <div
                  key={testName}
                  className={`${styles.resultItem} ${result.success ? styles.success : styles.error}`}
                >
                  <div className={styles.resultHeader}>
                    <span className={styles.resultIcon}>
                      {result.success ? '✅' : '❌'}
                    </span>
                    <span className={styles.resultName}>{testName}</span>
                    <span className={styles.resultTime}>{result.timestamp}</span>
                  </div>
                  
                  {result.success ? (
                    <div className={styles.resultData}>
                      <strong>Success:</strong>
                      <pre className={styles.resultPre}>
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div className={styles.resultError}>
                      <strong>Error:</strong> {result.error}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}