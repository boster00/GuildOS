// Right way to use: 
// import { initMonkey } from "@/libs/monkey";
// ...
// const monkey = await initMonkey();
// const user = await monkey.initUser();

// this file defines the main object specific to this application. It has the following responsibilities:
// 1. database read write delete update etc. (direct Supabase when available, API fallback)
// 2. client-side methods for UI interactions (apiCall, cjbutton, state management)

// NOTE: This file tries to use direct Supabase calls when on server-side (when this.supabase is initialized).
// Falls back to /api/database endpoint when this.supabase is null (client-side or initialization failed). 

import { rewriteDraftCssForShadowRoot } from '@/libs/content-magic/utils/rewriteDraftCssForShadow';
import { ArticleAssetManager } from './monkey/article-assets.js';
import {
  checkQuota,
  logUsage,
  deductCredits,
  calculateCredits,
  estimateCredits,
  METERING_CODE_QUOTA_EXCEEDED,
} from './monkey/tools/metering.js';
import { getCostByPath, normalizePath } from './monkey/tools/metering_costs.js';
import { triggerOutOfCreditsBanner } from './outOfCredits.js';
// Single import of subscription tiers; tier APIs are re-exported below and passed via metering adapter
import {
  getTierById as _getTierById,
  getTierIdByPriceId as _getTierIdByPriceId,
  getAllTiers as _getAllTiers,
  DEFAULT_MONTHLY_CREDITS as _DEFAULT_MONTHLY_CREDITS,
} from './monkey/registry/subscriptionTiers.js';

/** Returns a valid UUID v4 string (for metering idempotency keys). Prefers crypto.randomUUID; fallback for older envs. */
function randomIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const hex = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) s += "-";
    else if (i === 14) s += "4";
    else if (i === 19) s += hex[8 + ((Math.random() * 4) | 0)];
    else s += hex[(Math.random() * 16) | 0];
  }
  return s;
}

const FONT_CDN_WHITELIST = [
  'use.fontawesome.com',
  'kit.fontawesome.com',
  'cdn.fontawesome.com',
  'pro.fontawesome.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'use.typekit.net',
  'p.typekit.net',
  'fonts.bunny.net',
  'rsms.me',
  'fonts.cdnfonts.com',
];

class Monkey {
  constructor() {
    const rawSiteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.NODE_ENV === "development"
        ? `http://localhost:${process.env.PORT || 3000}`
        : null);
    this.siteUrl = rawSiteUrl ? rawSiteUrl.replace(/\/+$/, "") : null;
    this.user = null;
    this.planContext = null;
    this.isServiceMode = false;
    this.isClient = typeof window !== 'undefined';
    this.isServer = !this.isClient;
    this.supabase = null; // Will be initialized on server-side if possible
    this.log = [];
    this.consoleLogOff = false;
    this.monkeyLog = [];
    
    // Request cache for read operations (prevents duplicate API calls)
    this.readCache = new Map();
    this.CACHE_TTL = 2000; // 2 seconds
    
    // Last credits consumed (for methods that return simple values)
    this.lastCredits = 0;
    
    // API markups for credit calculation (0 = no markup, 1 = 100% markup)
    // Set manually in code as needed
    this.markups = {
      openai_text: 0,        // GPT-4o, GPT-4o-mini, etc.
      openai_image: 0,       // DALL-E 3, gpt-image models
      openai_embedding: 0,   // text-embedding-3-small, etc.
      tavily_search: 0,      // Tavily search API
      tavily_extract: 0,     // Tavily extract API
      dataforseo: 0,         // DataForSEO SERP API
      v0: 0,                 // v0.dev API
      runtime: 0,            // Runtime provider calls (callChat, callStructured, etc.)
    };
    this.log = (...msgs) => {
      // Only log if in DEV environment
      if (process.env.NODE_ENV === 'development') {
        // Convert each message to string to avoid circular references
        this.monkeyLog.push(...msgs.map(msg => {
          if (typeof msg === 'object') {
            try {
              return JSON.stringify(msg);
            } catch (e) {
              return String(msg);
            }
          }
          return String(msg);
        }));
        // Centralized console.log - only place console.log appears in monkey.js

      }
      return this.monkeyLog;
    }
    
    // Client-side state management
    this.states = {};
    this.callbacks = {};
    
    // Article asset management (centralized)
    this.articleAssets = new ArticleAssetManager(this);

    // Master of Coins — single authority for subscription credit economy (only import site)
    this.masterOfCoins = require('./monkey/masterOfCoins/index.js');

    // Diagnostic logging (server-only, lazy-loaded); client gets no-op stub
    const diagStub = {
      enabled: () => false,
      log: () => {},
      flush: async () => {},
      cleanup: async () => {},
      sanitize: (o) => o,
      genRequestId: () => '',
      queryLogs: async () => ({ rows: [] }),
    };
    if (this.isClient) {
      this.diag = diagStub;
    } else {
      this._diagCache = null;
      Object.defineProperty(this, 'diag', {
        get() {
          if (this._diagCache) return this._diagCache;
          const { createDiag } = require('./monkey/tools/diagLogger.server.js');
          this._diagCache = createDiag(this);
          return this._diagCache;
        },
        configurable: true,
        enumerable: true,
      });
    }
    
    // Bind methods
    this.cjbutton = this.cjbutton.bind(this);
    this.apiCall = this.apiCall.bind(this);
  }

  
  async init(fullInitMode = false) {
    // Try to initialize Supabase on server-side (when available and not already set)
    // Falls back to API calls if initialization fails or on client-side
    // IMPORTANT: Next.js statically analyzes ALL imports, even dynamic ones
    // We avoid initializing Supabase in monkey.js to prevent static analysis errors
    // Instead, Supabase is initialized in API routes or server components only
    // This file always uses API fallback to avoid import issues
    if (!this.supabase && typeof window === 'undefined') {
      // Server-side: Skip direct Supabase initialization to avoid Next.js import analysis
      // Always use API fallback to prevent static analysis issues
      // Supabase can be set directly in API routes if needed (see app/api/monkey/route.js)
      this.supabase = null;
      if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
        this.log('Using API fallback for Supabase (avoiding static import analysis)');
      }
    } else {
      // Client-side: Supabase will remain null, use API calls
      this.supabase = null;
    }
    
    if (fullInitMode && this.isClient) {
      await this.initUser();
    }
    return true;
  }

  async initUser() {
    if (!this.user) {
      // Try direct Supabase call first
      if (this.supabase) {
        try {
          const { data: { user } } = await this.supabase.auth.getUser();
          this.user = user;
        } catch (error) {
          this.log('Direct Supabase getUser failed, falling back to API:', error.message);
          // Fall through to API call
        }
      }
      
      // Fallback to API endpoint if Supabase not available or failed
      if (!this.user) {
        try {
          const response = await this.apiCall(this.siteUrl + '/api/database', {
            action: 'getUser'
          });
          const result = JSON.parse(response);
          if (result.success) {
            this.user = result.result;
          } else {
            this.user = null;
          }
        } catch (error) {
          this.log('Failed to get user via API:', error.message);
          this.user = null;
        }
      }
    }
    
    // User API keys are no longer used - using centralized API keys instead
    // Users are charged for API usage, not required to provide their own keys
    this.user = this.user || {};
    this.user.APIKeys = [];
    
    // Add environment API keys if available (for service mode)
    if (process.env.CHATGPT_API_KEY) {
      this.user.APIKeys.push({
        id: 'env-chatgpt',
        provider: 'openai',
          vendor: 'ChatGPT',
          key: process.env.CHATGPT_API_KEY,
          api_key_encrypted: process.env.CHATGPT_API_KEY,
          api_key_name: 'Environment ChatGPT Key',
          is_active: true,
          source: 'environment'
        });
      }
      
      if (process.env.PERPLEXITY_API_KEY) {
        this.user.APIKeys.push({
          id: 'env-perplexity',
          provider: 'perplexity',
          vendor: 'Perplexity',
          key: process.env.PERPLEXITY_API_KEY,
          api_key_encrypted: process.env.PERPLEXITY_API_KEY,
          api_key_name: 'Environment Perplexity Key',
          is_active: true,
          source: 'environment'
        });
      }
      
      if (process.env.ANTHROPIC_API_KEY) {
        this.user.APIKeys.push({
          id: 'env-anthropic',
          provider: 'anthropic',
          vendor: 'Anthropic',
          key: process.env.ANTHROPIC_API_KEY,
          api_key_encrypted: process.env.ANTHROPIC_API_KEY,
          api_key_name: 'Environment Anthropic Key',
          is_active: true,
          source: 'environment'
        });
      }
    
    return this.user;
  }

  /**
   * Load user context from request (userId, planContext). On server this is the only way to set user/plan per request.
   * @param {{ userId?: string, planContext?: object }} ctx - From requestBody.user_context
   */
  loadUserContext(ctx) {
    if (ctx == null) ctx = {};
    if (ctx.userId != null) {
      this.user = typeof this.user === 'object' && this.user !== null ? { ...this.user, id: ctx.userId } : { id: ctx.userId };
    } else if (this.isServer) {
      this.user = null;
    }
    this.planContext = ctx.planContext ?? null;
  }

  /**
   * Load and cache user profile
   * Caches profile for 30 seconds to reduce database calls
   * @param {boolean} forceReload - If true, bypasses cache and reloads from database
   * @returns {Object|null} Profile data object or null if not found
   */
  async loadProfile(forceReload = false) {
    // Return cached profile if available and not forcing reload
    if (this.profileCache && !forceReload && 
        (Date.now() - this.profileCache.timestamp) < 30000) {
      this.log('[Monkey] Using cached profile (age:', Math.round((Date.now() - this.profileCache.timestamp) / 1000), 'seconds)');
      return this.profileCache.data;
    }

    if (!this.user?.id) {
      throw new Error('User must be authenticated to load profile');
    }

    this.log('[Monkey] Loading profile from database for user:', this.user.id);
    const profile = await this.read('profiles', [
      { operator: 'eq', args: ['id', this.user.id] }
    ]);

    if (profile && profile[0]) {
      if (this.isClient) {
        this.profileCache = {
          data: profile[0],
          timestamp: Date.now()
        };
        this.log('[Monkey] Profile loaded and cached');
      }
      return profile[0];
    }

    this.log('[Monkey] No profile found for user');
    return null;
  }

  // ==============================================
  // CLIENT-SIDE METHODS (from MonkeyClient)
  // ==============================================
  feedBanana(banana) {
    Object.assign(this, { ...banana });
  }
  errorInterpreter(error) {
      
      // Basic error information
      const errorInfo = {
        message: error.message || 'Unknown error',
        name: error.name || 'Error',
        timestamp: new Date().toISOString()
      };
      
      // Stack trace analysis
      if (error.stack) {
        errorInfo.stackTrace = error.stack;
        const stackLines = error.stack.split('\n');
        errorInfo.errorLocation = stackLines[1]?.trim() || 'Unknown location';
        errorInfo.fullStack = stackLines.slice(0, 5).map(line => line.trim()); // First 5 lines
      }
      
      // Additional error properties
      if (error.code) errorInfo.code = error.code;
      if (error.status) errorInfo.status = error.status;
      if (error.statusText) errorInfo.statusText = error.statusText;
      
      // Supabase specific error handling
      if (error.details) errorInfo.details = error.details;
      if (error.hint) errorInfo.hint = error.hint;
      
      // Context information
      errorInfo.context = {
        userAuthenticated: !!this.user,
        userId: this.user?.id || null,
        isServiceMode: this.isServiceMode,
        databaseApiEnabled: true
      };
      
      // Log comprehensive error
      
      // Return formatted error message
      const errorMsg = `${errorInfo.name}: ${errorInfo.message} at ${errorInfo.errorLocation}`;
      return errorMsg;

  }

  initState(stateName, initialStateValue) {
    if (!this.states) this.states = {};
    const setState = this.formatSetStateName(stateName);
    // Note: This won't work in server context, only in client components
    // if (typeof window !== 'undefined') {
      try {
        const { useState } = require('react');
        [this.states[stateName], this.states[setState]] = useState(initialStateValue);
      } catch (err) {
      }
    // }
  }

  async cjbutton(e) {
    const tar = e.target;
    const requiredAttrs = ["url", "action", "data"];
    let missing = requiredAttrs.filter(attr => !tar.hasAttribute(attr));
    if (missing.length > 0) {
      this.log("Missing required attributes:", missing.join(", "));
      return;
    }
    const url = tar.getAttribute("url");
    const action = tar.getAttribute("action");
    const data = tar.getAttribute("data");
    const destination = tar.hasAttribute("destination") ? tar.getAttribute("destination") : null;
    let callbackFunction = null;
    if (tar.hasAttribute("callbackFunction")) {
      callbackFunction = tar.getAttribute("callbackFunction");
    } else if (tar.hasAttribute("callback")) {
      callbackFunction = tar.getAttribute("callback");
    }
    const response = await this.apiCall(url, data);
    if (destination && this.states.hasOwnProperty(destination)) {
      const setStateName = this.formatSetStateName(destination);
      if (typeof this.states[setStateName] === "function") {
        this.states[setStateName](response);
      }
    }
    if (callbackFunction && this.callbacks.hasOwnProperty(callbackFunction)) {
      this.callbacks[callbackFunction](response);
    }
  }

  /**
   * Metering helper: call central /api/metering/spend and return approval.
   * @param {{ path?: string, action?: string, idempotencyKey?: string, meta?: object }} opts - path (or legacy action), idempotencyKey generated if omitted
   * @returns {Promise<{ ok: boolean, charged?: boolean, remaining?: number|null }>}
   */
  async runMetering(opts = {}) {
    const { path, action, meta } = opts || {};
    const identifier = path || action;
    const idempotencyKey = opts.idempotencyKey ?? randomIdempotencyKey();
    if (!identifier) {
      return { ok: true, charged: false, remaining: null };
    }

    if (!this.siteUrl) {
      return { ok: true, charged: false, remaining: null };
    }

    const url = this.siteUrl + "/api/metering/spend";

    const bodyPayload = { path: path || null, action: action || null, idempotencyKey, meta: meta ?? null };
    if (this.isClient) {
      bodyPayload.user_context = { userId: this.user?.id ?? null, planContext: this.planContext ?? null };
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (res.status === 429) {
        const remaining = data?.details?.remaining ?? null;
        const code = data?.code ?? null;
        const error = (typeof data?.error === "string" ? data.error : null) ?? "Request throttled";
        return { ok: false, charged: false, remaining, code, error };
      }

      if (!res.ok) {
        const msg =
          (data && typeof data.error === "string" && data.error) ||
          (data && data.error && typeof data.error === "object" && data.error.message) ||
          `HTTP ${res.status}: ${res.statusText}`;
        throw new Error(msg);
      }

      return {
        ok: true,
        charged: !!data.charged,
        remaining: data.remaining != null ? data.remaining : null,
        externalRequestId: data.externalRequestId ?? null,
      };
    } catch (err) {
      this.log("[runMetering] Error calling /api/metering/spend:", err?.message ?? err);
      throw err;
    }
  }

  /**
   * Single gateway for all app API calls (GET, POST, JSON, FormData, streaming).
   * Resolves relative URLs with this.siteUrl, includes credentials, and handles 429/error body the same way.
   * @param {string} url - Path or full URL
   * @param {object|FormData|null} data - JSON body (POST), or FormData for uploads, or null/undefined for GET
   * @param {object} options - { method?, headers?, returnResponse?, metering? }
   *   - method: 'GET' | 'POST' (default 'POST')
   *   - headers: optional headers (Content-Type is set for JSON; omit for FormData)
   *   - returnResponse: true to return raw Response for streaming (e.g. SSE)
   *   - metering is automatic when request path is in the cost registry (no options needed)
   * @returns {Promise<string|Response>} Response text, or Response when returnResponse is true
   */
  async apiCall(url, data, options = {}) {
    if (typeof data === "string" && this.states && this.states[data] !== undefined) {
      data = this.states[data];
    }
    const method = options.method || "POST";
    const returnResponse = options.returnResponse === true;

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = this.siteUrl + url;
    }

    // Auto metering: if request path is in the cost registry, run pre-flight metering (path + generated idempotency key)
    const pathname = normalizePath(url);
    let externalRequestId = null;
    if (getCostByPath(pathname) > 0) {
      const meteringResult = await this.runMetering({ path: pathname, idempotencyKey: randomIdempotencyKey() });
      if (!meteringResult.ok) {
        const isOutOfCredits = meteringResult.code === "OUT_OF_CREDITS";
        const err = new Error(isOutOfCredits ? "Out of credits" : (meteringResult.error ?? "Request throttled"));
        if (isOutOfCredits) {
          err.code = METERING_CODE_QUOTA_EXCEEDED;
          if (meteringResult.remaining != null) {
            err.remaining = meteringResult.remaining;
          }
          if (this.isClient) triggerOutOfCreditsBanner();
        }
        throw err;
      }
      externalRequestId = meteringResult.externalRequestId ?? null;
    }

    const isSave = typeof url === "string" && url.includes("/api/content-magic/save");
    if (isSave && data && !(data instanceof FormData)) {
      const bodyLen = data.contentHtml != null ? String(data.contentHtml).length : 0;
    }

    let body;
    let headers = { ...(options.headers || {}) };
    if (externalRequestId) {
      headers["X-External-Request-Id"] = externalRequestId;
    }
    if (data instanceof FormData) {
      body = data;
      // Do not set Content-Type; browser sets multipart/form-data with boundary
    } else if (method !== "GET" && data != null && data !== undefined) {
      const payload = this.isClient ? { ...data, user_context: { userId: this.user?.id ?? null, planContext: this.planContext ?? null } } : data;
      body = JSON.stringify(payload);
      headers["Content-Type"] = "application/json";
    } else if (method !== "GET") {
      body = "{}";
      headers["Content-Type"] = "application/json";
    }

    try {
      const init = {
        method,
        credentials: "include",
      };
      if (Object.keys(headers).length > 0) init.headers = headers;
      if (body !== undefined) init.body = body;

      const response = await fetch(url, init);
      const text = await response.text();

      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(text);
        } catch {
          errorData = { error: text || `HTTP ${response.status}: ${response.statusText}` };
        }
        let errMsg = `HTTP ${response.status}: ${response.statusText}`;
        if (typeof errorData.error === "string") {
          errMsg = errorData.error;
        } else if (errorData.error && typeof errorData.error === "object" && errorData.error.message) {
          errMsg = errorData.error.message;
        } else if (errorData.error != null) {
          errMsg = String(errorData.error);
        }
        const err = new Error(errMsg);
        if (response.status === 429 && errorData) {
          err.code = METERING_CODE_QUOTA_EXCEEDED;
          if (errorData.details) {
            err.quotaUsed = errorData.details.used;
            err.quotaLimit = errorData.details.quota;
          }
          if (this.isClient) triggerOutOfCreditsBanner();
        }
        if (isSave) 
        throw err;
      }

      if (returnResponse) {
        return new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers });
      }
      return text;
    } catch (err) {
      if (isSave) 
      this.log("API Call Error:", err);
      throw err;
    }
  }

  /**
   * GET request to app API. Thin wrapper around apiCall.
   * @param {string} url - Path or full URL
   * @param {object} options - { headers? }
   * @returns {Promise<string>} Response text
   */
  async apiGet(url, options = {}) {
    return this.apiCall(url, null, { method: 'GET', ...options });
  }

  /**
   * POST FormData to app API (e.g. file uploads). Thin wrapper around apiCall.
   * @param {string} url - Path or full URL
   * @param {FormData} formData - FormData to send
   * @returns {Promise<string>} Response text
   */
  async apiCallFormData(url, formData) {
    return this.apiCall(url, formData, {});
  }

  /**
   * POST to app API and return raw Response for streaming (e.g. SSE). Thin wrapper around apiCall.
   * Caller uses response.body.getReader() etc. On !response.ok, apiCall already throws.
   * @param {string} url - Path or full URL
   * @param {object} data - JSON body
   * @returns {Promise<Response>} Raw fetch Response
   */
  async apiCallStream(url, data) {
    return this.apiCall(url, data, { returnResponse: true });
  }

  /**
   * Save content-magic article (title, content_html, context, source_url, chat_history).
   * Shared processing: calls API and returns parsed result. Do not call /api/content-magic/save via fetch directly.
   * @param {object} params - { articleId, title?, contentHtml?, icpId?, offerId?, pageType?, sourceUrl?, chatHistory? }
   * @returns {Promise<{ success: boolean, articleId: string }>}
   */
  async saveArticle(params) {
    const articleId = params?.articleId;
    const contentLen = params?.contentHtml != null ? String(params.contentHtml).length : 0;

    let text;
    try {
      text = await this.apiCall("/api/content-magic/save", params);
    } catch (apiErr) {

      throw apiErr;
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      
      throw parseErr;
    }

    if (data.error) {

      throw new Error(data.error);
    }
    return { success: true, articleId: data.articleId ?? params.articleId };
  }

  /**
   * Get campaign with full details (ICP, offer, outcome, etc.) from API.
   * Shared processing: calls API and returns parsed campaign. Do not call /api/monkey/campaign-with-details via fetch directly.
   * @param {string} campaignId
   * @returns {Promise<{ campaign: object }|null>} Parsed result or null on error/not found
   */
  async getCampaignWithDetails(campaignId) {
    try {
      const text = await this.apiCall("/api/monkey/campaign-with-details", { campaignId });
      const data = JSON.parse(text);
      return data.campaign ? { campaign: data.campaign } : null;
    } catch (err) {
      this.log("getCampaignWithDetails failed:", err?.message);
      return null;
    }
  }

  /**
   * Save custom CSS and/or external CSS links to user profile.
   * Shared processing: calls API and returns parsed result. Do not call /api/settings/custom-css via fetch directly.
   * @param {object} params - { css?: string, external_css_links?: string[], css_class_references?: string }
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async saveCustomCss(params) {
    const text = await this.apiCall("/api/settings/custom-css", params);
    const data = JSON.parse(text);
    if (!data.success && data.error) {
      throw new Error(data.error);
    }
    return { success: data.success, message: data.message ?? "Saved" };
  }

  formatSetStateName(stateName) {
    return "set" + stateName.charAt(0).toUpperCase() + stateName.slice(1);
  }

  // ==============================================
  // SERVER-SIDE METHODS
  // ==============================================
  async setServiceMode(serviceMode = true) {
    this.isServiceMode = serviceMode;
    // Service mode no longer needs Supabase initialization
    // All operations go through API endpoints
  }

  _getEnvironmentAPIKeys() {
    const apiKeys = [];
    if (process.env.CHATGPT_API_KEY) {
      apiKeys.push({
        id: 'env-chatgpt',
        provider: 'openai',
        vendor: 'ChatGPT',
        key: process.env.CHATGPT_API_KEY,
        api_key_encrypted: process.env.CHATGPT_API_KEY,
        api_key_name: 'Environment ChatGPT Key',
        is_active: true,
        source: 'environment'
      });
    }
    return apiKeys;
  }

  _meteringAdapter() {
    return {
      read: this.read.bind(this),
      write: this.write.bind(this),
      update: this.update.bind(this),
      log: this.log.bind(this),
      getMeteringOverride: () => this.meteringOverride,
      getTierById: _getTierById,
      DEFAULT_MONTHLY_CREDITS: _DEFAULT_MONTHLY_CREDITS,
    };
  }

  // ==============================================
  // GENERIC DATABASE OPERATIONS: read, write, update, delete
  // ==============================================
  
  /**
   * Process Supabase settings into a query builder
   * Helper function for direct Supabase calls
   */
  _processSupabaseSettings(supabase, defaultSettings, settings) {
    const operatorsInSettings = Array.isArray(settings)
      ? settings.map(s => s.operator)
      : (Array.isArray(settings?.operators) ? settings.operators : []);

    const mergedSettings = [
      ...defaultSettings.filter(def =>
        !operatorsInSettings.includes(def.operator)
      ),
      ...(Array.isArray(settings) ? settings : (settings?.operators || []))
    ];

    // Sort operators to ensure correct execution order
    const operatorOrder = ['from', 'select', 'eq', 'lt', 'gt', 'lte', 'gte', 'neq', 'range', 'order'];
    mergedSettings.sort((a, b) => {
      const indexA = operatorOrder.indexOf(a.operator);
      const indexB = operatorOrder.indexOf(b.operator);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

    let query = supabase;
    for (const setting of mergedSettings) {
      const { operator, args } = setting;
      if (typeof query[operator] === 'function') {
        query = query[operator](...args);
      }
    }
    return query;
  }

  async runQuery(sql) {
    // Try direct Supabase call first
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase.rpc('run_sql', { sql });
        if (error) throw new Error(`SQL query error: ${error.message}`);
        return data;
      } catch (error) {
        this.log('Direct Supabase runQuery failed, falling back to API:', error.message);
        // Fall through to API call
      }
    }
    
    // Fallback to API endpoint
    const response = await this.apiCall(this.siteUrl + '/api/database', {
      action: 'runQuery',
      payload: { sql }
    });
    const result = JSON.parse(response);
    if (!result.success) {
      throw new Error(`SQL query error: ${result.error || 'Unknown error'}`);
    }
    return result.result;
  }

  async read(table, settings = []) {
    // Create cache key
    const cacheKey = `${table}:${JSON.stringify(settings)}`;
    
    // Check cache first (only when client - do not persist user/request data on server)
    if (this.isClient && this.readCache) {
      const cached = this.readCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        this.log(`[Monkey Cache HIT] ${table}`);
        return cached.result;
      }
    }
    
    // Try direct Supabase call first
    if (this.supabase) {
      try {
        const defaultSettings = [
          { operator: 'from', args: [table] },
          { operator: 'select', args: ["*"] },
          { operator: 'range', args: [0, 1000] }
        ];
        
        const query = this._processSupabaseSettings(this.supabase, defaultSettings, settings);
        const { data, error } = await query;
        
        if (error) throw new Error(`Read error on ${table}: ${error.message}`);
        
        // Cache successful result (client only)
        if (this.isClient && this.readCache) {
          this.readCache.set(cacheKey, { result: data, timestamp: Date.now() });
          if (this.readCache.size > 100) {
            const now = Date.now();
            for (const [key, value] of this.readCache.entries()) {
              if (now - value.timestamp > this.CACHE_TTL) {
                this.readCache.delete(key);
              }
            }
          }
        }
        return data;
      } catch (error) {
        this.log('Direct Supabase read failed, falling back to API:', error.message);
        // Fall through to API call
      }
    }
    
    // Fallback to API endpoint
    const action = 'read';
    let result = await this.apiCall(this.siteUrl + '/api/database', { action, table, payload: settings });
    result = JSON.parse(result);
    if (!result.success) {
      throw new Error(result.error || `Read error on ${table}`);
    }
    if (this.isClient && this.readCache) {
      this.readCache.set(cacheKey, { result: result.result, timestamp: Date.now() });
    }
    return result.result;
  }

  async write(table, object) {
    // Try direct Supabase call first
    if (this.supabase) {
      try {
        if (Array.isArray(object)) {
          const results = [];
          for (const item of object) {
            if (item.id && item.id !== "null" && item.id !== "undefined") {
              // Update
              const { data, error } = await this.supabase
                .from(table)
                .update(item)
                .eq('id', item.id)
                .select();
              if (error) throw new Error(`Update error on ${table}: ${error.message}`);
              results.push(data[0]);
            } else {
              // Insert
              const { data, error } = await this.supabase
                .from(table)
                .insert(item)
                .select();
              if (error) throw new Error(`Write error on ${table}: ${error.message}`);
              results.push(data[0]);
            }
          }
          return results;
        } else {
          // Single object
          if (object.id && object.id !== "null" && object.id !== "undefined") {
            // Update
            const { data, error } = await this.supabase
              .from(table)
              .update(object)
              .eq('id', object.id)
              .select();
            if (error) throw new Error(`Update error on ${table}: ${error.message}`);
            return data[0];
          } else {
            // Insert
            const { data, error } = await this.supabase
              .from(table)
              .insert(object)
              .select();
            if (error) throw new Error(`Write error on ${table}: ${error.message}`);
            return data[0];
          }
        }
      } catch (error) {
        this.log('Direct Supabase write failed, falling back to API:', error.message);
        // Fall through to API call
      }
    }
    
    // Fallback to API endpoint
    const action = 'write';
    let result = await this.apiCall(this.siteUrl + '/api/database', { action, table, payload: object });
    result = JSON.parse(result);
    if (!result.success) {
      throw new Error(result.error || `Write error on ${table}`);
    }
    return result.result;
  }

  async update(table, object, settings) {
    this.log("Monkey->update called with:", { table, object, hasSettings: !!settings });
    
    // Try direct Supabase call first
    if (this.supabase) {
      try {
        if (Array.isArray(object)) {
          const results = [];
          for (const item of object) {
            if (!item.id && !settings) {
              throw new Error(`Update error: Array item missing id property`);
            }
            let query = this.supabase.from(table).update(item);
            if (settings && Array.isArray(settings) && settings.length > 0) {
              for (const { operator, args } of settings) {
                if (operator === 'eq' && args && args.length >= 2) {
                  query = query.eq(args[0], args[1]);
                }
              }
            } else {
              query = query.eq('id', item.id);
            }
            const { data, error } = await query.select();
            if (error) throw new Error(`Update error on ${table}: ${error.message}`);
            results.push(data[0]);
          }
          return results;
        } else {
          if (!object.id && !settings) {
            throw new Error(`Update error: No id provided for single object update`);
          }
          let query = this.supabase.from(table).update(object);
          if (settings && Array.isArray(settings) && settings.length > 0) {
            for (const { operator, args } of settings) {
              if (operator === 'eq' && args && args.length >= 2) {
                query = query.eq(args[0], args[1]);
              }
            }
          } else {
            query = query.eq('id', object.id);
          }
          const { data, error } = await query.select();
          if (error) throw new Error(`Update error on ${table}: ${error.message}`);
          return data[0];
        }
      } catch (error) {
        this.log('Direct Supabase update failed, falling back to API:', error.message);
        // Fall through to API call
      }
    }
    
    // Fallback to API endpoint
    const action = 'update';
    const payload = settings ? { object, settings } : object;
    let result = await this.apiCall(this.siteUrl + '/api/database', { action, table, payload });
    result = JSON.parse(result);
    if (!result.success) {
      throw new Error(result.error || `Update error on ${table}`);
    }
    return result.result;
  }

  async delete(table, id) {
    // Try direct Supabase call first
    if (this.supabase) {
      try {
        if (Array.isArray(id)) {
          const results = [];
          for (const singleId of id) {
            const { error } = await this.supabase
              .from(table)
              .delete()
              .eq('id', singleId);
            if (error) throw new Error(`Delete error on ${table}: ${error.message}`);
            results.push(`deleted id=${singleId}`);
          }
          return results;
        } else {
          const { error } = await this.supabase
            .from(table)
            .delete()
            .eq('id', id);
          if (error) throw new Error(`Delete error on ${table}: ${error.message}`);
          return `deleted id=${id}`;
        }
      } catch (error) {
        this.log('Direct Supabase delete failed, falling back to API:', error.message);
        // Fall through to API call
      }
    }
    
    // Fallback to API endpoint
    const action = 'delete';
    let result = await this.apiCall(this.siteUrl + '/api/database', { action, table, payload: id });
    result = JSON.parse(result);
    if (!result.success) {
      throw new Error(result.error || `Delete error on ${table}`);
    }
    return result.result;
  }

  // ==============================================
  // AI OPERATIONS: set template, extract json from text, query.
  // ==============================================
  /**
   * Resolve model tier ("agent", "high", "mid") to actual model name
   * Model tiers are resolved via centralized config in config/ai-models.js
   * If model is not a tier, returns it as-is (for direct model names)
   */
  _resolveModelTier(model) {
    try {
      const { resolveMonkeyModelTier } = require("@/config/ai-models");
      return resolveMonkeyModelTier(model);
    } catch (e) {
      // Fallback if import fails (shouldn't happen, but for safety)
      // This fallback also uses env vars only (no hardcoded values)
      // TODO: remove — "agent" tier deprecated; resolves to ADVANCED same as "high"
      if (model === "agent") {
        return process.env.MONKEY_MODEL_AGENT || process.env.AI_MODEL_ADVANCED || process.env.NEXT_PUBLIC_AI_MODEL_ADVANCED;
      } else if (model === "high") {
        return process.env.MONKEY_MODEL_HIGH || process.env.AI_MODEL_ADVANCED || process.env.NEXT_PUBLIC_AI_MODEL_ADVANCED;
      } else if (model === "mid") {
        return process.env.MONKEY_MODEL_MID || process.env.AI_MODEL_STANDARD || process.env.NEXT_PUBLIC_AI_MODEL_STANDARD;
      }
      return model;
    }
  }

  /**
   * Get OpenAI API key with fallback support
   * Tries OPENAI_API_KEY, then OPENAI_API_KEY_1, OPENAI_API_KEY_2, etc.
   * Returns the first available key found in environment variables
   * Note: Key validation happens during actual API calls, not here
   * @returns {string} The first available OpenAI API key
   * @throws {Error} If no valid key is found
   */
  getOPENAIKEY() {
    // Try primary key first
    let apiKey = process.env.OPENAI_API_KEY;
    
    // If primary key doesn't exist, try fallback keys
    if (!apiKey) {
      for (let i = 1; i <= 10; i++) {
        const envKeyName = i === 1 ? 'OPENAI_API_KEY_1' : `OPENAI_API_KEY_${i}`;
        apiKey = process.env[envKeyName];
        if (apiKey) {
          break;
        }
      }
    }
    
    if (!apiKey) {
      throw new Error("No OpenAI API key found. Set OPENAI_API_KEY or OPENAI_API_KEY_1, OPENAI_API_KEY_2, etc. in environment variables.");
    }
    
    return apiKey;
  }

  /**
   * Admin warning function - only fires if user email matches ADMIN_WARNING_EMAIL
   * Logs with red !!!! prefix through monkey's log function
   * @param {string} message - The warning message to log
   */
  async adminWarning(message) {
    // Check if user email matches ADMIN_WARNING_EMAIL
    const adminEmail = process.env.ADMIN_WARNING_EMAIL;
    if (!adminEmail) {
      return; // No admin email configured, don't log
    }
    
    // Check if user is initialized and email matches
    if (!this.user || !this.user.email || this.user.email !== adminEmail) {
      return; // Not the admin user, don't log
    }
    
    // Log with red !!!! prefix (5+ exclamation marks)
    const warningMessage = `!!!!! ${message}`;
    this.log(warningMessage);
  }

  async AI(query, options = {}) {
    this.log('🤖 === [MONKEY.AI] Started ===');
    const userId = options.userId || this.user?.id;
    if (userId) {
      const estimatedCredits = estimateCredits('openai_text', { model: options.model }, this.markups);
      await checkQuota(userId, estimatedCredits, this._meteringAdapter(), { planContext: this.planContext });
    }
    
    // Support both string queries and message arrays
    let messages;
    let isMessageArray = false;
    if (Array.isArray(query)) {
      messages = query;
      isMessageArray = true;
      this.log('📝 [MONKEY.AI] Received message array with', messages.length, 'messages');
      this.log('📝 [MONKEY.AI] First message preview:', messages[0]?.content?.substring(0, 200) + (messages[0]?.content?.length > 200 ? '...' : ''));
    } else {
      messages = [{ role: "user", content: query }];
      this.log('📝 [MONKEY.AI] Query length:', query?.length || 0);
      this.log('📝 [MONKEY.AI] Query preview:', query?.substring(0, 200) + (query?.length > 200 ? '...' : ''));
    }
    this.log('⚙️ [MONKEY.AI] Options:', options);
    
    // check options, if certain keys are missing, set defaults.
    const defaultOptions = { 
      vendor: "openai", 
      model: process.env.AI_MODEL_STANDARD || process.env.NEXT_PUBLIC_AI_MODEL_STANDARD, 
      forceJson: false, 
      showFullResponse: false,
      temperature: 0.7,
      max_tokens: null,
      max_completion_tokens: null
    };
    options = { ...defaultOptions, ...options };

    // 🔄 Synonym handling - normalize vendor names
    const vendorSynonyms = {
      'ChatGPT': 'openai',
      'chatgpt': 'openai',
      'gpt': 'openai',
      'OpenAI': 'openai',
    };
    
    if (vendorSynonyms[options.vendor]) {
      this.log(`🔄 [MONKEY.AI] Normalizing vendor: "${options.vendor}" → "${vendorSynonyms[options.vendor]}"`);
      options.vendor = vendorSynonyms[options.vendor];
    }

    const vendor = options.vendor;
    const modelTierOrName = options.model;
    
    // Resolve model tier ("agent", "high", "mid") to actual model name
    const model = this._resolveModelTier(modelTierOrName);
    const forceJson = options.forceJson;
    
    if (modelTierOrName !== model) {
      this.log(`🔄 [MONKEY.AI] Resolved model tier: "${modelTierOrName}" → "${model}"`);
    }
    
    this.log('🏪 [MONKEY.AI] Vendor:', vendor);
    this.log('🧠 [MONKEY.AI] Model (resolved):', model);
    this.log('📊 [MONKEY.AI] Force JSON:', forceJson);

    
    let payload;
    switch (vendor) {
      case "openai":
        this.log('🔑 [MONKEY.AI] Looking for OpenAI API key...');
        
        let apiKey = this.user?.APIKeys?.find(key => key.vendor === "openai")?.key;
        if (options.apiKey) {
          this.log('🔑 [MONKEY.AI] Using API key from options');
          apiKey = options.apiKey;
        }

        if (!apiKey) {
          this.log('🔑 [MONKEY.AI] No user API key, checking environment...');
          try {
            apiKey = this.getOPENAIKEY();
          } catch (error) {
            this.log('❌ [MONKEY.AI] No OpenAI API key found:', error.message);
            throw new Error("No OpenAI API key found for user or in environment (.env). If this is on production, know that the .env.local is ignored by git.");
          }
        }
        
        this.log('✅ [MONKEY.AI] API key found:', apiKey ? `${apiKey.substring(0, 10)}...` : 'none');
        
        payload = {
          apiKey,
          query,
          model,
        };

        this.log('📤 [MONKEY.AI] Sending request to OpenAI...');
        const startTime = Date.now();
        
        // Build request body
        const requestBody = {
          model,
          messages,
          ...(options.reasoning_effort ? {} : { temperature: options.temperature || 0.7 }),
        };
        
        // Handle token limits for different model types
        const isNewerModel = model.includes('o1') || model.includes('o3') || model.includes('gpt-5');
        if (isNewerModel && options.max_completion_tokens) {
          requestBody.max_completion_tokens = options.max_completion_tokens;
        } else if (options.max_tokens) {
          requestBody.max_tokens = options.max_tokens;
        }
        
        if (options.reasoning_effort) {
          requestBody.reasoning_effort = options.reasoning_effort;
        }
        
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        });
        
        const duration = Date.now() - startTime;
        this.log(`⏱️ [MONKEY.AI] OpenAI API call took ${duration}ms`);

        if (!response.ok) {
          this.log('❌ [MONKEY.AI] OpenAI API error. Status:', response.status, response.statusText);
          const errorData = await response.json();
          this.log('❌ [MONKEY.AI] Error details:', errorData);
          
          // If key is disabled, trigger adminWarning and try fallback
          if (response.status === 401 || response.status === 403) {
            const currentKeyName = apiKey === process.env.OPENAI_API_KEY ? 'OPENAI_API_KEY' : 
              Object.keys(process.env).find(key => process.env[key] === apiKey && key.startsWith('OPENAI_API_KEY'));
            await this.adminWarning(`OpenAI API key ${currentKeyName || 'unknown'} returned ${response.status} error. Error: ${errorData.error?.message || response.statusText}`);
            
            // Try to get a fallback key (skip the one that failed)
            const failedKey = apiKey;
            let fallbackKey = null;
            
            // Try OPENAI_API_KEY first if current key wasn't the primary
            if (failedKey !== process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY) {
              fallbackKey = process.env.OPENAI_API_KEY;
            } else {
              // Try fallback keys in order
              for (let i = 1; i <= 10; i++) {
                const envKeyName = i === 1 ? 'OPENAI_API_KEY_1' : `OPENAI_API_KEY_${i}`;
                const candidateKey = process.env[envKeyName];
                if (candidateKey && candidateKey !== failedKey) {
                  fallbackKey = candidateKey;
                  break;
                }
              }
            }
            
            if (fallbackKey) {
              this.log('🔄 [MONKEY.AI] Retrying with fallback key...');
              // Retry the request with fallback key
              const retryResponse = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${fallbackKey}`,
                },
                body: JSON.stringify(requestBody),
              });
              
              if (!retryResponse.ok) {
                const retryErrorData = await retryResponse.json();
                const fallbackKeyName = Object.keys(process.env).find(key => process.env[key] === fallbackKey && key.startsWith('OPENAI_API_KEY'));
                await this.adminWarning(`Fallback OpenAI API key ${fallbackKeyName || 'unknown'} also failed with status ${retryResponse.status}`);
                throw new Error(`ChatGPT API error: ${retryErrorData.error?.message || retryResponse.statusText}`);
              }
              
              var responseText = await retryResponse.text();
              var responseJson = JSON.parse(responseText);
              
              // Extract token usage from retry response
              const retryTokenUsage = responseJson.usage ? {
                prompt_tokens: responseJson.usage.prompt_tokens || 0,
                completion_tokens: responseJson.usage.completion_tokens || 0,
                total_tokens: responseJson.usage.total_tokens || 0
              } : null;
              
              if (retryTokenUsage) {
                this.log(`🔢 [MONKEY.AI] Retry token usage - Prompt: ${retryTokenUsage.prompt_tokens}, Completion: ${retryTokenUsage.completion_tokens}, Total: ${retryTokenUsage.total_tokens}`);
              }
              
              var output = responseJson.choices?.[0]?.message?.content || "";
              
              if (query.toLowerCase().includes("json format")) {
                this.log('🔍 [MONKEY.AI] Extracting JSON from output...');
                output = this.extractJsonFromText(output) || output;
              }
              
              const retryDuration = Date.now() - startTime;
              
              // Calculate credits for retry
              const retryCredits = retryTokenUsage ? calculateCredits('openai_text', {
                model: model,
                prompt_tokens: retryTokenUsage.prompt_tokens,
                completion_tokens: retryTokenUsage.completion_tokens
              }, this.markups) : 0;
              
              if (userId && retryCredits > 0) {
                const costUSD = retryCredits * 0.10;
                await logUsage(userId, 'openai', 'openai_text', {
                  method: 'AI',
                  model: model,
                  prompt_tokens: retryTokenUsage?.prompt_tokens || 0,
                  completion_tokens: retryTokenUsage?.completion_tokens || 0
                }, retryCredits, costUSD, this._meteringAdapter());
                await deductCredits(userId, retryCredits, this._meteringAdapter());
              }
              
              // Handle returnMetadata option for retry
              if (options.returnMetadata) {
                return {
                  output,
                  credits: retryCredits,
                  metadata: {
                    tokenUsage: retryTokenUsage,
                    duration: retryDuration,
                    model
                  }
                };
              }
              
              if (options.showFullResponse) {
                this.log('✨ [MONKEY.AI] Returning full response');
                this.log('🤖 === [MONKEY.AI] Completed ===');
                return responseText;
              } else if (forceJson) {
                this.log('🔍 [MONKEY.AI] Force JSON enabled, extracting...');
                const extractedJson = this.extractJsonFromText(output);
                this.log('✨ [MONKEY.AI] Returning:', extractedJson ? 'extracted JSON' : 'original output');
                this.log('🤖 === [MONKEY.AI] Completed ===');
                return extractedJson || output;
              } else {
                this.log('✨ [MONKEY.AI] Returning standard output');
                this.log('🤖 === [MONKEY.AI] Completed ===');
                return output;
              }
            } else {
              throw new Error(`ChatGPT API error: ${errorData.error?.message || response.statusText}. No fallback keys available.`);
            }
          } else {
            throw new Error(`ChatGPT API error: ${errorData.error?.message || response.statusText}`);
          }
        }
        
        var responseText = await response.text();
        this.log('📨 [MONKEY.AI] Response received, length:', responseText?.length || 0);
        
        var responseJson = JSON.parse(responseText);
        this.log('📊 [MONKEY.AI] Response parsed. Choices:', responseJson.choices?.length || 0);
        
        // Extract token usage if available
        const tokenUsage = responseJson.usage ? {
          prompt_tokens: responseJson.usage.prompt_tokens || 0,
          completion_tokens: responseJson.usage.completion_tokens || 0,
          total_tokens: responseJson.usage.total_tokens || 0
        } : null;
        
        if (tokenUsage) {
          this.log(`🔢 [MONKEY.AI] Token usage - Prompt: ${tokenUsage.prompt_tokens}, Completion: ${tokenUsage.completion_tokens}, Total: ${tokenUsage.total_tokens}`);
        }
        
        var output = responseJson.choices?.[0]?.message?.content || "";
        this.log('📤 [MONKEY.AI] Output extracted, length:', output?.length || 0);
        this.log('📤 [MONKEY.AI] Output preview:', output?.substring(0, 200) + (output?.length > 200 ? '...' : ''));
        
        // If the query asks for "json format", try to extract JSON from output
        const queryText = isMessageArray ? messages.map(m => m.content).join(' ') : query;
        if (queryText.toLowerCase().includes("json format")) {
          this.log('🔍 [MONKEY.AI] Extracting JSON from output...');
          output = this.extractJsonFromText(output) || output;
        }
        
        // Calculate credits for this API call
        const credits = tokenUsage ? calculateCredits('openai_text', {
          model: model,
          prompt_tokens: tokenUsage.prompt_tokens,
          completion_tokens: tokenUsage.completion_tokens
        }, this.markups) : 0;
        
        // Store last credits for methods that return simple values
        this.lastCredits = credits;
        
        if (userId && credits > 0) {
          const costUSD = credits * 0.10;
          await logUsage(userId, 'openai', 'openai_text', {
            method: 'AI',
            model: model,
            prompt_tokens: tokenUsage?.prompt_tokens || 0,
            completion_tokens: tokenUsage?.completion_tokens || 0
          }, credits, costUSD, this._meteringAdapter());
          await deductCredits(userId, credits, this._meteringAdapter());
        }
        
        // Store token usage and duration in response metadata if options.returnMetadata is true
        if (options.returnMetadata) {
          return {
            output,
            credits,
            metadata: {
              tokenUsage,
              duration,
              model
            }
          };
        }
        break;
      default:
        this.log('❌ [MONKEY.AI] Unsupported vendor:', vendor);
        throw new Error(`Unsupported AI vendor: ${vendor}`);
    }

    // Note: If returnMetadata was used, we already returned above
    // This section handles normal returns (without metadata)
    
    if (options.showFullResponse) {
      this.log('✨ [MONKEY.AI] Returning full response');
      this.log('🤖 === [MONKEY.AI] Completed ===');
      return responseText;
    } else if (forceJson) {
      this.log('🔍 [MONKEY.AI] Force JSON enabled, extracting...');
      // Try to extract JSON from output using regex
      const extractedJson = this.extractJsonFromText(output);
      this.log('✨ [MONKEY.AI] Returning:', extractedJson ? 'extracted JSON' : 'original output');
      this.log('🤖 === [MONKEY.AI] Completed ===');
      return extractedJson || output;
    } else {
      this.log('✨ [MONKEY.AI] Returning standard output');
      this.log('🤖 === [MONKEY.AI] Completed ===');
      return output;
    }

  }

  async webExtract(urls, options = {}) {
    const defaultOptions = { maxResults: 10, ...options };
    const userId = options.userId || this.user?.id;
    const urlList = Array.isArray(urls) ? urls : [urls];
    if (userId && urlList.length > 0) {
      const estimatedCredits = estimateCredits('tavily_extract', { urlCount: urlList.length }, this.markups);
      await checkQuota(userId, estimatedCredits, this._meteringAdapter(), { planContext: this.planContext });
    }
    const apiKey = process.env.NEXT_PUBLIC_TVLY_API_KEY || process.env.TVLY_API_KEY;

    // Fallback to API call if no Tavily API key
    if (!apiKey) {
      const action = 'webExtract';
      let result = await this.apiCall(this.siteUrl + '/api/monkey', { action, table: urls, payload: defaultOptions });
      result = JSON.parse(result);
      return result.result;
    }

    // Ensure urls is an array
    if (!Array.isArray(urls)) {
      urls = [urls];
    }

    if (urls.length === 0) {
      throw new Error("URLs array cannot be empty");
    }

    try {
      // Send all URLs in a single request
      const response = await fetch("https://api.tavily.com/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          urls: urls
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Tavily API error: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      this.log("webExtract response:", data);
      
      // Calculate credits for Tavily extract
      const results = data.results || [];
      const credits = calculateCredits('tavily_extract', {
        urlCount: results.length || urlList.length,
        advanced: false // Basic extract by default
      }, this.markups);
      const costUSD = credits * 0.10;
      if (userId && credits > 0) {
        await logUsage(userId, 'tavily', 'tavily_extract', { method: 'webExtract', urlCount: results.length }, credits, costUSD, this._meteringAdapter());
        await deductCredits(userId, credits, this._meteringAdapter());
      }
      
      // Return results with credits (wrap in object to preserve credits)
      // Note: For backward compatibility, we'll add credits to the results array as a property
      if (Array.isArray(results) && results.length > 0) {
        results._credits = credits;
      }
      
      return results;
    } catch (error) {
      this.log("webExtract error:", error);
      throw error;
    }
  }
  async getSERP(keyword, options = {}) {
    const userId = options.userId || this.user?.id;
    if (userId) {
      const estimatedCredits = estimateCredits('dataforseo', { count: 1 }, this.markups);
      await checkQuota(userId, estimatedCredits, this._meteringAdapter(), { planContext: this.planContext });
    }
    const { getSERP } = await import("./monkey/tools/dataForSeo");
    const result = await getSERP(keyword, options);
    const credits = calculateCredits('dataforseo', { count: 1 }, this.markups);
    const costUSD = credits * 0.10;
    if (userId && credits > 0) {
      await logUsage(userId, 'dataforseo', 'dataforseo', { method: 'getSERP' }, credits, costUSD, this._meteringAdapter());
      await deductCredits(userId, credits, this._meteringAdapter());
    }
    return result;
  }

  async webSearch(query, options = {}) {
    const defaultOptions = { maxResults: 10, ...options };
    const userId = options.userId || this.user?.id;
    if (userId) {
      const estimatedCredits = estimateCredits('tavily_search', {}, this.markups);
      await checkQuota(userId, estimatedCredits, this._meteringAdapter(), { planContext: this.planContext });
    }
    const apiKey = process.env.NEXT_PUBLIC_TVLY_API_KEY || process.env.TVLY_API_KEY;

    if (!apiKey) {
      // Fallback to API call when no API key
      try {
        const action = 'webSearch';
        let result = await this.apiCall(this.siteUrl + '/api/monkey', { action, table: query, payload: options });
        result = JSON.parse(result);
        return result.result;
      } catch (error) {
        throw new Error("No Tavily API key found and fallback API call failed: " + error.message);
      }
    }

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: defaultOptions.maxResults,
          include_answer: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText };
        }
        throw new Error(`Tavily API error: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      const results = data.results || [];
      
      // Calculate credits for Tavily search
      const credits = calculateCredits('tavily_search', {
        count: 1,
        advanced: false // Basic search by default
      }, this.markups);
      const costUSD = credits * 0.10;
      if (userId && credits > 0) {
        await logUsage(userId, 'tavily', 'tavily_search', { method: 'webSearch' }, credits, costUSD, this._meteringAdapter());
        await deductCredits(userId, credits, this._meteringAdapter());
      }
      
      // Add credits to results array
      if (Array.isArray(results) && results.length > 0) {
        results._credits = credits;
      }
      
      return results;
    } catch (error) {
      // If fetch fails (network error), provide more helpful error message
      if (error.message.includes('fetch failed') || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new Error(`Failed to connect to Tavily API: ${error.message}. Please check your network connection and API key.`);
      }
      throw error;
    }
  }
  async webCrawl(url, options = {}) {
    const defaultOptions = { instructions: "Extract the main content and key data from the webpage." };
    // const defaultOptions={};
    options = { ...defaultOptions, ...options };
    const userId = options.userId || this.user?.id;
    if (userId) {
      const estimatedCredits = estimateCredits('tavily_extract', { urlCount: 1 }, this.markups);
      await checkQuota(userId, estimatedCredits, this._meteringAdapter(), { planContext: this.planContext });
    }
    const apiKey = process.env.NEXT_PUBLIC_TVLY_API_KEY || process.env.TVLY_API_KEY;

    
    if (!apiKey) {
      const action = 'webCrawl';
      let result = await this.apiCall(this.siteUrl + '/api/monkey', { action, table: url, payload: options });
      result = JSON.parse(result);
      return result.result;
    }

    if (!apiKey) {
      throw new Error("No Tavily API key found in environment variables");
    }

    if (!url) {
      throw new Error("URL is required for web crawl");
    }

    const response = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        urls: [url],
        ...options
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Tavily API error: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    const results = data.results || [];
    
    // Calculate credits for Tavily crawl (uses extract API)
    const credits = calculateCredits('tavily_extract', {
      urlCount: 1,
      advanced: false
    }, this.markups);
    const costUSD = credits * 0.10;
    if (userId && credits > 0) {
      await logUsage(userId, 'tavily', 'tavily_extract', { method: 'webCrawl' }, credits, costUSD, this._meteringAdapter());
      await deductCredits(userId, credits, this._meteringAdapter());
    }
    
    // Add credits to results array
    if (Array.isArray(results) && results.length > 0) {
      results._credits = credits;
    }
    
    return results;
  }
  extractJsonFromText(text) {
    if (typeof text !== 'string') return null;
    const jsonBlockRegex = /```json\s*([\s\S]*?)```/i;
    const blockMatch = text.match(jsonBlockRegex);
    if (blockMatch && blockMatch[1]) {
      return blockMatch[1].trim();
    }
    const trimmed = text.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      return trimmed;
    }
    // Use regex to extract JSON from text. Output is json string.
    // Match either a JSON object {...} or a JSON array [...]
    const jsonRegex = /({[\s\S]*?}|\[[\s\S]*?\])/;
    const match = text.match(jsonRegex);
    if (match && match[0]) {
      return match[0];
    }
    this.log('Monkey->extractJsonFromText: no JSON match found in text:', text);
    return null;
  }

  // ==============================================
  // DATAFORSEO METHODS
  // ==============================================
  
  /**
   * Helper function to parse input string (keywords or URLs)
   * Splits by newlines, commas, or semicolons
   */
  _parseInputString(inputString) {
    if (!inputString || typeof inputString !== 'string' || !inputString.trim()) {
      return [];
    }
    return inputString
      .split(/[\n,;]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  /**
   * Get search volumes for keywords
   * @param {string} keywords - Keywords separated by newlines, commas, or semicolons
   * @param {object} settings - Optional settings (currently unused, reserved for future use)
   * @returns {Promise<object>} Results with search volumes
   */
  async DataForSEOSearchVolume(keywords, settings = {}) {
    const keywordsArray = this._parseInputString(keywords);
    if (keywordsArray.length === 0) {
      throw new Error("At least one keyword is required");
    }
    const userId = settings.userId || this.user?.id;
    if (userId) {
      const estimatedCredits = estimateCredits('dataforseo', { count: 1 }, this.markups);
      await checkQuota(userId, estimatedCredits, this._meteringAdapter(), { planContext: this.planContext });
    }

    try {
      const response = await this.apiCall(
        this.siteUrl + '/api/dataforseo/search-volume',
        { keywords: keywordsArray }
      );
      const data = JSON.parse(response);
      if (data.error) {
        throw new Error(data.error);
      }
      const credits = calculateCredits('dataforseo', { count: 1 }, this.markups);
      const costUSD = credits * 0.10;
      if (userId && credits > 0) {
        await logUsage(userId, 'dataforseo', 'dataforseo', { method: 'DataForSEOSearchVolume' }, credits, costUSD, this._meteringAdapter());
        await deductCredits(userId, credits, this._meteringAdapter());
      }
      return data;
    } catch (error) {
      this.log("DataForSEOSearchVolume error:", error);
      throw error;
    }
  }

  /**
   * Get ranking keywords for URLs
   * @param {string} urls - URLs separated by newlines, commas, or semicolons
   * @param {object} settings - Optional settings: { limit: number (default: 20) }
   * @returns {Promise<object>} Results with ranking keywords and positions
   */
  async DataForSEORankingKeywords(urls, settings = {}) {
    const urlsArray = this._parseInputString(urls);
    if (urlsArray.length === 0) {
      throw new Error("At least one URL is required");
    }

    // Validate URLs
    const invalidUrls = urlsArray.filter(
      (url) => !url.startsWith("http://") && !url.startsWith("https://")
    );
    if (invalidUrls.length > 0) {
      throw new Error(
        `Invalid URLs detected. Please include http:// or https://: ${invalidUrls.join(", ")}`
      );
    }

    const limit = settings.limit || 20;
    const userId = settings.userId || this.user?.id;
    if (userId) {
      const estimatedCredits = estimateCredits('dataforseo', { count: 1 }, this.markups);
      await checkQuota(userId, estimatedCredits, this._meteringAdapter(), { planContext: this.planContext });
    }

    try {
      const response = await this.apiCall(
        this.siteUrl + '/api/dataforseo/ranking-keywords',
        { urls: urlsArray, limit }
      );
      const data = JSON.parse(response);
      if (data.error) {
        throw new Error(data.error);
      }
      const credits = calculateCredits('dataforseo', { count: 1 }, this.markups);
      const costUSD = credits * 0.10;
      if (userId && credits > 0) {
        await logUsage(userId, 'dataforseo', 'dataforseo', { method: 'DataForSEORankingKeywords' }, credits, costUSD, this._meteringAdapter());
        await deductCredits(userId, credits, this._meteringAdapter());
      }
      return data;
    } catch (error) {
      this.log("DataForSEORankingKeywords error:", error);
      throw error;
    }
  }

  /**
   * Fetch Relevant Pages from DataForSEO Labs via playground.
   * @param {string} url - Seed URL (domain or full URL)
   * @param {number} locationCode - Location code (default 2840)
   * @param {number} limit - Max items (default 50)
   * @returns {Promise<{ items: Array, cost: number, success: boolean }>}
   */
  async _fetchDataForSEORelevantPages(url, locationCode, limit) {
    const payload = [{
      target: "{url}",
      location_code: locationCode,
      language_name: "English",
      order_by: ["metrics.organic.etv,desc"],
      limit,
    }];
    const response = await this.apiCall(this.siteUrl + '/api/dataforseo/playground', {
      endpoint: "/v3/dataforseo_labs/google/relevant_pages/live",
      payload,
      seedKeyword: null,
      seedUrl: url,
      method: "POST",
    });
    const data = JSON.parse(response);
    const items = data.response?.tasks?.[0]?.result?.[0]?.items || [];
    const cost = Number(data.response?.cost) || 0;
    return { items, cost, success: data.success };
  }

  /**
   * Fetch Ranked Keywords from DataForSEO Labs via playground (returnRaw for serp_item.url).
   * @param {string} url - Seed URL (domain or full URL)
   * @param {number} locationCode - Location code
   * @returns {Promise<{ items: Array, cost: number, success: boolean }>}
   */
  async _fetchDataForSEORankedKeywords(url, locationCode) {
    const payload = [{
      target: "{url}",
      location_code: locationCode,
      language_name: "English",
      limit: 500,
      load_rank_absolute: true,
      historical_serp_mode: "live",
      order_by: ["keyword_data.keyword_info.search_volume,DESC", "ranked_serp_element.serp_item.rank_absolute,ASC"],
      filters: [["ranked_serp_element.serp_item.rank_absolute", "<=", 20]],
    }];
    const response = await this.apiCall(this.siteUrl + '/api/dataforseo/playground', {
      endpoint: "/v3/dataforseo_labs/google/ranked_keywords/live",
      payload,
      seedKeyword: null,
      seedUrl: url,
      method: "POST",
      returnRaw: true,
    });
    const data = JSON.parse(response);
    const items = data.response?.tasks?.[0]?.result?.[0]?.items || [];
    const cost = Number(data.response?.cost) || 0;
    return { items, cost, success: data.success };
  }

  /**
   * Extract unique page URLs from ranked keywords items (serp_item.url).
   * @param {Array} items - Ranked keywords result items
   * @param {number} max - Max URLs to return (default 100)
   * @returns {string[]}
   */
  _extractPageUrlsFromRankedKeywords(items, max = 100) {
    const urls = [...new Set(
      (items || []).map(it => it.ranked_serp_element?.serp_item?.url).filter(Boolean)
    )];
    return urls.slice(0, max);
  }

  /**
   * Fetch Bulk Traffic Estimation from DataForSEO Labs via playground.
   * @param {string[]} pageUrls - Page URLs to estimate
   * @param {number} locationCode - Location code
   * @returns {Promise<{ items: Array, cost: number, success: boolean }>}
   */
  async _fetchDataForSEOBulkTrafficEstimation(pageUrls, locationCode) {
    const payload = [{
      targets: pageUrls,
      location_code: locationCode,
      language_code: "en",
      item_types: ["organic"],
    }];
    const response = await this.apiCall(this.siteUrl + '/api/dataforseo/playground', {
      endpoint: "/v3/dataforseo_labs/google/bulk_traffic_estimation/live",
      payload,
      seedKeyword: null,
      seedUrl: null,
      method: "POST",
    });
    const data = JSON.parse(response);
    const rawItems = data.response?.tasks?.[0]?.result?.[0]?.items || [];
    const items = rawItems.sort((a, b) => (b.metrics?.organic?.etv ?? 0) - (a.metrics?.organic?.etv ?? 0));
    const cost = Number(data.response?.cost) || 0;
    return { items, cost, success: data.success };
  }

  /**
   * Get top traffic pages for a domain. Tries Relevant Pages first; if empty, falls back to
   * Ranked Keywords (to discover page URLs) then Bulk Traffic Estimation with those URLs.
   * Credits use calculateCredits('dataforseo', { count }) based on API call count (1, 2, or 3).
   * @param {string} url - Competitor domain or full URL (e.g. https://example.com)
   * @param {object} settings - Optional: { limit: number (default 50), locationCode: number (default 2840), maxFallbackUrls: number (default 100) }
   * @returns {Promise<object>} { items: Array<{ page_address?: string, target?: string, metrics: { organic: { etv, count?, pos_1?, ... } } }>, fromFallback: boolean, success: boolean }
   */
  async DataForSEOTopTrafficPages(url, settings = {}) {
    const urlStr = typeof url === 'string' ? url.trim() : '';
    if (!urlStr) {
      throw new Error("URL is required");
    }
    if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
      throw new Error("URL must include http:// or https://");
    }

    const locationCode = settings.locationCode ?? 2840;
    const limit = settings.limit ?? 50;
    const maxFallbackUrls = settings.maxFallbackUrls ?? 100;
    const userId = settings.userId || this.user?.id;

    if (userId) {
      const estimatedCredits = estimateCredits('dataforseo', { count: 3 }, this.markups);
      await checkQuota(userId, estimatedCredits, this._meteringAdapter(), { planContext: this.planContext });
    }

    try {
      const relevantPages = await this._fetchDataForSEORelevantPages(urlStr, locationCode, limit);

      if (relevantPages.items.length > 0) {
        const credits = calculateCredits('dataforseo', { count: 1 }, this.markups);
        const costUSD = credits * 0.10;
        if (userId && credits > 0) {
          await logUsage(userId, 'dataforseo', 'dataforseo', { method: 'DataForSEOTopTrafficPages' }, credits, costUSD, this._meteringAdapter());
          await deductCredits(userId, credits, this._meteringAdapter());
        }
        return { items: relevantPages.items, fromFallback: false, success: relevantPages.success };
      }

      const rankedKeywords = await this._fetchDataForSEORankedKeywords(urlStr, locationCode);
      const pageUrls = this._extractPageUrlsFromRankedKeywords(rankedKeywords.items, maxFallbackUrls);

      if (pageUrls.length === 0) {
        const credits = calculateCredits('dataforseo', { count: 2 }, this.markups);
        const costUSD = credits * 0.10;
        if (userId && credits > 0) {
          await logUsage(userId, 'dataforseo', 'dataforseo', { method: 'DataForSEOTopTrafficPages' }, credits, costUSD, this._meteringAdapter());
          await deductCredits(userId, credits, this._meteringAdapter());
        }
        return { items: [], fromFallback: false, success: false };
      }

      const bulkTraffic = await this._fetchDataForSEOBulkTrafficEstimation(pageUrls, locationCode);
      const credits = calculateCredits('dataforseo', { count: 3 }, this.markups);
      const costUSD = credits * 0.10;
      if (userId && credits > 0) {
        await logUsage(userId, 'dataforseo', 'dataforseo', { method: 'DataForSEOTopTrafficPages' }, credits, costUSD, this._meteringAdapter());
        await deductCredits(userId, credits, this._meteringAdapter());
      }
      return { items: bulkTraffic.items, fromFallback: true, success: bulkTraffic.success };
    } catch (error) {
      this.log("DataForSEOTopTrafficPages error:", error);
      throw error;
    }
  }

  /**
   * Get related keywords for a seed keyword
   * @param {string} keywords - Keywords separated by newlines, commas, or semicolons
   * @param {object} settings - Optional settings: { depth: number (0-4, default: 0), limit: number (1-1000, default: 100) }
   * @returns {Promise<object>} Results with related keywords
   */
  /**
   * Evaluate prompts against article text using vector similarity (vectorize-test workflow)
   * @param {string} articleText - The article content as plain text
   * @param {string|string[]} prompts - Single prompt or array of prompts to evaluate
   * @param {object} options - Configuration options
   * @param {string} options.chunking - Chunking method: "byParagraph", "byHeading", or "fixedTokens"
   * @param {number} options.chunkSizeWords - Words per chunk for fixedTokens (default: 250)
   * @param {number} options.overlapWords - Overlap words for fixedTokens (default: 50)
   * @param {number} options.topK - Number of top matches to return (default: 5)
   * @param {boolean} options.batchMode - Generate all embeddings in batch (default: true)
   * @returns {Promise<object>} Evaluation results with timing and scores
   */
  async evaluatePromptsWithVectors(articleText, prompts, options = {}) {

    const {
      chunking = "byParagraph",
      chunkSizeWords = 250,
      overlapWords = 50,
      topK = 5,
      batchMode = true,
    } = options;

    const promptsArray = Array.isArray(prompts) ? prompts : [prompts];
    const startTime = Date.now();
    const timing = {
      chunking: 0,
      embedding: 0,
      similarity: 0,
      total: 0,
    };

    // Helper functions
    const normalizeText = (text) => {
      return text.replace(/\s+/g, " ").replace(/\n\s*\n/g, "\n\n").trim();
    };

    const chunkByParagraph = (text) => {
      const normalized = normalizeText(text);
      const chunks = normalized
        .split(/\n\s*\n/)
        .map(chunk => chunk.trim())
        .filter(chunk => chunk.length > 0);
      return chunks.length >= 3 ? chunks : null;
    };

    const chunkByFixedTokens = (text, chunkSize, overlap) => {
      const normalized = normalizeText(text);
      const words = normalized.split(/\s+/);
      const chunks = [];
      let i = 0;
      while (i < words.length) {
        const chunkWords = words.slice(i, i + chunkSize);
        chunks.push(chunkWords.join(" "));
        if (i + chunkSize >= words.length) break;
        i += chunkSize - overlap;
      }
      return chunks;
    };

    const chunkByHeading = (text) => {
      const normalized = normalizeText(text);
      const lines = normalized.split("\n");
      const chunks = [];
      let currentChunk = [];
      for (const line of lines) {
        if (/^#{1,6}\s/.test(line.trim())) {
          if (currentChunk.length > 0) {
            chunks.push(currentChunk.join("\n").trim());
            currentChunk = [];
          }
        }
        currentChunk.push(line);
      }
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join("\n").trim());
      }
      return chunks.length >= 1 ? chunks : null;
    };

    const extractKeywords = (prompt) => {
      const stopwords = new Set([
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
        "been", "being", "have", "has", "had", "do", "does", "did", "will",
        "would", "should", "could", "may", "might", "must", "can", "this",
        "that", "these", "those", "i", "you", "he", "she", "it", "we", "they",
        "what", "which", "who", "when", "where", "why", "how", "if", "then",
        "else", "than", "so", "not", "no", "yes", "my", "your", "his", "her",
        "its", "our", "their", "me", "him", "us", "them"
      ]);
      const words = prompt
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter(word => word.length >= 3 && !stopwords.has(word));
      const freq = {};
      for (const word of words) {
        freq[word] = (freq[word] || 0) + 1;
      }
      return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([word]) => word);
    };

    const checkPhraseHit = (prompt, text) => {
      const promptLower = prompt.toLowerCase();
      const textLower = text.toLowerCase();
      const words = promptLower.split(/\s+/).filter(w => w.length >= 2);
      for (let i = 0; i < words.length - 1; i++) {
        const phrase = `${words[i]} ${words[i + 1]}`;
        if (textLower.includes(phrase)) return true;
      }
      return false;
    };

    const cosineSimilarity = (vecA, vecB) => {
      if (vecA.length !== vecB.length) {
        throw new Error("Vectors must have same length");
      }
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
      }
      if (normA === 0 || normB === 0) return 0;
      return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    };

    // 1. Chunking
    const chunkingStart = Date.now();
    let chunks = [];
    if (chunking === "byParagraph") {
      chunks = chunkByParagraph(articleText) || chunkByFixedTokens(articleText, chunkSizeWords, overlapWords);
    } else if (chunking === "byHeading") {
      chunks = chunkByHeading(articleText) || chunkByFixedTokens(articleText, chunkSizeWords, overlapWords);
    } else if (chunking === "fixedTokens") {
      chunks = chunkByFixedTokens(articleText, chunkSizeWords, overlapWords);
    } else {
      throw new Error(`Unknown chunking method: ${chunking}`);
    }
    if (chunks.length === 0) {
      throw new Error("Failed to chunk article text");
    }
    timing.chunking = Date.now() - chunkingStart;

    // 2. Generate embeddings using centralized monkey method
    const embeddingStart = Date.now();
    let promptVectors = [];
    let chunkVectors = [];
    
    if (batchMode && promptsArray.length > 1) {
      // Batch mode: generate all embeddings at once
      const allTexts = [...promptsArray, ...chunks];
      const allEmbeddings = await this.generateEmbeddings(allTexts, { model: "text-embedding-3-small" });
      promptVectors = allEmbeddings.slice(0, promptsArray.length);
      chunkVectors = allEmbeddings.slice(promptsArray.length);
    } else {
      // Sequential mode: generate chunk embeddings, then prompt embeddings
      chunkVectors = await this.generateEmbeddings(chunks, { model: "text-embedding-3-small" });
      
      // Generate prompt embeddings one at a time
      for (const promptText of promptsArray) {
        const embedding = await this.generateEmbeddings(promptText, { model: "text-embedding-3-small" });
        promptVectors.push(embedding);
      }
    }
    timing.embedding = Date.now() - embeddingStart;

    // 3. Evaluate each prompt
    const similarityStart = Date.now();
    const results = promptsArray.map((promptText, index) => {
      const promptVec = promptVectors[index];
      const similarities = chunkVectors.map((chunkVec, idx) => ({
        index: idx,
        chunk: chunks[idx],
        similarity: cosineSimilarity(promptVec, chunkVec),
      }));
      
      similarities.sort((a, b) => b.similarity - a.similarity);
      const topMatches = similarities.slice(0, topK);
      
      const maxSim = similarities[0]?.similarity || 0;
      const meanTopK = topMatches.reduce((sum, m) => sum + m.similarity, 0) / topMatches.length;
      
      // Score calculation: 0.65 * maxSim + 0.35 * meanTopK, scaled to 0-100
      const rawScore = 0.65 * maxSim + 0.35 * meanTopK;
      const score = Math.round(Math.max(0, Math.min(100, rawScore * 100)));
      
      // Banding
      let band;
      if (score >= 75) {
        band = "High";
      } else if (score >= 55) {
        band = "Mid";
      } else {
        band = "Low";
      }
      
      const keywords = extractKeywords(promptText);
      const topKText = topMatches.map(m => m.chunk).join(" ");
      const foundTerms = keywords.filter(keyword =>
        topKText.toLowerCase().includes(keyword.toLowerCase())
      );
      const missingTerms = keywords.filter(keyword =>
        !topKText.toLowerCase().includes(keyword.toLowerCase())
      );
      
      return {
        prompt: promptText,
        score,
        band,
        metrics: {
          maxSimilarity: maxSim,
          meanTopKSimilarity: meanTopK,
          chunksCount: chunks.length,
          topK,
        },
        topMatches: topMatches.map(m => ({
          rank: topMatches.indexOf(m) + 1,
          similarity: parseFloat(m.similarity.toFixed(4)),
          chunk: m.chunk,
          snippet: m.chunk.substring(0, 240) + (m.chunk.length > 240 ? "..." : ""),
        })),
        diagnostics: {
          keywords,
          foundTerms,
          missingTerms,
          phraseHit: checkPhraseHit(promptText, chunks.join(" ")),
          suggestion: missingTerms.length > 0
            ? `Consider adding a section that explicitly addresses: ${missingTerms.join(", ")}`
            : null,
        },
      };
    });
    
    timing.similarity = Date.now() - similarityStart;
    timing.total = Date.now() - startTime;

    // Calculate total credits from embeddings (stored in lastCredits after each embedding call)
    // Since generateEmbeddings doesn't return credits directly, we need to estimate
    // Total tokens = prompts + chunks (approximate: ~1 token per 4 characters)
    const totalEmbeddingTokens = Math.ceil(
      (promptsArray.reduce((sum, p) => sum + p.length, 0) + 
       chunks.reduce((sum, c) => sum + c.length, 0)) / 4
    );
    const totalCredits = calculateCredits('openai_embedding', {
      tokens: totalEmbeddingTokens
    }, this.markups);

    return {
      results,
      credits: totalCredits,
      timing: {
        total: timing.total,
        chunking: timing.chunking,
        embedding: timing.embedding,
        similarity: timing.similarity,
        averagePerPrompt: timing.total / promptsArray.length,
      },
      chunksCount: chunks.length,
    };
  }

  // ===== IMAGE GENERATION METHODS =====

  /**
   * Generate images using OpenAI DALL-E API with model fallback and retry logic
   * @param {string} prompt - Image generation prompt
   * @param {Object} options - Generation options
   * @param {string[]} options.models - Model fallback chain (default: AI_MODELS.IMAGE)
   * @param {string} options.size - Image size (default: "1024x1024")
   * @param {string} options.quality - Image quality "standard" or "hd" (default: "standard")
   * @param {string} options.responseFormat - "url" or "b64_json" (default: "b64_json")
   * @param {number} options.maxRetries - Max retries per model (default: 3)
   * @returns {Promise<Object>} { images: Array<{url, b64_json, revised_prompt}>, model, requestId }
   */
  async generateImage(prompt, options = {}) {
    const requestId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.log(`[Monkey.generateImage] ID: ${requestId} | Starting image generation`);
    const userId = options.userId || this.user?.id;
    if (userId) {
      const estimatedCredits = estimateCredits('openai_image', {}, this.markups);
      await checkQuota(userId, estimatedCredits, this._meteringAdapter(), { planContext: this.planContext });
    }
    
    if (!prompt || !prompt.trim()) {
      throw new Error('Image prompt is required');
    }

    // Get options with defaults
    const AI_MODELS_CONFIG = (await import("@/config/ai-models")).default;
    const models = options.models || AI_MODELS_CONFIG.IMAGE || ['dall-e-3'];
    const size = options.size || "1024x1024";
    const quality = options.quality || "standard";
    const responseFormat = options.responseFormat || "b64_json";
    const maxRetries = options.maxRetries || 3;

    // Get API key
    const apiKey = this.getOPENAIKEY();
    if (!apiKey) {
      throw new Error("No OpenAI API key found. Set OPENAI_API_KEY in environment.");
    }

    this.log(`[Monkey.generateImage] ID: ${requestId} | Models: ${models.join(', ')}`);
    this.log(`[Monkey.generateImage] ID: ${requestId} | Prompt length: ${prompt.length}`);

    // Try each model in fallback chain
    let lastError;
    
    for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
      const model = models[modelIndex];
      const isLastModel = modelIndex === models.length - 1;
      
      this.log(`[Monkey.generateImage] ID: ${requestId} | Trying model ${modelIndex + 1}/${models.length}: ${model}`);
      
      try {
        // Build request body
        const isGptImageModel = model.startsWith('gpt-image');
        const requestBody = isGptImageModel
          ? {
              model: model,
              prompt: prompt.trim(),
            }
          : {
              model: model,
              prompt: prompt.trim(),
              n: 1,
              size: size,
              quality: quality,
              response_format: responseFormat,
            };

        // Retry loop for current model
        let attempt = 0;
        while (attempt <= maxRetries) {
          try {
            this.log(`[Monkey.generateImage] ID: ${requestId} | Model: ${model} | Attempt ${attempt + 1}/${maxRetries + 1}`);
            
            const response = await fetch("https://api.openai.com/v1/images/generations", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
              },
              body: JSON.stringify(requestBody),
            });

            const openaiRequestId = response.headers.get("x-request-id") || response.headers.get("request-id");
            this.log(`[Monkey.generateImage] ID: ${requestId} | Response: ${response.status} | OpenAI ID: ${openaiRequestId || 'N/A'}`);

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              const errorMessage = errorData.error?.message || response.statusText;
              
              // Check if retryable
              const isRetryable = [429, 500, 502, 503, 504].includes(response.status);
              const isNonRetryable = [400, 401, 403, 404].includes(response.status);
              
              if (isNonRetryable || (response.status === 400 && !isLastModel)) {
                // Try next model for client errors (might be model-specific issue)
                throw new Error(`Model ${model} failed: ${errorMessage}`);
              }
              
              if (isRetryable && attempt < maxRetries) {
                // Retry with backoff
                const backoffDelay = 500 * Math.pow(2, attempt) + Math.random() * 250;
                this.log(`[Monkey.generateImage] ID: ${requestId} | Retrying after ${Math.round(backoffDelay)}ms`);
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
                attempt++;
                continue;
              }
              
              throw new Error(`OpenAI API error (${model}): ${errorMessage}`);
            }

            // Success - parse response
            const data = await response.json();
            const images = data.data || [];
            
            if (images.length === 0) {
              throw new Error("No images generated");
            }

            // Format response
            const formattedImages = images.map(img => ({
              url: img.url || (img.b64_json ? `data:image/png;base64,${img.b64_json}` : null),
              b64_json: img.b64_json || null,
              revised_prompt: img.revised_prompt || prompt.trim(),
            }));

            this.log(`[Monkey.generateImage] ID: ${requestId} | SUCCESS | Model: ${model} | Images: ${formattedImages.length}`);

            // Calculate credits for image generation
            const credits = calculateCredits('openai_image', {
              model: model,
              quality: quality,
              count: formattedImages.length
            }, this.markups);
            const costUSD = credits * 0.10;
            if (userId && credits > 0) {
              await logUsage(userId, 'openai', 'openai_image', {
                method: 'generateImage',
                model: model,
                requestId
              }, credits, costUSD, this._meteringAdapter());
              await deductCredits(userId, credits, this._meteringAdapter());
            }

            return {
              images: formattedImages,
              model: model,
              requestId: requestId,
              openaiRequestId: openaiRequestId,
              credits: credits,
            };

          } catch (attemptError) {
            if (attempt >= maxRetries) {
              throw attemptError;
            }
            
            // Network error - retry
            const backoffDelay = 500 * Math.pow(2, attempt) + Math.random() * 250;
            this.log(`[Monkey.generateImage] ID: ${requestId} | Network error, retrying after ${Math.round(backoffDelay)}ms`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            attempt++;
          }
        }
        
      } catch (modelError) {
        this.log(`[Monkey.generateImage] ID: ${requestId} | Model ${model} failed: ${modelError.message}`);
        lastError = modelError;
        
        if (!isLastModel) {
          this.log(`[Monkey.generateImage] ID: ${requestId} | Trying next model in fallback chain`);
          continue;
        }
        
        // Last model failed
        throw modelError;
      }
    }
    
    // All models failed
    throw lastError || new Error("All image generation models failed");
  }

  /**
   * Generate embeddings using OpenAI embeddings API
   * @param {string|string[]} texts - Single text or array of texts
   * @param {Object} options - Embedding options
   * @param {string} options.model - Embedding model (default: "text-embedding-3-small")
   * @returns {Promise<number[]|number[][]>} Single embedding or array of embeddings
   */
  async generateEmbeddings(texts, options = {}) {
    this.log('[Monkey.generateEmbeddings] Starting embedding generation');
    const userId = options.userId || this.user?.id;
    if (userId) {
      const estimatedCredits = estimateCredits('openai_embedding', { tokens: 1000 }, this.markups);
      await checkQuota(userId, estimatedCredits, this._meteringAdapter(), { planContext: this.planContext });
    }
    
    const isArray = Array.isArray(texts);
    const input = isArray ? texts : [texts];
    const model = options.model || "text-embedding-3-small";

    if (input.length === 0) {
      throw new Error('At least one text is required for embedding');
    }

    // Get API key
    const apiKey = this.getOPENAIKEY();
    if (!apiKey) {
      throw new Error("No OpenAI API key found. Set OPENAI_API_KEY in environment.");
    }

    this.log(`[Monkey.generateEmbeddings] Model: ${model} | Texts: ${input.length}`);

    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          input: input,
          encoding_format: "float",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || response.statusText;
        throw new Error(`OpenAI embeddings API error: ${errorMessage}`);
      }

      const data = await response.json();
      const embeddings = data.data.map(item => item.embedding);
      
      // Calculate total tokens used (approximate: ~1 token per 4 characters for embeddings)
      const totalTokens = data.usage?.total_tokens || 
        (input.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0));

      // Calculate credits
      const credits = calculateCredits('openai_embedding', {
        tokens: totalTokens
      }, this.markups);
      this.lastCredits = credits;
      const costUSD = credits * 0.10;
      if (userId && credits > 0) {
        await logUsage(userId, 'openai', 'openai_embedding', {
          method: 'generateEmbeddings',
          model,
          prompt_tokens: 0,
          completion_tokens: 0,
          tokens: totalTokens
        }, credits, costUSD, this._meteringAdapter());
        await deductCredits(userId, credits, this._meteringAdapter());
      }

      this.log(`[Monkey.generateEmbeddings] SUCCESS | Embeddings generated: ${embeddings.length} | Credits: ${credits}`);

      // Return single embedding or array (credits stored in monkey instance for this call)
      // Note: For embeddings, credits are logged but not returned since method returns arrays/numbers
      // If you need credits, use returnMetadata option or check monkey instance
      return isArray ? embeddings : embeddings[0];

    } catch (error) {
      this.log(`[Monkey.generateEmbeddings] Error: ${error.message}`);
      throw new Error(`Failed to generate embeddings: ${error.message}`);
    }
  }

  // ===== V0 API METHODS =====

  /**
   * Create v0 chat only – no polling, no credit deduction.
   * Use v0Fetch(chatId) later to check for files (credits deducted there).
   * @param {string} prompt - Generation prompt
   * @param {Object} options - { userId }
   * @returns {Promise<Object>} { success: true, chatId } or { success: false, error }
   */
  async v0CreateChat(prompt, options = {}) {
    this.log('[Monkey.v0CreateChat] Creating v0 chat (no polling)');
    const userId = options.userId || this.user?.id;
    if (userId) {
      const estimatedCredits = estimateCredits('v0', {}, this.markups);
      await checkQuota(userId, estimatedCredits, this._meteringAdapter(), { planContext: this.planContext });
    }

    if (!prompt || !prompt.trim()) {
      this.log('[Monkey.v0CreateChat] ERROR: Missing prompt');
      return { success: false, error: 'v0 generation prompt is required' };
    }

    const apiKey = process.env.V0_API_KEY;
    if (!apiKey) {
      this.log('[Monkey.v0CreateChat] ERROR: Missing V0_API_KEY');
      return { success: false, error: 'V0_API_KEY not configured.' };
    }

    try {
      const v0Module = await import('v0-sdk');
      const clientConfig = {
        apiKey,
        baseUrl: 'https://api.v0.dev/v1',
        fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(600000) }),
      };
      let v0;
      if (v0Module.createClient) {
        v0 = v0Module.createClient(clientConfig);
      } else if (v0Module.default?.createClient) {
        v0 = v0Module.default.createClient(clientConfig);
      } else if (v0Module.v0) {
        v0 = v0Module.v0;
      } else if (v0Module.default) {
        v0 = v0Module.default;
      } else {
        throw new Error('Could not find v0 client in v0-sdk module');
      }

      const projectId = process.env.V0_FOLDER_ID || process.env.v0_FOLDER_ID;
      const chat = await v0.chats.create({
        message: prompt.trim(),
        ...(projectId && { projectId }),
      });
      const chatId = chat?.id ?? chat?.chatId;
      if (!chatId) {
        this.log('[Monkey.v0CreateChat] No chat id in response:', JSON.stringify(chat).slice(0, 200));
        return { success: false, error: 'v0 returned no chat id', raw: chat };
      }
      this.log('[Monkey.v0CreateChat] Chat created:', chatId);
      return { success: true, chatId };
    } catch (error) {
      this.log('[Monkey.v0CreateChat] Error:', error.message);
      return {
        success: false,
        error: `v0 chat creation failed: ${error.message}`,
        details: { name: error.name, message: error.message, code: error.code },
      };
    }
  }

  /**
   * Create v0 chat with file attachments – no polling.
   * Init with files, send prompt, return chatId. Use v0Fetch(chatId) later for polling.
   * @param {string} prompt - Generation prompt
   * @param {Array<{ name: string, content: string }>} files - Files to attach
   * @param {Object} options
   *   onChatIdReady: called after init, before sendMessage. Lets callers persist chatId early.
   *   returnAfterInit: when true, returns { success, chatId, sendMessage } immediately after init
   *     without awaiting sendMessage. The caller is responsible for invoking sendMessage() in a
   *     background task (e.g. Next.js after()). sendMessage accepts an optional onError(err) cb.
   * @returns {Promise<Object>} { success: true, chatId } or { success: true, chatId, sendMessage } or { success: false, error }
   */
  async v0CreateChatWithFiles(prompt, files, options = {}) {
    this.log('[Monkey.v0CreateChatWithFiles] Creating v0 chat with files (no polling)');
    const userId = options.userId || this.user?.id;
    if (userId) {
      const estimatedCredits = estimateCredits('v0', {}, this.markups);
      await checkQuota(userId, estimatedCredits, this._meteringAdapter(), { planContext: this.planContext });
    }

    if (!prompt || !prompt.trim()) {
      this.log('[Monkey.v0CreateChatWithFiles] ERROR: Missing prompt');
      return { success: false, error: 'v0 generation prompt is required' };
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      this.log('[Monkey.v0CreateChatWithFiles] ERROR: files array is required');
      return { success: false, error: 'v0 file-based chat requires at least one file' };
    }

    const apiKey = process.env.V0_API_KEY;
    if (!apiKey) {
      this.log('[Monkey.v0CreateChatWithFiles] ERROR: Missing V0_API_KEY');
      return { success: false, error: 'V0_API_KEY not configured.' };
    }

    let chatIdFromInit = null;
    try {
      const v0Module = await import('v0-sdk');
      const clientConfig = {
        apiKey,
        baseUrl: 'https://api.v0.dev/v1',
        fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(600000) }),
      };
      let v0;
      if (v0Module.createClient) {
        v0 = v0Module.createClient(clientConfig);
      } else if (v0Module.default?.createClient) {
        v0 = v0Module.default.createClient(clientConfig);
      } else if (v0Module.v0) {
        v0 = v0Module.v0;
      } else if (v0Module.default) {
        v0 = v0Module.default;
      } else {
        throw new Error('Could not find v0 client in v0-sdk module');
      }

      const initFiles = files.map(f => ({
        name: f.name || 'unnamed',
        content: typeof f.content === 'string' ? f.content : '',
      })).filter(f => f.name && f.content.length > 0);

      if (initFiles.length === 0) {
        return { success: false, error: 'No valid files (name + content) to send to v0' };
      }

      const projectId = process.env.V0_FOLDER_ID || process.env.v0_FOLDER_ID;
      this.log('[Monkey.v0CreateChatWithFiles] Calling v0.chats.init with', initFiles.length, 'files');
      const initChat = await v0.chats.init({
        type: 'files',
        files: initFiles,
        ...(projectId && { projectId }),
      });

      chatIdFromInit = initChat?.id ?? initChat?.chatId ?? null;
      this.log('[Monkey.v0CreateChatWithFiles] Chat initialized, id:', chatIdFromInit);

      const onChatIdReady = options.onChatIdReady;
      if (typeof onChatIdReady === 'function' && chatIdFromInit) {
        try {
          await Promise.resolve(onChatIdReady(String(chatIdFromInit)));
        } catch (err) {
          this.log('[Monkey.v0CreateChatWithFiles] onChatIdReady error:', err?.message);
        }
      }

      // returnAfterInit: return immediately with a sendMessage closure for background execution
      if (options.returnAfterInit && chatIdFromInit) {
        const trimmedPrompt = prompt.trim();
        const logFn = this.log.bind(this);
        const sendMessage = async ({ onError } = {}) => {
          logFn('[Monkey.v0CreateChatWithFiles/sendMessage] Sending message, chatId:', chatIdFromInit, 'prompt length:', trimmedPrompt.length);
          try {
            await v0.chats.sendMessage({ chatId: chatIdFromInit, message: trimmedPrompt });
            logFn('[Monkey.v0CreateChatWithFiles/sendMessage] Done, chatId:', chatIdFromInit);
          } catch (err) {
            logFn('[Monkey.v0CreateChatWithFiles/sendMessage] Error:', err?.message);
            if (typeof onError === 'function') {
              try { await onError(err); } catch (_) { /* ignore callback errors */ }
            }
          }
        };
        return { success: true, chatId: chatIdFromInit, sendMessage };
      }

      this.log('[Monkey.v0CreateChatWithFiles] Sending message (prompt length:', prompt.length, ')');
      await v0.chats.sendMessage({
        chatId: chatIdFromInit,
        message: prompt.trim(),
      });

      this.log('[Monkey.v0CreateChatWithFiles] Chat created:', chatIdFromInit);
      return { success: true, chatId: chatIdFromInit };
    } catch (error) {
      this.log('[Monkey.v0CreateChatWithFiles] Error:', error.message);
      const status = error?.status ?? error?.statusCode ?? error?.code ?? error?.response?.status ?? error?.response?.statusCode;
      const msg = (error?.message || '').toLowerCase();
      const isTerminal = status === 404 || status === 410 ||
        /deleted|not found|does not exist/.test(msg);
      let chatId = chatIdFromInit || null;
      if (!chatId && !isTerminal) {
        chatId = error?.chatId ?? error?.response?.chatId ?? error?.response?.data?.chatId ?? null;
      }
      this.log('[Monkey.v0CreateChatWithFiles] error shape', {
        keys: error && typeof error === 'object' ? Object.keys(error) : [],
        status,
        isTerminal,
        hasChatIdFromInit: !!chatIdFromInit,
        hasChatIdFromError: !!(error?.chatId ?? error?.response?.chatId ?? error?.response?.data?.chatId),
      });
      return {
        success: false,
        error: `v0 chat creation with files failed: ${error.message}`,
        details: { name: error.name, message: error.message, code: error.code },
        ...(chatId && { chatId }),
      };
    }
  }

  /**
   * Send a message to an existing v0 chat (fire-and-forget friendly).
   * Used when a chatId was already obtained via v0CreateChatWithFiles(returnAfterInit:true)
   * but the sendMessage step needs to be retried (e.g. stuck-kick from outline-status).
   * @param {string} chatId
   * @param {string} prompt
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async v0SendMessage(chatId, prompt) {
    this.log('[Monkey.v0SendMessage] chatId:', chatId, 'prompt length:', prompt?.length ?? 0);
    if (!chatId || !prompt?.trim()) {
      return { success: false, error: 'chatId and prompt are required' };
    }
    const apiKey = process.env.V0_API_KEY;
    if (!apiKey) return { success: false, error: 'V0_API_KEY not configured.' };
    try {
      const v0Module = await import('v0-sdk');
      const clientConfig = {
        apiKey,
        baseUrl: 'https://api.v0.dev/v1',
        fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(600000) }),
      };
      let v0;
      if (v0Module.createClient) {
        v0 = v0Module.createClient(clientConfig);
      } else if (v0Module.default?.createClient) {
        v0 = v0Module.default.createClient(clientConfig);
      } else if (v0Module.v0) {
        v0 = v0Module.v0;
      } else if (v0Module.default) {
        v0 = v0Module.default;
      } else {
        throw new Error('Could not find v0 client in v0-sdk module');
      }
      await v0.chats.sendMessage({ chatId, message: prompt.trim() });
      this.log('[Monkey.v0SendMessage] Done, chatId:', chatId);
      return { success: true };
    } catch (error) {
      this.log('[Monkey.v0SendMessage] Error:', error?.message);
      return { success: false, error: error?.message || 'v0 sendMessage failed' };
    }
  }

  /**
   * Generate page using v0.dev API with chat creation and polling
   * @param {string} prompt - Generation prompt
   * @param {Object} options - Generation options
   * @param {string} options.competitorContent - Optional competitor content for context
   * @param {number} options.maxWaitTime - Max time to wait for generation (default: 60000ms)
   * @param {number} options.pollingInterval - Polling interval (default: 2000ms)
   * @returns {Promise<Object>} { chatId, demoUrl, htmlContent, files, generationTime, pollingAttempts }
   */
  async v0Generate(prompt, options = {}) {
    this.log('[Monkey.v0Generate] Starting v0 page generation');
    const startTime = Date.now();
    const userId = options.userId || this.user?.id;
    if (userId) {
      const estimatedCredits = estimateCredits('v0', {}, this.markups);
      await checkQuota(userId, estimatedCredits, this._meteringAdapter(), { planContext: this.planContext });
    }
    
    // Validate prompt
    if (!prompt || !prompt.trim()) {
      this.log('[Monkey.v0Generate] ERROR: Missing prompt');
      return {
        success: false,
        error: 'v0 generation prompt is required',
        generationTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      };
    }

    // Check for API key
    const apiKey = process.env.V0_API_KEY;
    if (!apiKey) {
      this.log('[Monkey.v0Generate] ERROR: Missing V0_API_KEY');
      return {
        success: false,
        error: 'V0_API_KEY not configured. Set V0_API_KEY in environment variables.',
        generationTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      };
    }

    // Get options with defaults
    const competitorContent = options.competitorContent || '';
      const maxWaitTime = options.maxWaitTime || 60000; // 60 seconds
      const pollingInterval = options.pollingInterval || 2000; // 2 seconds

    try {
      // Import v0 SDK dynamically
      this.log('[Monkey.v0Generate] Importing v0-sdk module...');
      const v0Module = await import('v0-sdk');
      
      // Debug: Log module structure
      this.log('[Monkey.v0Generate] v0Module keys:', Object.keys(v0Module));
      this.log('[Monkey.v0Generate] Has createClient:', !!v0Module.createClient);
      this.log('[Monkey.v0Generate] Has default:', !!v0Module.default);
      this.log('[Monkey.v0Generate] Has v0:', !!v0Module.v0);
      if (v0Module.default) {
        this.log('[Monkey.v0Generate] default keys:', Object.keys(v0Module.default));
      }
      
      // Use createClient with explicit API key and baseUrl to ensure correct API endpoint
      const clientConfig = {
        apiKey,
        baseUrl: 'https://api.v0.dev/v1', // Explicitly set the correct endpoint
        fetch: (url, init) => {
          // Set 10-minute timeout for fetch requests
          return fetch(url, {
            ...init,
            signal: AbortSignal.timeout(600000), // 10 minutes in milliseconds
          });
        },
      };
      
      let v0;
      if (v0Module.createClient) {
        this.log('[Monkey.v0Generate] Using v0Module.createClient with baseUrl and 10-minute timeout');
        v0 = v0Module.createClient(clientConfig);
      } else if (v0Module.default?.createClient) {
        this.log('[Monkey.v0Generate] Using v0Module.default.createClient with baseUrl');
        v0 = v0Module.default.createClient(clientConfig);
      } else if (v0Module.v0) {
        this.log('[Monkey.v0Generate] WARNING: Using v0Module.v0 (may not have correct endpoint)');
        v0 = v0Module.v0;
      } else if (v0Module.default) {
        this.log('[Monkey.v0Generate] WARNING: Using v0Module.default directly');
        v0 = v0Module.default;
      } else {
        throw new Error('Could not find v0 client in v0-sdk module');
      }
      
      this.log('[Monkey.v0Generate] Client configured with baseUrl: https://api.v0.dev/v1');
      
      this.log('[Monkey.v0Generate] v0 client initialized, type:', typeof v0);
      this.log('[Monkey.v0Generate] v0 client keys:', Object.keys(v0));

      // Build full prompt with context if provided
      let fullPrompt = prompt.trim();
      if (competitorContent) {
        fullPrompt = `${prompt}\n\nContext from competitor pages:\n${competitorContent.substring(0, 15000)}${competitorContent.length > 15000 ? '...(truncated)' : ''}`;
      }

      this.log('[Monkey.v0Generate] Creating chat with v0...');
      this.log('[Monkey.v0Generate] Prompt length:', fullPrompt.length);

      // Create chat
      this.log('[Monkey.v0Generate] Calling v0.chats.create with message...');
      this.log('[Monkey.v0Generate] API Key configured:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NO KEY');
      
      const projectId = process.env.V0_FOLDER_ID || process.env.v0_FOLDER_ID;
      const chat = await v0.chats.create({
        message: fullPrompt,
        ...(projectId && { projectId }),
      });

      this.log('[Monkey.v0Generate] Chat created successfully!');
      this.log('[Monkey.v0Generate] Chat ID:', chat.id);
      this.log('[Monkey.v0Generate] Chat keys:', Object.keys(chat));

      // Wait briefly for initial generation
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Poll for files
      let finalChat = chat;
      let retries = 0;
      const maxRetries = Math.floor(maxWaitTime / pollingInterval);

      while ((!finalChat.files || finalChat.files.length === 0) && retries < maxRetries) {
        const waitTime = Math.min(pollingInterval + (retries * 500), 5000);
        this.log(`[Monkey.v0Generate] Polling attempt ${retries + 1}/${maxRetries}, waiting ${waitTime}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        try {
          finalChat = await v0.chats.getById({ chatId: chat.id });
          this.log(`[Monkey.v0Generate] Poll result - Files: ${finalChat.files?.length || 0}`);
        } catch (pollError) {
          this.log(`[Monkey.v0Generate] Poll error: ${pollError.message}`);
        }
        
        retries++;
      }

      const files = finalChat.files || [];
      this.log('[Monkey.v0Generate] Generation complete, files:', files.length);

      if (files.length === 0) {
        // No files generated, but still calculate credits for the API call attempt
        const estimatedPromptTokens = Math.ceil(fullPrompt.length / 4);
        const credits = calculateCredits('v0', {
          model: 'v0-mini',
          prompt_tokens: estimatedPromptTokens,
          completion_tokens: 0
        }, this.markups);
        const costUSD = credits * 0.10;
        if (userId && credits > 0) {
          await logUsage(userId, 'v0', 'v0', { method: 'v0Generate', model: 'v0-mini', prompt_tokens: estimatedPromptTokens, completion_tokens: 0 }, credits, costUSD, this._meteringAdapter());
          await deductCredits(userId, credits, this._meteringAdapter());
        }
        return {
          success: false,
          error: 'No files generated after polling',
          chatId: chat.id,
          demoUrl: finalChat.demo || finalChat.url,
          files: [],
          pollingAttempts: retries,
          generationTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
          credits: credits,
        };
      }

      // Extract content helper
      const extractContent = (file) => file?.source || file?.content || file?.code || '';
      const extractName = (file) => file?.meta?.file || file?.name || file?.filename || 'unnamed';

      // Find the file whose name contains "index.html" (stable; avoids React/JSX from page.tsx)
      const htmlFile = files.find(f => {
        const fileName = extractName(f);
        return fileName && String(fileName).includes('index.html');
      }) || null;

      const htmlContent = htmlFile ? extractContent(htmlFile) : '';
      const allFiles = files.map(f => ({
        name: extractName(f),
        content: extractContent(f),
        size: extractContent(f).length
      }));

      const generationTime = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

      // Estimate tokens for v0 (approximate: ~1 token per 4 characters)
      // v0 uses v0-mini by default, estimate based on prompt and response
      const estimatedPromptTokens = Math.ceil(fullPrompt.length / 4);
      const estimatedCompletionTokens = Math.ceil(htmlContent.length / 4);
      
      // Calculate credits (v0-mini pricing)
      const credits = calculateCredits('v0', {
        model: 'v0-mini', // Default v0 model
        prompt_tokens: estimatedPromptTokens,
        completion_tokens: estimatedCompletionTokens
      }, this.markups);
      const costUSD = credits * 0.10;
      if (userId && credits > 0) {
        await logUsage(userId, 'v0', 'v0', { method: 'v0Generate', model: 'v0-mini', prompt_tokens: estimatedPromptTokens, completion_tokens: estimatedCompletionTokens }, credits, costUSD, this._meteringAdapter());
        await deductCredits(userId, credits, this._meteringAdapter());
      }

      this.log('[Monkey.v0Generate] SUCCESS | Chat:', chat.id, '| Files:', allFiles.length, '| Time:', generationTime, '| Credits:', credits);

      return {
        success: true,
        chatId: chat.id,
        demoUrl: finalChat.demo || finalChat.url,
        htmlContent: htmlContent,
        files: allFiles,
        generationTime: generationTime,
        pollingAttempts: retries,
        rawChat: finalChat,
        rawFiles: files,
        credits: credits,
      };

    } catch (error) {
      this.log('[Monkey.v0Generate] Error occurred:', error.message);
      this.log('[Monkey.v0Generate] Error name:', error.name);
      this.log('[Monkey.v0Generate] Error code:', error.code);
      this.log('[Monkey.v0Generate] Full error:', error);
      
      // Return error object instead of throwing
      return {
        success: false,
        error: `v0 generation failed: ${error.message}`,
        details: {
          name: error.name,
          message: error.message,
          code: error.code,
        },
        generationTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      };
    }
  }

  async v0SendMessage(chatId, message, options = {}) {
    this.log('[Monkey.v0SendMessage] Continuing chat', chatId);
    const startTime = Date.now();
    const userId = options.userId || this.user?.id;
    if (!chatId) {
      return { success: false, error: 'chatId is required' };
    }
    if (!message || !message.trim()) {
      return { success: false, error: 'Feedback message is required' };
    }

    if (userId) {
      const estimatedCredits = estimateCredits('v0', {}, this.markups);
      await checkQuota(userId, estimatedCredits, this._meteringAdapter(), { planContext: this.planContext });
    }

    const apiKey = process.env.V0_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'V0_API_KEY not configured' };
    }

    const maxWaitTime = options.maxWaitTime || 30 * 60 * 1000;
    const pollingInterval = options.pollingInterval || 2000;

    try {
      const v0Module = await import('v0-sdk');
      const clientConfig = {
        apiKey,
        baseUrl: 'https://api.v0.dev/v1',
        fetch: (url, init) =>
          fetch(url, {
            ...init,
            signal: AbortSignal.timeout(600000),
          }),
      };

      let v0;
      if (v0Module.createClient) {
        v0 = v0Module.createClient(clientConfig);
      } else if (v0Module.default?.createClient) {
        v0 = v0Module.default.createClient(clientConfig);
      } else if (v0Module.v0) {
        v0 = v0Module.v0;
      } else if (v0Module.default) {
        v0 = v0Module.default;
      } else {
        throw new Error('Could not initialize v0 client');
      }

      await v0.chats.sendMessage({
        chatId,
        message: message.trim(),
      });

      const immediateChat = await v0.chats.getById({ chatId });
      if (options.onMessageSent) await options.onMessageSent(immediateChat);

      await new Promise((resolve) => setTimeout(resolve, 3000));

      let finalChat = null;
      let retries = 0;
      const maxRetries = Math.floor(maxWaitTime / pollingInterval);

      while (retries < maxRetries) {
        try {
          finalChat = await v0.chats.getById({ chatId });
          const filesCount = finalChat?.files?.length ?? finalChat?.latestVersion?.files?.length ?? 0;
          if (filesCount > 0) break;
        } catch (pollError) {
          this.log('[Monkey.v0SendMessage] Poll error:', pollError.message);
        }
        retries += 1;
        const waitTime = Math.min(pollingInterval + retries * 500, 5000);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      const rawFiles = finalChat?.files ?? finalChat?.latestVersion?.files ?? [];
      if (!rawFiles || rawFiles.length === 0) {
        return { success: false, error: 'No files returned after applying feedback' };
      }

      const extractContent = (file) => file?.source ?? file?.content ?? file?.code ?? '';
      const extractName = (file) => file?.meta?.file ?? file?.name ?? file?.filename ?? 'unnamed';

      const files = rawFiles.map((file) => ({
        name: extractName(file),
        content: extractContent(file),
        size: extractContent(file).length,
      }));

      // Result HTML: prefer index.html; else any .html not an input file (competitor, current, template, reference)
      let htmlFile = files.find((f) => f.name && String(f.name).toLowerCase().includes('index.html'));
      if (!htmlFile) {
        htmlFile = files.find((f) => {
          const n = (f.name && String(f.name).toLowerCase()) || '';
          return n.includes('.html') && !/competitor|current|template|reference/.test(n);
        });
      }
      const htmlContent = htmlFile?.content ?? '';

      const generationTime = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
      const estimatedPromptTokens = Math.ceil(message.length / 4);
      const estimatedCompletionTokens = Math.ceil(htmlContent.length / 4);
      const credits = calculateCredits('v0', {
        model: 'v0-mini',
        prompt_tokens: estimatedPromptTokens,
        completion_tokens: estimatedCompletionTokens,
      }, this.markups);
      const costUSD = credits * 0.10;
      if (userId && credits > 0) {
        await logUsage(
          userId,
          'v0',
          'v0',
          {
            method: 'v0SendMessage',
            model: 'v0-mini',
            prompt_tokens: estimatedPromptTokens,
            completion_tokens: estimatedCompletionTokens,
          },
          credits,
          costUSD,
          this._meteringAdapter()
        );
        await deductCredits(userId, credits, this._meteringAdapter());
      }

      return {
        success: true,
        chatId,
        demoUrl: finalChat?.demo || finalChat?.url || finalChat?.latestVersion?.demoUrl,
        files,
        htmlContent,
        generationTime,
        pollingAttempts: retries,
        credits,
      };
    } catch (error) {
      this.log('[Monkey.v0SendMessage] Error:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to send feedback to v0 chat',
      };
    }
  }

  /**
   * Generate page using v0.dev API with file-based workflow: init chat with files, send short prompt, poll for output.
   * @param {string} prompt - Short generation prompt (no large inline context; context is in files).
   * @param {Array<{ name: string, content: string }>} files - Files to attach (custom CSS, templates, competitor HTML).
   * @param {Object} options - Generation options
   * @param {number} options.maxWaitTime - Max time to wait for generation (default: 60000ms)
   * @param {number} options.pollingInterval - Polling interval (default: 2000ms)
   * @returns {Promise<Object>} { chatId, demoUrl, htmlContent, files, generationTime, pollingAttempts }
   */
  async v0GenerateWithFiles(prompt, files, options = {}) {
    this.log('[Monkey.v0GenerateWithFiles] Starting v0 file-based generation');
    const startTime = Date.now();
    const userId = options.userId || this.user?.id;
    if (userId) {
      const estimatedCredits = estimateCredits('v0', {}, this.markups);
      await checkQuota(userId, estimatedCredits, this._meteringAdapter(), { planContext: this.planContext });
    }

    if (!prompt || !prompt.trim()) {
      this.log('[Monkey.v0GenerateWithFiles] ERROR: Missing prompt');
      return {
        success: false,
        error: 'v0 generation prompt is required',
        generationTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      };
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      this.log('[Monkey.v0GenerateWithFiles] ERROR: files array is required');
      return {
        success: false,
        error: 'v0 file-based generation requires at least one file',
        generationTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      };
    }

    const apiKey = process.env.V0_API_KEY;
    if (!apiKey) {
      this.log('[Monkey.v0GenerateWithFiles] ERROR: Missing V0_API_KEY');
      return {
        success: false,
        error: 'V0_API_KEY not configured. Set V0_API_KEY in environment variables.',
        generationTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      };
    }

    const maxWaitTime = options.maxWaitTime || 60000;
    const pollingInterval = options.pollingInterval || 2000;

    try {
      this.log('[Monkey.v0GenerateWithFiles] Importing v0-sdk...');
      const v0Module = await import('v0-sdk');

      const clientConfig = {
        apiKey,
        baseUrl: 'https://api.v0.dev/v1',
        fetch: (url, init) => fetch(url, {
          ...init,
          signal: AbortSignal.timeout(600000),
        }),
      };

      let v0;
      if (v0Module.createClient) {
        v0 = v0Module.createClient(clientConfig);
      } else if (v0Module.default?.createClient) {
        v0 = v0Module.default.createClient(clientConfig);
      } else if (v0Module.v0) {
        v0 = v0Module.v0;
      } else if (v0Module.default) {
        v0 = v0Module.default;
      } else {
        throw new Error('Could not find v0 client in v0-sdk module');
      }

      // v0 init expects files: Array<{ name, content } | { name, url }>
      const initFiles = files.map(f => ({
        name: f.name || 'unnamed',
        content: typeof f.content === 'string' ? f.content : '',
      })).filter(f => f.name && f.content.length > 0);

      if (initFiles.length === 0) {
        return {
          success: false,
          error: 'No valid files (name + content) to send to v0',
          generationTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
        };
      }

      const projectId = process.env.V0_FOLDER_ID || process.env.v0_FOLDER_ID;
      this.log('[Monkey.v0GenerateWithFiles] Calling v0.chats.init with', initFiles.length, 'files');
      const initChat = await v0.chats.init({
        type: 'files',
        files: initFiles,
        ...(projectId && { projectId }),
      });

      const chatId = initChat.id;
      this.log('[Monkey.v0GenerateWithFiles] Chat initialized, id:', chatId);

      this.log('[Monkey.v0GenerateWithFiles] Sending message (prompt length:', prompt.length, ')');
      await v0.chats.sendMessage({
        chatId,
        message: prompt.trim(),
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      let finalChat = initChat;
      let retries = 0;
      const maxRetries = Math.floor(maxWaitTime / pollingInterval);

      while ((!finalChat.files || finalChat.files.length === 0) && retries < maxRetries) {
        const waitTime = Math.min(pollingInterval + (retries * 500), 5000);
        this.log(`[Monkey.v0GenerateWithFiles] Poll ${retries + 1}/${maxRetries}, waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        try {
          finalChat = await v0.chats.getById({ chatId });
          const fileCount = finalChat.files?.length ?? finalChat.latestVersion?.files?.length ?? 0;
          this.log(`[Monkey.v0GenerateWithFiles] Poll result - files: ${fileCount}`);
        } catch (pollError) {
          this.log(`[Monkey.v0GenerateWithFiles] Poll error: ${pollError.message}`);
        }
        retries++;
      }

      const rawFiles = finalChat.files ?? finalChat.latestVersion?.files ?? [];
      this.log('[Monkey.v0GenerateWithFiles] Generation complete, raw files:', rawFiles.length);

      const extractContent = (file) => file?.source ?? file?.content ?? file?.code ?? '';
      const extractName = (file) => file?.meta?.file ?? file?.name ?? file?.filename ?? 'unnamed';

      if (rawFiles.length === 0) {
        const estimatedPromptTokens = Math.ceil(prompt.length / 4);
        const credits = calculateCredits('v0', {
          model: 'v0-mini',
          prompt_tokens: estimatedPromptTokens,
          completion_tokens: 0,
        }, this.markups);
        const costUSD = credits * 0.10;
        if (userId && credits > 0) {
          await logUsage(userId, 'v0', 'v0', { method: 'v0GenerateWithFiles', model: 'v0-mini', prompt_tokens: estimatedPromptTokens, completion_tokens: 0 }, credits, costUSD, this._meteringAdapter());
          await deductCredits(userId, credits, this._meteringAdapter());
        }
        return {
          success: false,
          error: 'No files generated after polling',
          chatId,
          demoUrl: finalChat.webUrl ?? finalChat.latestVersion?.demoUrl,
          files: [],
          pollingAttempts: retries,
          generationTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
          credits,
        };
      }

      const htmlFile = rawFiles.find(f => {
        const fileName = extractName(f);
        return fileName && String(fileName).includes('index.html');
      }) || null;
      const htmlContent = htmlFile ? extractContent(htmlFile) : '';
      const allFiles = rawFiles.map(f => ({
        name: extractName(f),
        content: extractContent(f),
        size: extractContent(f).length,
      }));

      const generationTime = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
      const estimatedPromptTokens = Math.ceil(prompt.length / 4);
      const estimatedCompletionTokens = Math.ceil(htmlContent.length / 4);
      const credits = calculateCredits('v0', {
        model: 'v0-mini',
        prompt_tokens: estimatedPromptTokens,
        completion_tokens: estimatedCompletionTokens,
      }, this.markups);
      const costUSD = credits * 0.10;
      if (userId && credits > 0) {
        await logUsage(userId, 'v0', 'v0', { method: 'v0GenerateWithFiles', model: 'v0-mini', prompt_tokens: estimatedPromptTokens, completion_tokens: estimatedCompletionTokens }, credits, costUSD, this._meteringAdapter());
        await deductCredits(userId, credits, this._meteringAdapter());
      }

      this.log('[Monkey.v0GenerateWithFiles] SUCCESS | Chat:', chatId, '| Files:', allFiles.length, '| Time:', generationTime);

      return {
        success: true,
        chatId,
        demoUrl: finalChat.webUrl ?? finalChat.latestVersion?.demoUrl,
        htmlContent,
        files: allFiles,
        generationTime,
        pollingAttempts: retries,
        rawChat: finalChat,
        rawFiles,
        credits,
      };
    } catch (error) {
      this.log('[Monkey.v0GenerateWithFiles] Error:', error.message);
      return {
        success: false,
        error: `v0 generation failed: ${error.message}`,
        details: { name: error.name, message: error.message, code: error.code },
        generationTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      };
    }
  }

  /**
   * Fetch existing v0 chat content
   * @param {string} chatId - v0 chat ID
   * @param {Object} options - Optional { userId }
   * @returns {Promise<Object>} { chatId, htmlContent, files }
   */
  async v0Fetch(chatId, options = {}) {
    this.log('[Monkey.v0Fetch] Fetching chat:', chatId);
    const userId = options.userId || this.user?.id;
    if (userId) {
      const estimatedCredits = calculateCredits('v0', { model: 'v0-mini', prompt_tokens: 0, completion_tokens: 1000 }, this.markups);
      await checkQuota(userId, estimatedCredits, this._meteringAdapter(), { planContext: this.planContext });
    }
    
    // Validate chat ID
    if (!chatId) {
      this.log('[Monkey.v0Fetch] ERROR: Missing chat ID');
      return {
        success: false,
        error: 'Chat ID is required',
      };
    }

    // Check for API key
    const apiKey = process.env.V0_API_KEY;
    if (!apiKey) {
      this.log('[Monkey.v0Fetch] ERROR: Missing V0_API_KEY');
      return {
        success: false,
        error: 'V0_API_KEY not configured. Set V0_API_KEY in environment variables.',
      };
    }

    try {
      // Import v0 SDK dynamically
      this.log('[Monkey.v0Fetch] Importing v0-sdk module...');
      const v0Module = await import('v0-sdk');
      
      // Debug: Log module structure
      this.log('[Monkey.v0Fetch] v0Module keys:', Object.keys(v0Module));
      
      // Use createClient with explicit API key and baseUrl to ensure correct API endpoint
      const clientConfig = {
        apiKey,
        baseUrl: 'https://api.v0.dev/v1', // Explicitly set the correct endpoint
        fetch: (url, init) => {
          // Set 10-minute timeout for fetch requests
          return fetch(url, {
            ...init,
            signal: AbortSignal.timeout(600000), // 10 minutes in milliseconds
          });
        },
      };
      
      let v0;
      if (v0Module.createClient) {
        this.log('[Monkey.v0Fetch] Using v0Module.createClient with baseUrl and 10-minute timeout');
        v0 = v0Module.createClient(clientConfig);
      } else if (v0Module.default?.createClient) {
        this.log('[Monkey.v0Fetch] Using v0Module.default.createClient with baseUrl');
        v0 = v0Module.default.createClient(clientConfig);
      } else if (v0Module.v0) {
        this.log('[Monkey.v0Fetch] WARNING: Using v0Module.v0 (may not have correct endpoint)');
        v0 = v0Module.v0;
      } else if (v0Module.default) {
        this.log('[Monkey.v0Fetch] WARNING: Using v0Module.default directly');
        v0 = v0Module.default;
      } else {
        throw new Error('Could not find v0 client in v0-sdk module');
      }
      
      this.log('[Monkey.v0Fetch] Client configured with baseUrl: https://api.v0.dev/v1');
      
      this.log('[Monkey.v0Fetch] API Key configured:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NO KEY');

      // Fetch chat
      this.log('[Monkey.v0Fetch] Calling v0.chats.get...');
      const chat = await v0.chats.getById({ chatId });
      this.log('[Monkey.v0Fetch] Chat fetched successfully');
      const files = chat.files || [];

      this.log('[Monkey.v0Fetch] Chat fetched, files:', files.length);

      if (files.length === 0) {
        return {
          success: false,
          error: 'No files found in chat',
          chatId: chat.id,
          files: [],
          latestVersionStatus: chat.latestVersion?.status,
          latestVersionUpdatedAt: chat.latestVersion?.updatedAt ?? chat.latestVersion?.createdAt,
        };
      }

      // Extract content helpers
      const extractContent = (file) => file?.source || file?.content || file?.code || '';
      const extractName = (file) => file?.meta?.file || file?.name || file?.filename || 'unnamed';

      // Find the file whose name contains "index.html" (stable; avoids React/JSX from page.tsx)
      const htmlFile = files.find(f => {
        const fileName = extractName(f);
        return fileName && String(fileName).includes('index.html');
      }) || null;

      const htmlContent = htmlFile ? extractContent(htmlFile) : '';
      const allFiles = files.map(f => ({
        name: extractName(f),
        content: extractContent(f),
        size: extractContent(f).length
      }));

      this.log('[Monkey.v0Fetch] SUCCESS | Files:', allFiles.length);

      // v0Fetch is a read operation, minimal cost (no generation)
      // Estimate based on response size only
      const estimatedTokens = Math.ceil(htmlContent.length / 4);
      const credits = calculateCredits('v0', {
        model: 'v0-mini',
        prompt_tokens: 0,
        completion_tokens: estimatedTokens
      }, this.markups);
      const costUSD = credits * 0.10;
      if (userId && credits > 0) {
        await logUsage(userId, 'v0', 'v0', { method: 'v0Fetch', model: 'v0-mini', prompt_tokens: 0, completion_tokens: estimatedTokens }, credits, costUSD, this._meteringAdapter());
        await deductCredits(userId, credits, this._meteringAdapter());
      }

      return {
        success: true,
        chatId: chat.id,
        htmlContent: htmlContent,
        files: allFiles,
        latestVersionStatus: chat.latestVersion?.status,
        latestVersionUpdatedAt: chat.latestVersion?.updatedAt ?? chat.latestVersion?.createdAt,
        credits: credits,
      };

    } catch (error) {
      this.log('[Monkey.v0Fetch] Error occurred:', error.message);
      this.log('[Monkey.v0Fetch] Error name:', error.name);
      this.log('[Monkey.v0Fetch] Error code:', error.code);
      this.log('[Monkey.v0Fetch] Full error:', error);
      
      // Return error object instead of throwing
      return {
        success: false,
        error: `Failed to fetch v0 chat: ${error.message}`,
        details: {
          name: error.name,
          message: error.message,
          code: error.code,
        },
      };
    }
  }

  /**
   * Fetch raw v0 chat object (no processing). For debug/temp use.
   * @param {string} chatId - v0 chat ID
   * @returns {Promise<Object>} { success: true, raw } or { success: false, error }
   */
  async v0GetChatRaw(chatId) {
    if (!chatId) {
      return { success: false, error: 'Chat ID is required' };
    }
    const apiKey = process.env.V0_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'V0_API_KEY not configured' };
    }
    try {
      const v0Module = await import('v0-sdk');
      const clientConfig = {
        apiKey,
        baseUrl: 'https://api.v0.dev/v1',
        fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(600000) }),
      };
      let v0;
      if (v0Module.createClient) {
        v0 = v0Module.createClient(clientConfig);
      } else if (v0Module.default?.createClient) {
        v0 = v0Module.default.createClient(clientConfig);
      } else if (v0Module.v0) {
        v0 = v0Module.v0;
      } else if (v0Module.default) {
        v0 = v0Module.default;
      } else {
        throw new Error('Could not find v0 client in v0-sdk module');
      }
      const chat = await v0.chats.getById({ chatId });
      return { success: true, raw: chat };
    } catch (error) {
      return {
        success: false,
        error: error?.message || 'Failed to fetch v0 chat',
      };
    }
  }

  // ===== DATAFORSEO METHODS =====

  async DataForSEORelatedKeywords(keywords, settings = {}) {
    const keywordsArray = this._parseInputString(keywords);
    if (keywordsArray.length === 0) {
      throw new Error("At least one keyword is required");
    }

    const depth = settings.depth !== undefined ? settings.depth : 0;
    const limit = settings.limit || 100;
    const userId = settings.userId || this.user?.id;
    if (userId) {
      const estimatedCredits = estimateCredits('dataforseo', { count: 1 }, this.markups);
      await checkQuota(userId, estimatedCredits, this._meteringAdapter(), { planContext: this.planContext });
    }

    try {
      const response = await this.apiCall(
        this.siteUrl + '/api/dataforseo/related-keywords',
        { 
          keywords: keywordsArray,
          depth,
          limit
        }
      );
      const data = JSON.parse(response);
      if (data.error) {
        throw new Error(data.error);
      }
      const credits = calculateCredits('dataforseo', { count: 1 }, this.markups);
      const costUSD = credits * 0.10;
      if (userId && credits > 0) {
        await logUsage(userId, 'dataforseo', 'dataforseo', { method: 'DataForSEORelatedKeywords' }, credits, costUSD, this._meteringAdapter());
        await deductCredits(userId, credits, this._meteringAdapter());
      }
      return data;
    } catch (error) {
      this.log("DataForSEORelatedKeywords error:", error);
      throw error;
    }
  }

  // ===== TEMPLATE SYSTEM METHODS =====

  /**
   * Load component templates merged with user customizations
   * @returns {Object} Merged component library
   */
  async loadComponents() {
    this.log('[Monkey] Loading component templates...');
    
    try {
      // 1. Load default registry
      const registryModule = await import('./content-magic/components/registry.js');
      const defaultComponents = { ...registryModule.COMPONENTS };
      this.log('[Monkey] Loaded', Object.keys(defaultComponents).length, 'default components');
      
      // 2. Fetch user customizations from profiles.json
      if (!this.user?.id) {
        this.log('[Monkey] No user ID, returning defaul t components only');
        return defaultComponents;
      }
      
      try {
        // Use cached profile loader to reduce database calls
        const profileData = await this.loadProfile();
        const profile = profileData ? [profileData] : [];
        
        // Log full profile structure for debugging
        this.log('[Monkey] ========== PROFILE DATA DEBUG ==========');
        this.log('[Monkey] Profile query result:', {
          profileExists: !!profile,
          profileLength: profile?.length || 0,
          profileStructure: profile?.[0] ? Object.keys(profile[0]) : [],
          hasJson: !!profile?.[0]?.json,
          jsonKeys: profile?.[0]?.json ? Object.keys(profile[0].json) : [],
          hasCustomizations: !!profile?.[0]?.json?.customizations,
          customizationsKeys: profile?.[0]?.json?.customizations ? Object.keys(profile[0].json.customizations) : []
        });
        
        // Log the actual profile object structure
        if (profile && profile[0]) {
          this.log('[Monkey] Full profile[0] object:', JSON.stringify(profile[0], null, 2).substring(0, 1000));
          if (profile[0].json) {
            this.log('[Monkey] profile[0].json keys:', Object.keys(profile[0].json));
            if (profile[0].json.customizations) {
              this.log('[Monkey] profile[0].json.customizations keys:', Object.keys(profile[0].json.customizations));
              if (profile[0].json.customizations.templates) {
                this.log('[Monkey] profile[0].json.customizations.templates keys:', Object.keys(profile[0].json.customizations.templates));
                this.log('[Monkey] Templates in customizations:', profile[0].json.customizations.templates);
              } else {
                this.log('[Monkey] ⚠️ profile[0].json.customizations.templates is missing or undefined');
              }
            } else {
              this.log('[Monkey] ⚠️ profile[0].json.customizations is missing or undefined');
            }
          } else {
            this.log('[Monkey] ⚠️ profile[0].json is missing or undefined');
          }
        }
        this.log('[Monkey] =========================================');
        
        if (!profile || profile.length === 0) {
          this.log('[Monkey] No profile found, returning default components only');
          return defaultComponents;
        }
        
        const customizations = profile[0]?.json?.customizations;
        
        this.log('[Monkey] Extracted customizations:', {
          customizationsExists: !!customizations,
          customizationsKeys: customizations ? Object.keys(customizations) : [],
          hasTemplates: !!customizations?.templates,
          templateKeys: customizations?.templates ? Object.keys(customizations.templates) : [],
          templatesCount: customizations?.templates ? Object.keys(customizations.templates).length : 0
        });
        
        // 3. Merge: user component customizations override defaults
        if (customizations?.components) {
          let customCount = 0;
          Object.keys(customizations.components).forEach(componentId => {
            if (defaultComponents[componentId] && customizations.components[componentId].enabled !== false) {
              defaultComponents[componentId] = {
                ...defaultComponents[componentId],
                html: customizations.components[componentId].html,
                isCustom: true
              };
              customCount++;
            }
          });
          this.log('[Monkey] Applied', customCount, 'component customizations');
        }
        
        // 4. Merge: user custom templates (new system)
        // User templates override defaults if same key, or add new templates
        if (customizations?.templates) {
          let templateCount = 0;
          let overrideCount = 0;
          const templateIds = Object.keys(customizations.templates);
          this.log('[Monkey] Found', templateIds.length, 'templates in customizations.templates:', templateIds);
          
          Object.keys(customizations.templates).forEach(templateId => {
            const template = customizations.templates[templateId];
            if (template && template.html) {
              // Check if this template exists in defaults (meaning it's an edited default template)
              const isDefaultTemplate = defaultComponents[templateId] !== undefined;
              
              this.log('[Monkey] Processing template:', templateId, 'isDefault:', isDefaultTemplate, 'htmlLength:', template.html.length);
              
              // Override or add the template
              defaultComponents[templateId] = {
                // If it's a default template, preserve default fields that weren't customized
                ...(isDefaultTemplate ? defaultComponents[templateId] : {}),
                // Override with customization data
                id: templateId,
                name: template.name || defaultComponents[templateId]?.name || templateId,
                html: template.html, // Always use customized HTML
                category: template.category || defaultComponents[templateId]?.category || 'custom',
                pageTypes: template.pageTypes || defaultComponents[templateId]?.pageTypes || [],
                isCustom: true,
                isUserCreated: template.isUserCreated !== undefined ? template.isUserCreated : (isDefaultTemplate ? false : true),
                createdAt: template.createdAt || defaultComponents[templateId]?.createdAt,
                updatedAt: template.updatedAt,
                order: template.order !== undefined ? template.order : undefined
              };
              
              templateCount++;
              if (isDefaultTemplate) {
                overrideCount++;
              }
            } else {
              this.log('[Monkey] Skipping template', templateId, '- missing html or template data');
            }
          });
          this.log('[Monkey] Loaded', templateCount, 'custom templates (', overrideCount, 'overrides,', templateCount - overrideCount, 'new)');
        } else {
          this.log('[Monkey] No customizations.templates found');
        }
      } catch (profileError) {
        this.log('[Monkey] Error loading profile customizations:', profileError.message);
        // Continue with defaults if profile fetch fails
      }
      
      return defaultComponents;
    } catch (error) {
      this.log('[Monkey] Error loading components:', error);
      throw new Error(`Failed to load component templates: ${error.message}`);
    }
  }

  /**
   * Save component customization to profiles.json
   * @param {string} componentId - Component ID to customize
   * @param {string} html - Custom HTML template
   * @returns {Object} Updated profile
   */
  async saveComponentCustomization(componentId, html) {
    this.log('[Monkey] Saving component customization:', componentId);
    
    if (!this.user?.id) {
      throw new Error('User must be authenticated to save customizations');
    }
    
    try {
      // Fetch current profile (force reload to ensure we have latest data before saving)
      const profileData = await this.loadProfile(true);
      const profile = profileData ? [profileData] : [];
      
      if (!profile || profile.length === 0) {
        throw new Error('Profile not found');
      }
      
      const currentJson = profile[0]?.json || {};
      const customizations = currentJson.customizations || {};
      const components = customizations.components || {};
      
      // Update component customization
      components[componentId] = {
        html,
        enabled: true,
        updatedAt: new Date().toISOString()
      };
      
      // Update profile
      const updated = await this.update('profiles', {
        id: this.user.id,
        json: {
          ...currentJson,
          customizations: {
            ...customizations,
            components
          }
        }
      });
      
      // Invalidate profile cache after update
      this.profileCache = null;
      
      this.log('[Monkey] Component customization saved successfully');
      return updated;
    } catch (error) {
      this.log('[Monkey] Error saving component customization:', error);
      throw new Error(`Failed to save customization: ${error.message}`);
    }
  }

  /**
   * Load page type configurations merged with user customizations
   * @returns {Object} Merged page type configurations
   */
  async loadPageTypeConfigs() {
    this.log('[Monkey] Loading page type configurations...');
    
    try {
      // 1. Load default registry
      const registryModule = await import('./monkey/references/pageTypes/registry.ts');
      const defaultConfigs = {};
      
      // Build configs from MarketingPageType enum
      if (registryModule.MarketingPageType && registryModule.PAGE_TYPE_CONFIGS) {
        Object.values(registryModule.MarketingPageType).forEach(pageType => {
          if (registryModule.PAGE_TYPE_CONFIGS[pageType]) {
            defaultConfigs[pageType] = { ...registryModule.PAGE_TYPE_CONFIGS[pageType] };
          }
        });
      }
      
      this.log('[Monkey] Loaded', Object.keys(defaultConfigs).length, 'default page types');
      
      // 2. Fetch user customizations from profiles.json
      if (!this.user?.id) {
        this.log('[Monkey] No user ID, returning default page types only');
        return defaultConfigs;
      }
      
      try {
        // Use cached profile loader to reduce database calls
        const profileData = await this.loadProfile();
        const profile = profileData ? [profileData] : [];
        
        if (!profile || profile.length === 0) {
          this.log('[Monkey] No profile found, returning default page types only');
          return defaultConfigs;
        }
        
        const customizations = profile[0]?.json?.customizations;
        
        // 3. Merge: user customizations override defaults
        if (customizations?.pageTypes) {
          let customCount = 0;
          Object.keys(customizations.pageTypes).forEach(pageType => {
            if (defaultConfigs[pageType]) {
              defaultConfigs[pageType] = {
                ...defaultConfigs[pageType],
                ...customizations.pageTypes[pageType],
                isCustom: true
              };
              customCount++;
            }
          });
          this.log('[Monkey] Applied', customCount, 'page type customizations');
        }
      } catch (profileError) {
        this.log('[Monkey] Error loading profile customizations:', profileError.message);
        // Continue with defaults if profile fetch fails
      }
      
      return defaultConfigs;
    } catch (error) {
      this.log('[Monkey] Error loading page type configs:', error);
      throw new Error(`Failed to load page type configurations: ${error.message}`);
    }
  }

  /**
   * Save page type configuration customization to profiles.json
   * @param {string} pageType - Page type ID to customize
   * @param {Object} config - Custom configuration (recommended_sections, optional_sections, etc.)
   * @returns {Object} Updated profile
   */
  async savePageTypeConfig(pageType, config) {
    this.log('[Monkey] Saving page type config customization:', pageType);
    
    if (!this.user?.id) {
      throw new Error('User must be authenticated to save customizations');
    }
    
    try {
      // Fetch current profile (force reload to ensure we have latest data before saving)
      const profileData = await this.loadProfile(true);
      const profile = profileData ? [profileData] : [];
      
      if (!profile || profile.length === 0) {
        throw new Error('Profile not found');
      }
      
      const currentJson = profile[0]?.json || {};
      const customizations = currentJson.customizations || {};
      const pageTypes = customizations.pageTypes || {};
      
      // Update page type configuration
      pageTypes[pageType] = {
        ...config,
        updatedAt: new Date().toISOString()
      };
      
      // Update profile
      const updated = await this.update('profiles', {
        id: this.user.id,
        json: {
          ...currentJson,
          customizations: {
            ...customizations,
            pageTypes
          }
        }
      });
      
      // Invalidate profile cache after update
      this.profileCache = null;
      
      this.log('[Monkey] Page type config customization saved successfully');
      return updated;
    } catch (error) {
      this.log('[Monkey] Error saving page type config customization:', error);
      throw new Error(`Failed to save customization: ${error.message}`);
    }
  }

  /**
   * Load section templates merged with user customizations
   * @returns {Object} Merged section templates
   */
  async loadSectionTemplates() {
    this.log('[Monkey] Loading section templates...');
    
    try {
      // 1. Load default registry
      const registryModule = await import('./monkey/references/pageTypes/registry.ts');
      const defaultTemplates = { ...registryModule.SECTION_TEMPLATES };
      this.log('[Monkey] Loaded', Object.keys(defaultTemplates).length, 'default section templates');
      
      // 2. Fetch user customizations from profiles.json
      if (!this.user?.id) {
        this.log('[Monkey] No user ID, returning default section templates only');
        return defaultTemplates;
      }
      
      try {
        // Use cached profile loader to reduce database calls
        const profileData = await this.loadProfile();
        const profile = profileData ? [profileData] : [];
        
        if (!profile || profile.length === 0) {
          this.log('[Monkey] No profile found, returning default section templates only');
          return defaultTemplates;
        }
        
        const customizations = profile[0]?.json?.customizations;
        
        // 3. Merge: user customizations override defaults
        if (customizations?.sectionTemplates) {
          let customCount = 0;
          Object.keys(customizations.sectionTemplates).forEach(sectionType => {
            if (defaultTemplates[sectionType]) {
              defaultTemplates[sectionType] = {
                ...defaultTemplates[sectionType],
                ...customizations.sectionTemplates[sectionType],
                isCustom: true
              };
              customCount++;
            }
          });
          this.log('[Monkey] Applied', customCount, 'section template customizations');
        }
      } catch (profileError) {
        this.log('[Monkey] Error loading profile customizations:', profileError.message);
        // Continue with defaults if profile fetch fails
      }
      
      return defaultTemplates;
    } catch (error) {
      this.log('[Monkey] Error loading section templates:', error);
      throw new Error(`Failed to load section templates: ${error.message}`);
    }
  }

  /**
   * AI-powered template filling
   * @param {Object} options - Fill options
   * @param {string} options.componentId - Component template ID
   * @param {string} options.contentString - Content to fill template with
   * @param {string} options.mode - 'fill' or 'convert'
   * @param {string} options.existingSectionHtml - For convert mode
   * @returns {string} Filled HTML
   */
  async fillTemplate({ componentId, contentString, mode = 'fill', existingSectionHtml = '' }) {
    this.log('[Monkey] Filling template:', { componentId, mode });
    
    try {
      // 1. Load component template
      const components = await this.loadComponents();
      const component = components[componentId];
      
      if (!component) {
        throw new Error(`Component ${componentId} not found`);
      }
      
      // 2. Build AI prompt
      let prompt;
      if (mode === 'fill') {
        prompt = `You are filling a webpage template with provided content.

Template HTML:
${component.html}

Placeholders to fill:
${JSON.stringify(component.placeholders, null, 2)}

Content to use:
${contentString}

Instructions:
- Replace all placeholder text with relevant content from the provided string
- Maintain the exact HTML structure and classes
- Only change text content, not HTML tags or attributes
- Return ONLY the filled HTML, no explanations

Filled HTML:`;
      } else {
        // convert mode
        prompt = `You are converting webpage content from one template to another.

Current section HTML:
${existingSectionHtml}

Target template:
${component.html}

Instructions:
- Extract the content/meaning from the current section
- Place that content into the target template structure
- Maintain all CSS classes from the target template
- Return ONLY the converted HTML, no explanations

Converted HTML:`;
      }
      
      // 3. Call AI with mid-tier model
      this.log('[Monkey] Calling AI for template filling...');
      const result = await this.AI(prompt, { 
        model: 'mid',
        max_tokens: 2000 
      });
      
      // 4. Extract HTML from response
      // Try to find <section> tag first
      const sectionMatch = result.match(/<section[\s\S]*?<\/section>/);
      if (sectionMatch) {
        this.log('[Monkey] Extracted section from AI response');
        return sectionMatch[0];
      }
      
      // Fallback: return trimmed result
      this.log('[Monkey] No section tag found, returning trimmed response');
      return result.trim();
    } catch (error) {
      this.log('[Monkey] Error filling template:', error);
      throw new Error(`Failed to fill template: ${error.message}`);
    }
  }

  /**
   * Insert component HTML into editor
   * NOTE: This method works with DOM elements and should only be called from client-side
   * @param {HTMLElement} focusedElement - The focused section element
   * @param {string} componentHtml - HTML to insert
   * @param {string} position - 'after' or 'before'
   * @returns {HTMLElement} The inserted element
   */
  insertComponent(focusedElement, componentHtml, position = 'after') {
    if (typeof window === 'undefined') {
      throw new Error('insertComponent can only be called on client-side (requires DOM)');
    }
    
    if (!focusedElement) {
      throw new Error('No focused element provided');
    }
    
    const insertMethod = position === 'after' ? 'afterend' : 'beforebegin';
    focusedElement.insertAdjacentHTML(insertMethod, componentHtml);
    
    // Return the newly inserted element
    const sibling = position === 'after' 
      ? focusedElement.nextElementSibling 
      : focusedElement.previousElementSibling;
    
    this.log('[Monkey] Inserted component', { 
      position, 
      componentLength: componentHtml.length,
      insertedElement: sibling?.tagName 
    });
    
    return sibling;
  }

  /**
   * Create a new custom template
   * @param {Object} template - Template data (id, name, html, category)
   * @returns {Object} Created template
   */
  async createTemplate(template) {
    this.log('[Monkey] Creating custom template:', template.id);
    
    if (!this.user?.id) {
      throw new Error('User must be authenticated to create templates');
    }
    
    try {
      // Fetch current profile (force reload to ensure we have latest data before saving)
      const profileData = await this.loadProfile(true);
      const profile = profileData ? [profileData] : [];
      
      if (!profile || profile.length === 0) {
        throw new Error('Profile not found');
      }
      
      const currentJson = profile[0]?.json || {};
      const customizations = currentJson.customizations || {};
      const templates = customizations.templates || {};
      
      // Check if template already exists
      if (templates[template.id]) {
        throw new Error('Template with this ID already exists');
      }
      
      // Add section wrapper if missing
      let processedHtml = template.html.trim();
      const hasSectionWrapper = /^\s*<section[\s>]/i.test(processedHtml);
      
      if (!hasSectionWrapper) {
        this.log('[Monkey] Adding section wrapper to template HTML');
        processedHtml = `<section>\n${processedHtml}\n</section>`;
      }
      
      // Create template entry
      const newTemplate = {
        id: template.id,
        name: template.name,
        html: processedHtml,
        category: template.category || 'custom',
        pageTypes: template.pageTypes || [],
        isCustom: true,
        isUserCreated: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      templates[template.id] = newTemplate;
      
      // Update profile
      const updated = await this.update('profiles', {
        id: this.user.id,
        json: {
          ...currentJson,
          customizations: {
            ...customizations,
            templates
          }
        }
      });
      
      // Invalidate profile cache after update
      this.profileCache = null;
      
      this.log('[Monkey] Template created successfully');
      return newTemplate;
    } catch (error) {
      this.log('[Monkey] Error creating template:', error);
      throw new Error(`Failed to create template: ${error.message}`);
    }
  }

  /**
   * Delete a custom template
   * @param {string} templateId - Template ID to delete
   * @returns {boolean} Success status
   */
  async deleteTemplate(templateId) {
    this.log('[Monkey] Deleting template:', templateId);
    
    if (!this.user?.id) {
      throw new Error('User must be authenticated to delete templates');
    }
    
    try {
      // Fetch current profile (force reload to ensure we have latest data before modifying)
      const profileData = await this.loadProfile(true);
      const profile = profileData ? [profileData] : [];
      
      if (!profile || profile.length === 0) {
        throw new Error('Profile not found');
      }
      
      const currentJson = profile[0]?.json || {};
      const customizations = currentJson.customizations || {};
      const templates = customizations.templates || {};
      const bookmarks = customizations.bookmarks || [];
      
      // Check if template exists
      if (!templates[templateId]) {
        throw new Error('Template not found');
      }
      
      // Only allow deletion of user-created templates
      if (!templates[templateId].isUserCreated) {
        throw new Error('Cannot delete default templates');
      }
      
      // Remove template
      delete templates[templateId];
      
      // Remove from bookmarks if present
      const updatedBookmarks = bookmarks.filter(id => id !== templateId);
      
      // Update profile
      await this.update('profiles', {
        id: this.user.id,
        json: {
          ...currentJson,
          customizations: {
            ...customizations,
            templates,
            bookmarks: updatedBookmarks
          }
        }
      });
      
      // Invalidate profile cache after update
      this.profileCache = null;
      
      this.log('[Monkey] Template deleted successfully');
      return true;
    } catch (error) {
      this.log('[Monkey] Error deleting template:', error);
      throw new Error(`Failed to delete template: ${error.message}`);
    }
  }

  /**
   * Toggle bookmark for a template
   * @param {string} templateId - Template ID to bookmark/unbookmark
   * @returns {Object} Updated bookmarks array
   */
  async toggleBookmark(templateId) {
    this.log('[Monkey] Toggling bookmark:', templateId);
    
    if (!this.user?.id) {
      throw new Error('User must be authenticated to manage bookmarks');
    }
    
    try {
      // Fetch current profile (force reload to ensure we have latest data before modifying)
      const profileData = await this.loadProfile(true);
      const profile = profileData ? [profileData] : [];
      
      if (!profile || profile.length === 0) {
        throw new Error('Profile not found');
      }
      
      const currentJson = profile[0]?.json || {};
      const customizations = currentJson.customizations || {};
      const bookmarks = customizations.bookmarks || [];
      
      // Toggle bookmark
      let updatedBookmarks;
      if (bookmarks.includes(templateId)) {
        // Remove bookmark
        updatedBookmarks = bookmarks.filter(id => id !== templateId);
        this.log('[Monkey] Removed bookmark');
      } else {
        // Add bookmark
        updatedBookmarks = [...bookmarks, templateId];
        this.log('[Monkey] Added bookmark');
      }
      
      // Update profile
      await this.update('profiles', {
        id: this.user.id,
        json: {
          ...currentJson,
          customizations: {
            ...customizations,
            bookmarks: updatedBookmarks
          }
        }
      });
      
      // Invalidate profile cache after update
      this.profileCache = null;
      
      return updatedBookmarks;
    } catch (error) {
      this.log('[Monkey] Error toggling bookmark:', error);
      throw new Error(`Failed to toggle bookmark: ${error.message}`);
    }
  }

  /**
   * @deprecated Shadow DOM handles CSS isolation. @scope CSS is no longer generated. TODO: remove after confirming no regressions.
   * @private
   */
  async _getRawCombinedCustomCss() {
    if (this.states.customCssRaw) {
      return this.states.customCssRaw;
    }
    if (!this.user?.id) {
      this.log('[Monkey] _getRawCombinedCustomCss: No user found');
      return '';
    }
    const profileData = await this.loadProfile();
    const profile = profileData ? [profileData] : [];
    if (!profile?.[0]?.json?.customizations) {
      this.log('[Monkey] _getRawCombinedCustomCss: No customizations found');
      this.states.customCssRaw = '';
      return '';
    }
    const customizations = profile[0].json.customizations;
    let customCss = typeof customizations.css === 'string' ? customizations.css : '';
    let externalCss = '';
    if (Array.isArray(customizations.external_css_links)) {
      const validLinks = customizations.external_css_links.filter(
        (link) => link && link.trim() && /^https?:\/\//i.test(link.trim())
      );
      if (validLinks.length > 0) {
        externalCss = await this._fetchAndMinifyExternalCss(validLinks);
      }
    }
    const parts = [];
    if (externalCss) parts.push(externalCss);
    if (customCss) parts.push(customCss);
    const rawCombinedCss = parts.join('\n\n');
    this.states.customCssRaw = rawCombinedCss;
    this.log('[Monkey] _getRawCombinedCustomCss: Loaded and cached raw custom CSS');
    return rawCombinedCss;
  }

  /**
   * @deprecated Shadow DOM handles CSS isolation. @scope CSS is no longer generated. TODO: remove after confirming no regressions.
   */
  async renderCustomCSS(scope = 'editorContent', boundary = 'default-template') {
    try {
      const rawCombinedCss = await this._getRawCombinedCustomCss();
      if (!rawCombinedCss?.trim()) return '';
      if (scope) {
        return this._wrapCssInScope(rawCombinedCss, scope, boundary);
      }
      return rawCombinedCss;
    } catch (error) {
      this.log('[Monkey] Error in renderCustomCSS:', error);
      return '';
    }
  }

  /**
   * Strip .editorContent scope from CSS for shadow DOM injection.
   * New content no longer adds this prefix (editor uses shadow DOM); kept for legacy/stored content.
   * @param {string} css - CSS that may have .editorContent prefix on selectors
   * @returns {string} CSS with .editorContent scope removed
   */
  _stripEditorContentScopeForShadowDom(css) {
    if (!css || !css.trim()) return css;
    return css
      .replace(/(^|,)\s*\.editorContent\s*\{/g, '$1:host {')
      .replace(/^\s*\.editorContent\s+/gm, '')
      .replace(/,\s*\.editorContent\s+/g, ', ')
      .trim();
  }

  async getCustomCssTagsForShadowDom() {
    try {
      this.log('[Monkey] getCustomCssTagsForShadowDom: start');
      if (!this.user?.id) {
        this.log('[Monkey] getCustomCssTagsForShadowDom: No user');
        return '';
      }
      const profileData = await this.loadProfile();
      const customizations = profileData?.json?.customizations;
      if (!customizations) {
        this.log('[Monkey] getCustomCssTagsForShadowDom: no customizations');
        return '';
      }
      const externalCssLinks = Array.isArray(customizations.external_css_links)
        ? customizations.external_css_links.filter((link) => link && link.trim() && /^https?:\/\//i.test(link.trim()))
        : [];
      const inlineCss = typeof customizations.css === 'string' ? customizations.css : '';
      this._injectWhitelistedFontLinksIntoDocumentHead(externalCssLinks);
      const headParts = [];
      for (const url of externalCssLinks) {
        headParts.push(`<link rel="stylesheet" href="${url}">`);
      }
      if (inlineCss.trim()) {
        const stripped = this._stripEditorContentScopeForShadowDom(inlineCss);
        if (stripped.trim()) headParts.push(`<style>${stripped.replace(/<\//g, '\u003C/')}</style>`);
      }
      if (headParts.length === 0) {
        this.log('[Monkey] getCustomCssTagsForShadowDom: nothing to inject');
        return '';
      }
      const result = `<head data-custom-css-head="true">${headParts.join('')}</head>`;
      this.log('[Monkey] getCustomCssTagsForShadowDom: returning HTML length=', result.length);
      return result;
    } catch (error) {
      this.log('[Monkey] Error in getCustomCssTagsForShadowDom:', error);
      return '';
    }
  }

  /**
   * Inject custom CSS into a shadow root. Idempotent: removes any existing custom CSS head and injected draft first.
   * @param {ShadowRoot} shadowRoot
   * @param {Node} beforeNode - Node before which to insert (typically .editorContent)
   * @param {{ draftCss?: string | null, applyProfileCss?: boolean }} [options] - draftCss: when set, rewrite and inject draft styles (shadow-safe). applyProfileCss: when false, skip profile CSS (default true).
   */
  async applyCustomCssToShadowDom(shadowRoot, beforeNode, options = {}) {
    this.removeCustomCssFromShadow(shadowRoot);
    const applyProfileCss = options.applyProfileCss !== false;
    const draftCss = options.draftCss != null ? String(options.draftCss).trim() : '';
    const ref = (beforeNode && beforeNode.parentNode === shadowRoot) ? beforeNode : shadowRoot.firstChild;

    if (draftCss) {
      const rewritten = rewriteDraftCssForShadowRoot(draftCss);
      const styleEl = document.createElement('style');
      styleEl.setAttribute('data-custom-css-draft-injected', 'true');
      styleEl.textContent = rewritten;
      shadowRoot.insertBefore(styleEl, ref);
    }

    if (!applyProfileCss) return;
    const markup = await this.getCustomCssTagsForShadowDom();
    if (!markup?.trim()) return;
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<!DOCTYPE html><html>${markup}</html>`, 'text/html');
    const headEl = doc.head;
    if (!headEl) return;
    const imported = document.importNode(headEl, true);
    shadowRoot.insertBefore(imported, ref);
  }

  /**
   * Remove custom CSS head and any injected draft styles from a shadow root.
   * @param {ShadowRoot} shadowRoot
   */
  removeCustomCssFromShadow(shadowRoot) {
    shadowRoot.querySelector('[data-custom-css-head]')?.remove();
    shadowRoot.querySelector('style[data-custom-css-draft-injected="true"]')?.remove();
  }

  /**
   * Helper: Resolve relative url() and @import paths in CSS to absolute URLs using the base URL.
   * Handles: url('/path'), url("path"), url(path), @import "path", @import 'path'.
   * Paths starting with / and paths like css/design-guide.css (no leading slash) are both resolved.
   * @private
   */
  _resolveRelativeUrlsInCss(css, baseUrl) {
    if (!css || !baseUrl) return css;
    try {
      const base = new URL(baseUrl);
      const resolvePath = (path) => {
        const url = (path || '').trim();
        if (!url) return null;
        if (/^(https?:|\/\/|data:|blob:)/i.test(url)) return null; // already absolute
        if (/^(#|mailto:|tel:|javascript:)/i.test(url)) return null;
        try {
          return new URL(url, base).href;
        } catch (_) {
          return null;
        }
      };

      // 1. url() - handles url('/path'), url("path"), url(css/design-guide.css)
      let result = css.replace(/url\s*\(\s*(["']?)([^"')]+)\1\s*\)/gi, (match, quote, urlPart) => {
        const absolute = resolvePath(urlPart);
        if (!absolute) return match;
        return `url("${absolute}")`;
      });

      // 2. @import "path" / @import 'path' (plain string, not url())
      result = result.replace(
        /@import\s+(?![uU][rR][lL]\s*\()["']([^"']+)["']/gi,
        (match, path) => {
          const absolute = resolvePath(path);
          if (!absolute) return match;
          return `@import url("${absolute}")`;
        }
      );

      return result;
    } catch (_) {
      return css;
    }
  }

  /**
   * Helper: Fetch and minify external CSS links
   * @private
   */
  async _fetchAndMinifyExternalCss(cssLinks) {
    if (!cssLinks || !Array.isArray(cssLinks) || cssLinks.length === 0) {
      return '';
    }

    const validLinks = cssLinks.filter(
      (link) => link && link.trim() && /^https?:\/\//i.test(link.trim())
    );
    if (validLinks.length === 0) {
      return '';
    }

    const fetchedCss = [];
    const errors = [];

    for (const link of validLinks) {
      try {
        const response = await fetch(link, {
          method: 'GET',
          headers: {
            'Accept': 'text/css,*/*',
          },
        });

        if (!response.ok) {
          errors.push(`Failed to fetch ${link}: ${response.status}`);
          continue;
        }

        let css = await response.text();
        css = this._resolveRelativeUrlsInCss(css, link);
        fetchedCss.push(css);
      } catch (error) {
        errors.push(`Error fetching ${link}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      this.log('[Monkey] Errors fetching external CSS:', errors);
    }

    const combined = fetchedCss.join('\n\n');
    return this._minifyCss(combined);
  }

  /**
   * Helper: Minify CSS
   * @private
   */
  _minifyCss(css) {
    if (!css) return '';
    return css
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\s*{\s*/g, '{') // Remove spaces around {
      .replace(/;\s*/g, ';') // Remove spaces after semicolons
      .replace(/\s*}\s*/g, '}') // Remove spaces around }
      .replace(/\s*:\s*/g, ':') // Remove spaces around :
      .replace(/\s*,\s*/g, ',') // Remove spaces around commas
      .replace(/\s*;\s*}/g, '}') // Remove semicolon before }
      .trim();
  }

  /**
   * @deprecated Use FONT_CDN_WHITELIST + _injectWhitelistedFontLinksIntoDocumentHead. TODO: remove.
   */
  _getPreloadFontUrlsForExternalCssLinks(externalCssLinks) {
    if (!externalCssLinks || !Array.isArray(externalCssLinks)) return [];
    const out = [];
    for (const url of externalCssLinks) {
      const u = (url && typeof url === 'string') ? url.trim() : '';
      if (!u) continue;
      const isFa = u.includes('use.fontawesome.com/releases/') && u.includes('/css/') && (u.endsWith('all.css') || u.includes('fontawesome'));
      if (!isFa) continue;
      let base = u.replace(/\/css\/[^/]*$/, '/webfonts/');
      if (base === u) base = u.replace(/\/[^/]*$/, '/') + 'webfonts/';
      out.push(`${base}fa-solid-900.woff2`, `${base}fa-regular-400.woff2`, `${base}fa-brands-400.woff2`);
    }
    return [...new Set(out)];
  }

  /**
   * @deprecated Use _injectWhitelistedFontLinksIntoDocumentHead. TODO: remove.
   */
  _ensurePreloadLinksInDocumentHead(fontUrls) {
    if (typeof document === 'undefined' || !document.head) return;
    if (!fontUrls || !Array.isArray(fontUrls)) return;
    for (const url of fontUrls) {
      if (!url || typeof url !== 'string') continue;
      if (document.head.querySelector(`link[rel="preload"][as="font"][href="${url}"]`)) continue;
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'font';
      link.type = 'font/woff2';
      link.crossOrigin = 'anonymous';
      link.href = url;
      document.head.appendChild(link);
    }
  }

  _injectWhitelistedFontLinksIntoDocumentHead(externalCssLinks) {
    if (typeof document === 'undefined' || !document.head) return;
    if (!externalCssLinks || !Array.isArray(externalCssLinks)) return;
    document.head.querySelectorAll('link[data-custom-css-font-link]').forEach((el) => el.remove());
    const filtered = externalCssLinks.filter((url) => {
      const u = (url && typeof url === 'string') ? url.trim() : '';
      if (!u) return false;
      return FONT_CDN_WHITELIST.some((domain) => u.includes(domain));
    });
    for (const url of filtered) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.setAttribute('data-custom-css-font-link', 'true');
      link.href = url;
      document.head.appendChild(link);
    }
  }

  /**
   * @deprecated Use _injectWhitelistedFontLinksIntoDocumentHead. TODO: remove.
   */
  _injectRootRulesIntoDocumentHead(rootCss) {
    if (typeof document === 'undefined' || !document.head || !rootCss || !rootCss.trim()) {
      return;
    }
    const selector = 'style[data-custom-css-root-preload]';
    const existing = document.head.querySelector(selector);
    if (existing) {
      existing.textContent = rootCss;
    } else {
      const style = document.createElement('style');
      style.setAttribute('data-custom-css-root-preload', 'true');
      style.textContent = rootCss;
      document.head.appendChild(style);
    }
  }

  /**
   * @deprecated No longer used; font loading is via whitelist link injection. TODO: remove.
   */
  _extractRootRules(css) {
    if (!css || !css.trim()) return { rootCss: '', remainingCss: '' };
    const rootLevelAtRules = [
      '@keyframes',
      '@font-face',
      '@import',
      '@charset',
      '@namespace',
      '@property',
      '@layer'
    ];
    const rootRules = [];
    const scopedRules = [];
    let remaining = css.trim();
    while (remaining.length > 0) {
      const atRuleMatch = remaining.match(/^(@[^{@\s]+)([^{]*?)\{/);
      if (atRuleMatch) {
        const atRuleName = atRuleMatch[1].toLowerCase();
        const isRootLevel = rootLevelAtRules.some(root => atRuleName.startsWith(root.toLowerCase()));
        let depth = 1;
        let i = atRuleMatch[0].length;
        let found = false;
        while (i < remaining.length) {
          if (remaining[i] === '{') depth++;
          if (remaining[i] === '}') {
            depth--;
            if (depth === 0) {
              const atRule = remaining.substring(0, i + 1);
              remaining = remaining.substring(i + 1).trim();
              if (isRootLevel) rootRules.push(atRule);
              else scopedRules.push(atRule);
              found = true;
              break;
            }
          }
          i++;
        }
        if (!found) break;
      } else {
        break;
      }
    }
    if (remaining.trim()) scopedRules.push(remaining.trim());
    return {
      rootCss: rootRules.join('\n\n'),
      remainingCss: scopedRules.join('\n\n')
    };
  }

  /**
   * @deprecated Shadow DOM handles CSS isolation. @scope CSS is no longer generated. TODO: remove after confirming no regressions.
   * @private
   */
  _wrapCssInScope(css, scope, boundary) {
    if (!css || !css.trim() || !scope) return css;
    const { rootCss, remainingCss } = this._extractRootRules(css);
    if (rootCss.trim()) this._injectRootRulesIntoDocumentHead(rootCss);
    if (!remainingCss.trim()) return rootCss.trim() ? '' : css;
    return `@scope (.${scope}) ${boundary ? `to (.${boundary})` : ''} {*{all:revert}\n${remainingCss}\n}`;
  }

}

// Re-export for API routes that catch metering errors
export { getMeteringErrorResponse } from './monkey/tools/metering.js';
export { _getTierById as getTierById, _getTierIdByPriceId as getTierIdByPriceId, _getAllTiers as getAllTiers, _DEFAULT_MONTHLY_CREDITS as DEFAULT_MONTHLY_CREDITS };
export { getPlanContext, assertPlan, PlanAssertionError } from './monkey/planContext.js';

// Singleton instance (client only); server uses per-request instances
let _monkeyInstance = null;

export async function initMonkey(fullInitMode = false) {
  // Environment detection first: server = per-request instance, client = singleton
  const isServer = typeof window === 'undefined';

  if (isServer) {
    // Server: always return a new instance so user/planContext are request-scoped
    const monkey = new Monkey();
    await monkey.init(fullInitMode);
    return monkey;
  }

  // Client: use singleton
  if (_monkeyInstance) {
    if (fullInitMode && !_monkeyInstance.user) {
      await _monkeyInstance.initUser();
    }
    return _monkeyInstance;
  }

  const monkey = new Monkey();
  await monkey.init(fullInitMode);
  _monkeyInstance = monkey;
  return monkey;
}

// Function to invalidate the singleton (useful after logout or profile updates)
export function invalidateMonkeyCache() {
  _monkeyInstance = null;
}

// Keep default export for backward compatibility - but don't auto-init
const monkey = new Monkey();
// Don't auto-init - let components handle initialization
export default monkey;

// UI components are exported from @/libs/monkey (resolves to libs/monkey/index.ts).
// Do not re-export from ./monkey/index here to avoid circular dependency (index.ts imports initMonkey from this file).