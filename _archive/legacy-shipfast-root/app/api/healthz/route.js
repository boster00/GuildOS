/**
 * Health Check Endpoint
 * 
 * Simple endpoint that returns 200 OK if the server is running.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() }, { status: 200 });
  } catch (error) {
    // Log the actual error for debugging
    return NextResponse.json(
      { 
        status: "error", 
        error: error?.message || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      }, 
      { status: 500 }
    );
  }
}

