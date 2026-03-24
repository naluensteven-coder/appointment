import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API = "https://api.resend.com/emails";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { type, appointment: apt, adminEmail } = await req.json();
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL     = Deno.env.get("FROM_EMAIL") || "noreply@chiefsecretary.gov.pg";

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), { status: 500 });
    }

    let to, subject, html;

    if (type === "new_appointment") {
      to      = adminEmail;
      subject = `[New Appointment Request] ${apt.firstName} ${apt.lastName} — ${apt.id}`;
      html    = adminEmailHtml(apt);
    } else if (type === "status_update" && (apt.status === "approved" || apt.status === "declined")) {
      to      = apt.email;
      subject = `Your Appointment Request has been ${apt.status === "approved" ? "Approved" : "Declined"} — Ref: ${apt.id}`;
      html    = applicantEmailHtml(apt);
    } else {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `Chief Secretary's Office <${FROM_EMAIL}>`, to, subject, html }),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(result));

    return new Response(JSON.stringify({ ok: true, emailId: result.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

function adminEmailHtml(apt) {
  const prefDate = apt.prefDate
    ? new Date(apt.prefDate).toLocaleDateString("en-AU", { weekday:"long", day:"2-digit", month:"long", year:"numeric" })
    : "-";
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>
    body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0}
    .wrap{max-width:600px;margin:0 auto;background:#fff;border-top:4px solid #CE1126}
    .hdr{background:#CE1126;padding:20px 24px;color:#fff}
    .hdr h1{margin:0;font-size:18px}
    .hdr p{margin:4px 0 0;font-size:12px;opacity:.85}
    .body{padding:24px}
    .ref{background:#fff7ed;border:1px solid #fbbf24;border-radius:8px;padding:10px 16px;display:inline-block;margin-bottom:20px}
    .ref span{font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:1px;display:block}
    .ref strong{font-size:20px;color:#92400e;letter-spacing:2px}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    td{padding:8px 12px;font-size:13px;vertical-align:top}
    td:first-child{color:#6b7280;font-weight:bold;width:38%;background:#f9fafb}
    tr{border-bottom:1px solid #f3f4f6}
    .desc{background:#f9fafb;border-radius:8px;padding:14px;font-size:14px;line-height:1.7;color:#374151;margin-bottom:20px}
    .foot{text-align:center;padding:16px 24px;font-size:11px;color:#9ca3af;border-top:1px solid #f3f4f6}
  </style></head><body>
  <div class="wrap">
    <div class="hdr"><h1>New Appointment Request</h1><p>Chief Secretary to Government · Papua New Guinea</p></div>
    <div class="body">
      <div class="ref"><span>Reference Number</span><strong>${apt.id}</strong></div>
      <table>
        <tr><td>Full Name</td><td>${apt.firstName} ${apt.lastName}</td></tr>
        <tr><td>Position</td><td>${apt.position}</td></tr>
        <tr><td>Organisation</td><td>${apt.organisation}</td></tr>
        <tr><td>Phone</td><td>${apt.phone}</td></tr>
        <tr><td>Email</td><td>${apt.email}</td></tr>
        <tr><td>Reason</td><td>${apt.reason === "Other" ? "Other: " + apt.reasonOther : apt.reason}</td></tr>
        <tr><td>Preferred Date</td><td>${prefDate}</td></tr>
        <tr><td>Preferred Time</td><td>${apt.prefTime || "-"}</td></tr>
        <tr><td>Duration</td><td>${apt.duration}</td></tr>
        <tr><td>Documents</td><td>${apt.hasDocs}</td></tr>
      </table>
      <p style="font-size:13px;color:#6b7280;font-weight:bold;margin-bottom:8px">Purpose Description:</p>
      <div class="desc">${apt.description}</div>
      <p style="font-size:13px;color:#374151">Log in to the admin dashboard to approve, decline or add notes.</p>
    </div>
    <div class="foot">Chief Secretary to Government · Independent State of Papua New Guinea<br>This is an automated notification.</div>
  </div></body></html>`;
}

function applicantEmailHtml(apt) {
  const isApproved  = apt.status === "approved";
  const statusColor = isApproved ? "#065f46" : "#991b1b";
  const statusBg    = isApproved ? "#d1fae5"  : "#fee2e2";
  const statusLabel = isApproved ? "APPROVED"  : "DECLINED";
  const message     = isApproved
    ? "Your appointment request has been approved. The Chief Secretary's office will contact you to confirm final arrangements."
    : "We regret to inform you that your appointment request has not been approved at this time.";
  const prefDate = apt.prefDate
    ? new Date(apt.prefDate).toLocaleDateString("en-AU", { weekday:"long", day:"2-digit", month:"long", year:"numeric" })
    : "-";
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>
    body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0}
    .wrap{max-width:600px;margin:0 auto;background:#fff;border-top:4px solid #CE1126}
    .hdr{background:#CE1126;padding:20px 24px;color:#fff}
    .hdr h1{margin:0;font-size:18px}
    .hdr p{margin:4px 0 0;font-size:12px;opacity:.85}
    .body{padding:24px}
    .status{background:${statusBg};border-radius:8px;padding:14px 16px;margin-bottom:20px;text-align:center}
    .status strong{font-size:22px;color:${statusColor};letter-spacing:2px}
    .status p{margin:8px 0 0;font-size:14px;color:${statusColor}}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    td{padding:8px 12px;font-size:13px;vertical-align:top}
    td:first-child{color:#6b7280;font-weight:bold;width:38%;background:#f9fafb}
    tr{border-bottom:1px solid #f3f4f6}
    .notes{background:#f9fafb;border-left:4px solid #CE1126;padding:14px;font-size:14px;line-height:1.7;margin-bottom:20px;border-radius:0 8px 8px 0}
    .foot{text-align:center;padding:16px 24px;font-size:11px;color:#9ca3af;border-top:1px solid #f3f4f6}
  </style></head><body>
  <div class="wrap">
    <div class="hdr"><h1>Appointment Request Update</h1><p>Chief Secretary to Government · Papua New Guinea</p></div>
    <div class="body">
      <p style="font-size:15px;margin-bottom:16px">Dear ${apt.firstName} ${apt.lastName},</p>
      <div class="status"><strong>${statusLabel}</strong><p>${message}</p></div>
      <table>
        <tr><td>Reference</td><td>${apt.id}</td></tr>
        <tr><td>Requested Date</td><td>${prefDate}</td></tr>
        <tr><td>Requested Time</td><td>${apt.prefTime || "-"}</td></tr>
        <tr><td>Reason</td><td>${apt.reason === "Other" ? "Other: " + apt.reasonOther : apt.reason}</td></tr>
      </table>
      ${apt.adminNotes ? `<p style="font-size:13px;font-weight:bold;color:#374151;margin-bottom:8px">Message from the Chief Secretary's Office:</p><div class="notes">${apt.adminNotes}</div>` : ""}
      <p style="font-size:13px;color:#6b7280">If you have any questions, please contact the Chief Secretary's office at Sir Manasupe Haus, Ground Floor VIP Desk.</p>
    </div>
    <div class="foot">Chief Secretary to Government · Independent State of Papua New Guinea<br>This is an automated notification.</div>
  </div></body></html>`;
}
