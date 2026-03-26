"use client";

import { Fragment, useState } from "react";
import { CAPABILITIES } from "../capabilities";

export default function CapabilityExplorer() {
  const [expanded, setExpanded] = useState(null);

  return (
    <div className="card bg-base-100 shadow-xl border border-base-300 mt-6">
      <div className="card-body">
        <h2 className="card-title">Section D — Capability explorer</h2>
        <p className="text-base-content/70 text-sm">
          Native vs composed capabilities. Composed = multi-step recipes.
        </p>
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>Category</th>
                <th>Name</th>
                <th>Type</th>
                <th>Use case</th>
                <th>Inputs</th>
                <th>Output</th>
                <th>Difficulty</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {CAPABILITIES.map((cap) => (
                <Fragment key={cap.id}>
                  <tr>
                    <td>{cap.category}</td>
                    <td>{cap.name}</td>
                    <td>
                      <span className={`badge ${cap.type === "composed" ? "badge-secondary" : "badge-primary"}`}>
                        {cap.type}
                      </span>
                    </td>
                    <td className="max-w-xs truncate">{cap.useCase}</td>
                    <td className="font-mono text-xs">{cap.inputs}</td>
                    <td className="font-mono text-xs">{cap.output}</td>
                    <td>{cap.difficulty}</td>
                    <td>
                      {cap.type === "composed" && cap.recipe && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => setExpanded(expanded === cap.id ? null : cap.id)}
                        >
                          {expanded === cap.id ? "Hide" : "Recipe"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === cap.id && cap.recipe && (
                    <tr>
                      <td colSpan={8} className="bg-base-200">
                        <div className="p-3">
                          <p className="font-semibold text-sm mb-2">Recipe: {cap.name}</p>
                          <ol className="list-decimal list-inside space-y-1 text-sm">
                            {cap.recipe.map((r) => (
                              <li key={r.step}>
                                Step {r.step}: {r.action} (API: {r.api})
                              </li>
                            ))}
                          </ol>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
