import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";

const resend = new Resend(process.env.RESEND_API_KEY);

const TO_EMAIL =
  process.env.PROFESSIONAL_INQUIRY_TO_EMAIL || "pansini@beyondfinancing.com";

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ||
  "Beyond Intelligence <onboarding@resend.dev>";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function hasNumber(value: string) {
  return /\d/.test(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const fullName = clean(body.name || body.fullName);
    const email = clean(body.email).toLowerCase();
    const phone = clean(body.phone);
    const nmls = clean(body.nmls);
    const notes = clean(body.notes);

    if (!fullName || !email || !phone || !nmls) {
      return NextResponse.json(
        { success: false, error: "Name, email, phone, and NMLS # are required." },
        { status: 400 }
      );
    }

    if (!hasNumber(phone)) {
      return NextResponse.json(
        { success: false, error: "A valid phone number is required." },
        { status: 400 }
      );
    }

    if (!hasNumber(nmls)) {
      return NextResponse.json(
        { success: false, error: "A valid NMLS # is required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("professional_inquiries")
      .insert({
        full_name: fullName,
        email,
        phone,
        nmls,
        notes,
        status: "New",
        source: "Beyond Intelligence Inquiry Page",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Professional inquiry Supabase error:", error);
      return NextResponse.json(
        { success: false, error: "Unable to save inquiry." },
        { status: 500 }
      );
    }

    const safeName = escapeHtml(fullName);
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone);
    const safeNmls = escapeHtml(nmls);
    const safeNotes = escapeHtml(notes || "No notes provided.");

    const emailResult = await resend.emails.send({
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      subject: `New Beyond Intelligence™ Professional Inquiry — ${fullName}`,
      html: `
        <div style="font-family: Arial, sans-serif; color:#1f2937; line-height:1.6;">
          <h2 style="color:#263366;">New Beyond Intelligence™ Professional Inquiry</h2>
          <p>A mortgage professional requested access to Beyond Intelligence™.</p>

          <div style="border:1px solid #dbeafe; border-radius:14px; padding:16px; background:#f8fbff;">
            <p><strong>Name:</strong> ${safeName}</p>
            <p><strong>Email:</strong> ${safeEmail}</p>
            <p><strong>Phone:</strong> ${safePhone}</p>
            <p><strong>NMLS #:</strong> ${safeNmls}</p>
            <p><strong>Notes:</strong><br/>${safeNotes}</p>
          </div>

          <p style="margin-top:18px;">
            Inquiry ID: ${data?.id || "Not available"}
          </p>
        </div>
      `,
    });

    if (emailResult.error) {
      console.error("Professional inquiry Resend error:", emailResult.error);
      return NextResponse.json(
        {
          success: false,
          saved: true,
          inquiryId: data?.id,
          error: "Inquiry was saved, but the email notification failed.",
          resendError: emailResult.error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      inquiryId: data?.id,
      emailId: emailResult.data?.id,
    });
  } catch (error) {
    console.error("Professional inquiry route error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to process inquiry." },
      { status: 500 }
    );
  }
}
