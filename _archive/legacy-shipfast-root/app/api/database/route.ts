/**
 * Database API endpoint
 * Handles all Supabase database operations for Monkey
 * Server-side only - solves Next.js static analysis issues
 */

import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

// Request deduplication cache
const requestCache = new Map<string, { result: any; timestamp: number }>();
const CACHE_TTL = 2000; // 2 seconds cache window

// Clean old cache entries periodically
function cleanCache() {
  const now = Date.now();
  for (const [key, value] of requestCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      requestCache.delete(key);
    }
  }
}

// Handle CORS preflight requests
export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { 
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const body = await request.json();
    const { action, table, payload } = body;
    
    // Create cache key for read operations
    const cacheKey = action === "read" 
      ? `${action}:${table}:${JSON.stringify(payload || {})}`
      : null;
    
    // Check cache for read operations
    if (cacheKey) {
      const cached = requestCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(
          { success: true, result: cached.result, cached: true },
          {
            headers: {
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }
    
    // Log payload to identify duplicate inquiries (skip for getUser action)
    if (action !== 'getUser') {
      
    }

    // Clean cache periodically (every 100 requests or when cache is large)
    if (requestCache.size > 100) {
      cleanCache();
    }

    switch (action) {
      case "getUser":
        return NextResponse.json(
          { success: true, result: user },
          {
            headers: {
              "Access-Control-Allow-Origin": "*",
            },
          }
        );

      case "read": {
        // payload: settings array (e.g., [{ operator: 'eq', args: ['user_id', user.id] }])
        const settings = payload || [];
        const defaultSettings = [
          { operator: 'from', args: [table] },
          { operator: 'select', args: ["*"] },
          { operator: 'range', args: [0, 1000] }
        ];

        let query = processSupabaseSettings(supabase, defaultSettings, settings);
        const { data, error } = await query;

        if (error) {
          return NextResponse.json(
            { 
              success: false, 
              error: error.message 
            },
            {
              status: 500,
              headers: {
                "Access-Control-Allow-Origin": "*",
              },
            }
          );
        }

        // Cache successful read operations
        if (cacheKey && data) {
          requestCache.set(cacheKey, { result: data, timestamp: Date.now() });
        }

        return NextResponse.json(
          { success: true, result: data },
          {
            headers: {
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      case "write": {
        // payload: object or array of objects
        // If object has id, do update instead
        if (Array.isArray(payload)) {
          const results = [];
          for (const item of payload) {
            if (item.id && item.id !== "null" && item.id !== "undefined") {
              // Update
              const { data, error } = await supabase
                .from(table)
                .update(item)
                .eq('id', item.id)
                .select();
              if (error) throw new Error(`Update error on ${table}: ${error.message}`);
              results.push(data[0]);
            } else {
              // Insert
              const { data, error } = await supabase
                .from(table)
                .insert(item)
                .select();
              if (error) throw new Error(`Write error on ${table}: ${error.message}`);
              results.push(data[0]);
            }
          }
          return NextResponse.json(
            { success: true, result: results },
            {
              headers: {
                "Access-Control-Allow-Origin": "*",
              },
            }
          );
        } else {
          // Single object
          if (payload.id && payload.id !== "null" && payload.id !== "undefined") {
            // Update
            const { data, error } = await supabase
              .from(table)
              .update(payload)
              .eq('id', payload.id)
              .select();
            if (error) throw new Error(`Update error on ${table}: ${error.message}`);
            return NextResponse.json(
              { success: true, result: data[0] },
              {
                headers: {
                  "Access-Control-Allow-Origin": "*",
                },
              }
            );
          } else {
            // Insert
            const { data, error } = await supabase
              .from(table)
              .insert(payload)
              .select();
            if (error) throw new Error(`Write error on ${table}: ${error.message}`);
            return NextResponse.json(
              { success: true, result: data[0] },
              {
                headers: {
                  "Access-Control-Allow-Origin": "*",
                },
              }
            );
          }
        }
      }

      case "update": {
        // payload: object or { object, settings } for filter by non-id column
        const updatePayload = payload?.object !== undefined ? payload.object : payload;
        const updateSettings = payload?.settings as Array<{ operator: string; args: unknown[] }> | undefined;
        if (Array.isArray(updatePayload)) {
          const results = [];
          for (const item of updatePayload) {
            if (!item.id && !updateSettings) {
              throw new Error(`Update error: Array item missing id property`);
            }
            let query = supabase.from(table).update(item);
            if (updateSettings?.length) {
              for (const { operator, args } of updateSettings) {
                if (operator === "eq" && args?.length >= 2) {
                  query = query.eq(String(args[0]), args[1]);
                }
              }
            } else {
              query = query.eq("id", item.id);
            }
            const { data, error } = await query.select();
            if (error) throw new Error(`Update error on ${table}: ${error.message}`);
            results.push(data[0]);
          }
          return NextResponse.json(
            { success: true, result: results },
            {
              headers: {
                "Access-Control-Allow-Origin": "*",
              },
            }
          );
        } else {
          if (!updatePayload.id && !updateSettings) {
            throw new Error(`Update error: No id provided for single object update`);
          }
          let query = supabase.from(table).update(updatePayload);
          if (updateSettings?.length) {
            for (const { operator, args } of updateSettings) {
              if (operator === "eq" && args?.length >= 2) {
                query = query.eq(String(args[0]), args[1]);
              }
            }
          } else {
            query = query.eq("id", updatePayload.id);
          }
          const { data, error } = await query.select();
          if (error) throw new Error(`Update error on ${table}: ${error.message}`);
          return NextResponse.json(
            { success: true, result: data[0] },
            {
              headers: {
                "Access-Control-Allow-Origin": "*",
              },
            }
          );
        }
      }

      case "delete": {
        // payload: id or array of ids
        if (Array.isArray(payload)) {
          const results = [];
          for (const id of payload) {
            const { error } = await supabase
              .from(table)
              .delete()
              .eq('id', id);
            if (error) throw new Error(`Delete error on ${table}: ${error.message}`);
            results.push(`deleted id=${id}`);
          }
          return NextResponse.json(
            { success: true, result: results },
            {
              headers: {
                "Access-Control-Allow-Origin": "*",
              },
            }
          );
        } else {
          const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', payload);
          if (error) throw new Error(`Delete error on ${table}: ${error.message}`);
          return NextResponse.json(
            { success: true, result: `deleted id=${payload}` },
            {
              headers: {
                "Access-Control-Allow-Origin": "*",
              },
            }
          );
        }
      }

      case "runQuery": {
        // payload: { sql: "..." }
        const { sql } = payload;
        if (!sql) {
          throw new Error("SQL query is required");
        }
        const { data, error } = await supabase.rpc('run_sql', { sql });
        if (error) throw new Error(`SQL query error: ${error.message}`);
        return NextResponse.json(
          { success: true, result: data },
          {
            headers: {
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      default:
        return NextResponse.json(
          { 
            error: `Unknown action: ${action}` 
          },
          {
            status: 400,
            headers: {
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Database operation failed" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}

/**
 * Process Supabase settings into a query builder
 */
function processSupabaseSettings(supabase: any, defaultSettings: any[], settings: any[] | { operators?: any[] }) {
  const operatorsInSettings = Array.isArray(settings)
    ? settings.map(s => s.operator)
    : (Array.isArray(settings?.operators) ? settings.operators : []);

  const mergedSettings = [
    ...defaultSettings.filter(def =>
      !operatorsInSettings.includes(def.operator)
    ),
    ...(Array.isArray(settings) ? settings : (settings.operators || []))
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

