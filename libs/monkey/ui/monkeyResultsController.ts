/**
 * Centralized Results Controller
 * Part B: Logic hooks and controller for managing results UI state
 */

"use client";

import { useState, useCallback } from "react";
import { ResultsUIConfig, ResultsPlacement, StateBinding } from "./types";
import { MonkeyTaskResponse } from "../references/types";

/**
 * Hook for managing results UI state
 */
export function useMonkeyResults(config: ResultsUIConfig) {
  const [response, setResponse] = useState<MonkeyTaskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const handleSelect = useCallback((selection: any) => {
    const transformed = config.binding.transform ? config.binding.transform(selection) : selection;
    config.binding.set(transformed);
  }, [config.binding]);

  const handleFeedback = useCallback(async (feedbackText: string, priorRun: any) => {
    if (!config.taskType || !config.originalRequest) {
      throw new Error("Feedback requires taskType and originalRequest in config");
    }

    setLoading(true);
    setError(null);

    try {
      // Build feedback items
      const feedbackItems = [{
        id: `feedback-${Date.now()}`,
        message: feedbackText,
      }];

      // Call API with feedback - merge with original request
      const requestWithFeedback = {
        ...config.originalRequest,
        feedback: {
          items: feedbackItems,
          priorRun,
        },
      };

      const { initMonkey } = await import("@/libs/monkey");
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/monkey/run-task", requestWithFeedback);
      const result = JSON.parse(text);

      if (result.ok) {
        setResponse(result);
        // Update config with new original request for next feedback
        config.originalRequest = requestWithFeedback;
      } else {
        setError(result.errors || [{ message: "Regeneration failed" }]);
      }
    } catch (err: any) {
      setError([{ message: err.message || "Unknown error" }]);
    } finally {
      setLoading(false);
    }
  }, [config]);

  const runTask = useCallback(async (request: any) => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const { initMonkey } = await import("@/libs/monkey");
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/monkey/run-task", request);
      const result = JSON.parse(text);

      if (result.ok) {
        setResponse(result);
        // Update config with original request for feedback
        config.originalRequest = request;
      } else {
        setError(result.errors || [{ message: "Task failed" }]);
      }
    } catch (err: any) {
      setError([{ message: err.message || "Unknown error" }]);
    } finally {
      setLoading(false);
    }
  }, [config]);

  return {
    response,
    loading,
    error,
    handleSelect,
    handleFeedback,
    runTask,
  };
}

/**
 * Create a results UI config from placement and binding
 */
export function createResultsConfig(
  placement: ResultsPlacement,
  binding: StateBinding,
  taskType?: string,
  model?: string,
  originalRequest?: any
): ResultsUIConfig {
  return {
    placement,
    binding,
    taskType,
    model,
    originalRequest,
  };
}

