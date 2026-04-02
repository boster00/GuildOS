"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function SalesOrdersPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      setLoading(true);
      setError("");
      const response = await fetch("/api/quest?action=salesOrders", {
        cache: "no-store",
      });

      if (!response.ok) {
        const message = await response.text();
        setError(message);
        setLoading(false);
        return;
      }

      const json = await response.json();
      setRows(json.rows || []);
      setLoading(false);
    }

    loadOrders();
  }, []);

  return (
    <main className="guild-bg-inn min-h-dvh p-8">
      <section className="mx-auto max-w-6xl rounded-3xl border border-base-300 bg-base-100/90 p-6 shadow-xl backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Quest 1: Recent 10 Sales Orders</h1>
            <p className="text-sm text-base-content/70">Source: Zoho Books</p>
          </div>
          <Link href="/town/inn" className="btn btn-sm">
            Back to Inn
          </Link>
        </div>

        {loading ? (
          <div className="py-6 text-sm text-base-content/70">Loading recent sales orders...</div>
        ) : error ? (
          <div className="alert alert-warning">
            <span>{error}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Order No</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id || idx}>
                    <td>{idx + 1}</td>
                    <td>{row.salesorder_number}</td>
                    <td>{row.customer_name}</td>
                    <td>{row.date}</td>
                    <td>{row.status}</td>
                    <td>
                      {row.currency_code} {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
