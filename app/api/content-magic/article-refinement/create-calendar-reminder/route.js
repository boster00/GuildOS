// Create calendar reminder with email notification
import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } = {} } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, reminderDate, email, articleTitle } = await request.json();

    if (!articleId || !reminderDate) {
      return NextResponse.json(
        { error: "articleId and reminderDate are required" },
        { status: 400 }
      );
    }

    // Verify article belongs to user
    const { data: article } = await supabase
      .from("content_magic_articles")
      .select("id, title")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // For now, we'll just save the reminder data
    // In the future, this could integrate with:
    // - Google Calendar API
    // - Outlook Calendar API
    // - Email service (SendGrid, Resend, etc.)
    // - Internal notification system

    const reminderDateTime = new Date(reminderDate);
    if (reminderDateTime < new Date()) {
      return NextResponse.json(
        { error: "Reminder date must be in the future" },
        { status: 400 }
      );
    }

    // TODO: Implement actual calendar integration
    // For now, we'll return success since the reminder is saved in assets
    // The frontend already saves it to article.assets.launch.calendarReminder

    return NextResponse.json({ 
      success: true,
      message: "Calendar reminder will be created",
      reminderDate: reminderDateTime.toISOString(),
      // In production, you would:
      // 1. Create calendar event via Google Calendar API or similar
      // 2. Schedule email notification via your email service
      // 3. Store calendar event ID for future updates/cancellations
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

