import { useState, useEffect, useCallback, useRef } from "react";

// ─── Config from environment variables (set in Netlify dashboard) ─────────────
const SB_URL      = process.env.REACT_APP_SUPABASE_URL || "";
const SB_KEY      = process.env.REACT_APP_SUPABASE_ANON_KEY || "";
const ADMIN_EMAIL = process.env.REACT_APP_ADMIN_EMAIL || "";
const ADMIN_PASS  = process.env.REACT_APP_ADMIN_PASSWORD || "admin2024";

// ─── Brand colours ────────────────────────────────────────────────────────────
const PNG_RED  = "#CE1126";
const PNG_GOLD = "#FCD116";

// ─── Supabase REST helpers ────────────────────────────────────────────────────
async function sbReq(method, table, body, query = "") {
  const res = await fetch(`${SB_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message || e.hint || `HTTP ${res.status}`);
  }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

async function getAppointments() {
  const rows = await sbReq("GET", "appointments", null, "?order=submitted_at.desc");
  return (rows || []).map(fromDb);
}
async function insertAppointment(apt) {
  await sbReq("POST", "appointments", toDb(apt));
}
async function updateAppointment(id, changes) {
  const patch = { updated_at: new Date().toISOString() };
  if ("status"     in changes) patch.status      = changes.status;
  if ("adminNotes" in changes) patch.admin_notes = changes.adminNotes;
  await sbReq("PATCH", "appointments", patch, `?id=eq.${id}`);
}
async function triggerEmail(type, apt) {
  if (!SB_URL) return;
  try {
    await fetch(`${SB_URL}/functions/v1/send-appointment-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SB_KEY}` },
      body: JSON.stringify({ type, appointment: apt, adminEmail: ADMIN_EMAIL }),
    });
  } catch (e) { console.warn("Email trigger failed:", e.message); }
}

// ─── DB mappers ───────────────────────────────────────────────────────────────
function toDb(a) {
  return {
    id: a.id, first_name: a.firstName, last_name: a.lastName,
    phone: a.phone, email: a.email, position: a.position,
    organisation: a.organisation, reason: a.reason,
    reason_other: a.reasonOther || null, pref_date: a.prefDate || null,
    pref_time: a.prefTime || null, duration: a.duration,
    has_docs: a.hasDocs, description: a.description,
    status: "pending", admin_notes: "", submitted_at: a.submittedAt,
  };
}
function fromDb(r) {
  return {
    id: r.id, firstName: r.first_name, lastName: r.last_name,
    phone: r.phone, email: r.email, position: r.position,
    organisation: r.organisation, reason: r.reason,
    reasonOther: r.reason_other || "", prefDate: r.pref_date || "",
    prefTime: r.pref_time || "", duration: r.duration,
    hasDocs: r.has_docs, description: r.description,
    status: r.status, adminNotes: r.admin_notes || "",
    submittedAt: r.submitted_at, updatedAt: r.updated_at,
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function genId() {
  return "APT-" + Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).slice(2, 5).toUpperCase();
}
function fmtDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-PG", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────
const REASONS = [
  "Meeting", "Presentation Request", "Briefing Request",
  "Correspondence Reference", "General Inquiry", "Other",
];
const STATUSES = {
  pending:  { label: "Pending",  color: "#92400e", bg: "#fef3c7", border: "#fbbf24" },
  approved: { label: "Approved", color: "#065f46", bg: "#d1fae5", border: "#34d399" },
  declined: { label: "Declined", color: "#991b1b", bg: "#fee2e2", border: "#f87171" },
};

// ─── Shared styles ────────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%", padding: "10px 12px", border: "1px solid #ddd",
  borderRadius: 8, fontSize: 14, boxSizing: "border-box",
  background: "#fff", color: "#111827", fontFamily: "inherit", outline: "none",
};
const labelStyle = {
  display: "block", fontSize: 13, fontWeight: 600,
  color: "#374151", marginBottom: 6,
};
const errStyle = { fontSize: 12, color: PNG_RED, marginTop: 4 };

// ─── Shared components ────────────────────────────────────────────────────────
function Badge({ status }) {
  const s = STATUSES[status];
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: 20, padding: "2px 12px", fontSize: 12,
      fontWeight: 600, display: "inline-block",
    }}>{s.label}</span>
  );
}

function Toast({ msg, ok }) {
  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 9999,
      background: ok ? "#065f46" : PNG_RED, color: "#fff",
      borderRadius: 10, padding: "12px 20px", fontSize: 14,
      fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", maxWidth: 320,
    }}>{msg}</div>
  );
}

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Coat_of_arms_of_Papua_New_Guinea.svg/100px-Coat_of_arms_of_Papua_New_Guinea.svg.png"
        alt="PNG Coat of Arms"
        style={{ height: 52, width: "auto" }}
        onError={e => { e.target.style.display = "none"; }}
      />
      <div>
        <div style={{ fontSize: 11, letterSpacing: 2, color: "#666", textTransform: "uppercase", fontWeight: 600 }}>
          Independent State of Papua New Guinea
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.3 }}>
          Office of the Chief Secretary to Government
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        background: "#f1f5f9", borderLeft: `4px solid ${PNG_RED}`,
        padding: "8px 14px", marginBottom: 16, borderRadius: "0 6px 6px 0",
        fontSize: 13, fontWeight: 700, color: "#1a1a1a",
        textTransform: "uppercase", letterSpacing: 0.5,
      }}>{title}</div>
      {children}
    </div>
  );
}

function NavBtn({ label, active, onClick, badge }) {
  return (
    <button onClick={onClick} style={{
      background: active ? PNG_RED : "#fff",
      color: active ? "#fff" : "#374151",
      border: `1px solid ${active ? PNG_RED : "#e5e7eb"}`,
      borderRadius: 8, padding: "8px 16px", cursor: "pointer",
      fontWeight: 600, fontSize: 13, position: "relative",
    }}>
      {label}
      {badge > 0 && (
        <span style={{
          position: "absolute", top: -6, right: -6,
          background: PNG_GOLD, color: "#000", borderRadius: "50%",
          width: 18, height: 18, fontSize: 10, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{badge}</span>
      )}
    </button>
  );
}

// ─── Public Booking Form ──────────────────────────────────────────────────────
const EMPTY_FORM = {
  firstName: "", lastName: "", phone: "", email: "",
  position: "", organisation: "", reason: "", reasonOther: "",
  prefDate: "", prefTime: "", duration: "", hasDocs: "", description: "",
};

function PublicForm() {
  const [form, setForm]       = useState(EMPTY_FORM);
  const [errors, setErrors]   = useState({});
  const [submitting, setSub]  = useState(false);
  const [submitted, setDone]  = useState(false);
  const [refId, setRefId]     = useState("");
  const [submitErr, setErr]   = useState("");

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function validate() {
    const e = {};
    if (!form.firstName.trim())    e.firstName    = "Required";
    if (!form.lastName.trim())     e.lastName     = "Required";
    if (!form.phone.trim())        e.phone        = "Required";
    if (!form.email.includes("@")) e.email        = "Valid email required";
    if (!form.position.trim())     e.position     = "Required";
    if (!form.organisation.trim()) e.organisation = "Required";
    if (!form.reason)              e.reason       = "Please select a reason";
    if (form.reason === "Other" && !form.reasonOther.trim()) e.reasonOther = "Please specify";
    if (!form.prefDate)            e.prefDate     = "Required";
    if (!form.prefTime)            e.prefTime     = "Required";
    if (!form.duration.trim())     e.duration     = "Required";
    if (!form.hasDocs)             e.hasDocs      = "Required";
    if (!form.description.trim())  e.description  = "Required";
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSub(true); setErr("");
    try {
      const id  = genId();
      const apt = { ...form, id, status: "pending", adminNotes: "", submittedAt: new Date().toISOString() };
      await insertAppointment(apt);
      await triggerEmail("new_appointment", apt);
      setRefId(id); setDone(true);
    } catch (err) { setErr("Submission failed: " + err.message); }
    finally { setSub(false); }
  }

  if (submitted) return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 1rem 2rem", textAlign: "center" }}>
      <div style={{ background: "#d1fae5", border: "1px solid #34d399", borderRadius: 16, padding: "2rem", marginBottom: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#065f46", marginBottom: 8 }}>
          Appointment Request Submitted
        </div>
        <div style={{ fontSize: 14, color: "#047857", marginBottom: 20 }}>
          Your request is pending review. A confirmation email has been sent to you.
        </div>
        <div style={{ background: "#fff", border: "1px solid #a7f3d0", borderRadius: 10, padding: "12px 24px", display: "inline-block" }}>
          <div style={{ fontSize: 11, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase" }}>Reference Number</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#065f46", letterSpacing: 3 }}>{refId}</div>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
        This submission is a request and does not guarantee availability.
        The proposed date and time are subject to confirmation by the Chief Secretary's office.
      </p>
      <button
        onClick={() => { setDone(false); setForm(EMPTY_FORM); setErrors({}); }}
        style={{ background: PNG_RED, color: "#fff", border: "none", borderRadius: 8, padding: "10px 28px", fontWeight: 600, cursor: "pointer", fontSize: 14 }}
      >Submit Another Request</button>
    </div>
  );

  const F = ({ label, k, type = "text" }) => (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>{label} <span style={{ color: PNG_RED }}>*</span></label>
      <input type={type} value={form[k]} onChange={set(k)}
        style={{ ...inputStyle, borderColor: errors[k] ? PNG_RED : "#ddd" }} />
      {errors[k] && <div style={errStyle}>{errors[k]}</div>}
    </div>
  );

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 1rem 2rem" }}>
      <div style={{ background: PNG_RED, borderRadius: 12, padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Appointment Request Form</div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 }}>
            Sir Manasupe Haus, Ground Floor VIP Desk · Effective 28 November 2023
          </div>
        </div>
        <div style={{ background: PNG_GOLD, borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, color: "#000" }}>OFFICIAL</div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <Section title="Personal Information">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <F label="First Name" k="firstName" />
            <F label="Last Name"  k="lastName" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <F label="Phone Number"  k="phone" type="tel" />
            <F label="Email Address" k="email" type="email" />
          </div>
          <F label="Current Position / Title" k="position" />
          <F label="Organisation / Department / Division" k="organisation" />
        </Section>

        <Section title="Appointment Details">
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Reason for Appointment <span style={{ color: PNG_RED }}>*</span></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              {REASONS.map(r => (
                <label key={r} style={{
                  display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                  background: form.reason === r ? "#fff7ed" : "#fafafa",
                  border: `1px solid ${form.reason === r ? PNG_RED : "#e5e7eb"}`,
                  borderRadius: 8, padding: "10px 14px", fontSize: 14,
                }}>
                  <input type="radio" name="reason" value={r}
                    checked={form.reason === r} onChange={set("reason")}
                    style={{ accentColor: PNG_RED }} />
                  {r}
                </label>
              ))}
            </div>
            {errors.reason && <div style={errStyle}>{errors.reason}</div>}
          </div>

          {form.reason === "Other" && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Please specify <span style={{ color: PNG_RED }}>*</span></label>
              <input value={form.reasonOther} onChange={set("reasonOther")}
                style={{ ...inputStyle, borderColor: errors.reasonOther ? PNG_RED : "#ddd" }} />
              {errors.reasonOther && <div style={errStyle}>{errors.reasonOther}</div>}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Preferred Date <span style={{ color: PNG_RED }}>*</span></label>
              <input type="date" value={form.prefDate} onChange={set("prefDate")}
                min={new Date().toISOString().split("T")[0]}
                style={{ ...inputStyle, borderColor: errors.prefDate ? PNG_RED : "#ddd" }} />
              {errors.prefDate && <div style={errStyle}>{errors.prefDate}</div>}
            </div>
            <div>
              <label style={labelStyle}>Preferred Time <span style={{ color: PNG_RED }}>*</span></label>
              <input type="time" value={form.prefTime} onChange={set("prefTime")}
                style={{ ...inputStyle, borderColor: errors.prefTime ? PNG_RED : "#ddd" }} />
              {errors.prefTime && <div style={errStyle}>{errors.prefTime}</div>}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Estimated Duration <span style={{ color: PNG_RED }}>*</span></label>
            <input placeholder="e.g. 30 minutes, 1 hour" value={form.duration} onChange={set("duration")}
              style={{ ...inputStyle, borderColor: errors.duration ? PNG_RED : "#ddd" }} />
            {errors.duration && <div style={errStyle}>{errors.duration}</div>}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Documents to be Discussed or Presented? <span style={{ color: PNG_RED }}>*</span></label>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              {["Yes", "No"].map(v => (
                <label key={v} style={{
                  display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                  background: form.hasDocs === v ? "#fff7ed" : "#fafafa",
                  border: `1px solid ${form.hasDocs === v ? PNG_RED : "#e5e7eb"}`,
                  borderRadius: 8, padding: "10px 20px", fontSize: 14,
                }}>
                  <input type="radio" name="hasDocs" value={v}
                    checked={form.hasDocs === v} onChange={set("hasDocs")}
                    style={{ accentColor: PNG_RED }} />
                  {v}
                </label>
              ))}
            </div>
            {errors.hasDocs && <div style={errStyle}>{errors.hasDocs}</div>}
          </div>
        </Section>

        <Section title="Additional Information">
          <label style={labelStyle}>Brief Description of Purpose <span style={{ color: PNG_RED }}>*</span></label>
          <textarea value={form.description} onChange={set("description")} rows={5}
            placeholder="Describe the purpose of your appointment request..."
            style={{ ...inputStyle, resize: "vertical", height: "auto", borderColor: errors.description ? PNG_RED : "#ddd" }} />
          {errors.description && <div style={errStyle}>{errors.description}</div>}
        </Section>

        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px", marginBottom: 24, fontSize: 13, color: "#6b7280" }}>
          <strong style={{ color: "#374151" }}>Confirmation:</strong> I understand that submitting this form is a request for an appointment and does not guarantee availability. I acknowledge that the proposed appointment date and time are subject to confirmation by the Chief Secretary's office.
        </div>

        {submitErr && (
          <div style={{ background: "#fee2e2", border: "1px solid #f87171", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#991b1b", marginBottom: 16 }}>
            {submitErr}
          </div>
        )}

        <button type="submit" disabled={submitting} style={{
          width: "100%", background: submitting ? "#6b7280" : PNG_RED,
          color: "#fff", border: "none", borderRadius: 10, padding: "14px",
          fontSize: 16, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer",
        }}>
          {submitting ? "Submitting..." : "Submit Appointment Request"}
        </button>
      </form>
    </div>
  );
}

// ─── Admin Login ──────────────────────────────────────────────────────────────
function AdminLogin({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  function attempt(e) {
    e.preventDefault();
    if (pw === ADMIN_PASS) { onLogin(); setErr(""); }
    else setErr("Incorrect password. Please try again.");
  }
  return (
    <div style={{ maxWidth: 380, margin: "0 auto", padding: "2rem 1rem" }}>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "2rem", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, background: PNG_RED, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 22 }}>🔐</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Admin Access</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Chief Secretary's Office</div>
        </div>
        <form onSubmit={attempt}>
          <label style={labelStyle}>Administrator Password</label>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)}
            placeholder="Enter password" style={inputStyle} autoFocus />
          {err && <div style={{ ...errStyle, marginTop: 8 }}>{err}</div>}
          <button type="submit" style={{
            width: "100%", background: PNG_RED, color: "#fff", border: "none",
            borderRadius: 8, padding: "12px", fontWeight: 700, cursor: "pointer", marginTop: 16, fontSize: 14,
          }}>Sign In</button>
        </form>
      </div>
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboard({ onLogout, showToast }) {
  const [apts, setApts]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("all");
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState(null);
  const [notes, setNotes]       = useState("");
  const [saving, setSaving]     = useState(false);
  const prevCount               = useRef(0);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getAppointments();
      if (silent && data.length > prevCount.current) {
        showToast(`${data.length - prevCount.current} new request(s) received`, true);
      }
      prevCount.current = data.length;
      setApts(data);
    } catch (e) { showToast("Failed to load: " + e.message, false); }
    finally { if (!silent) setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => load(true), 60000);
    return () => clearInterval(t);
  }, [load]);

  const counts = { all: apts.length, pending: 0, approved: 0, declined: 0 };
  apts.forEach(a => { counts[a.status]++; });

  const filtered = apts.filter(a => {
    const ok = filter === "all" || a.status === filter;
    const q  = search.toLowerCase();
    return ok && (!q || `${a.firstName} ${a.lastName} ${a.organisation} ${a.id}`.toLowerCase().includes(q));
  });

  async function changeStatus(id, status) {
    setSaving(true);
    try {
      await updateAppointment(id, { status, adminNotes: notes });
      const apt = apts.find(a => a.id === id);
      if (apt) await triggerEmail("status_update", { ...apt, status, adminNotes: notes });
      setApts(prev => prev.map(a => a.id === id ? { ...a, status, adminNotes: notes } : a));
      setSelected(s => s ? { ...s, status, adminNotes: notes } : null);
      showToast(`Appointment ${status}`, true);
    } catch (e) { showToast("Update failed: " + e.message, false); }
    finally { setSaving(false); }
  }

  if (selected) return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 1rem 2rem" }}>
      <button onClick={() => setSelected(null)}
        style={{ background: "none", border: "none", color: PNG_RED, cursor: "pointer", fontWeight: 600, fontSize: 14, marginBottom: 16, padding: 0 }}>
        ← Back to Dashboard
      </button>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ background: PNG_RED, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{selected.firstName} {selected.lastName}</div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 }}>Ref: {selected.id}</div>
          </div>
          <Badge status={selected.status} />
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", marginBottom: 16 }}>
            {[
              ["Full Name",    `${selected.firstName} ${selected.lastName}`],
              ["Phone",        selected.phone],
              ["Email",        selected.email],
              ["Position",     selected.position],
              ["Organisation", selected.organisation],
              ["Reason",       selected.reason === "Other" ? `Other: ${selected.reasonOther}` : selected.reason],
              ["Preferred Date", selected.prefDate ? new Date(selected.prefDate).toLocaleDateString("en-PG", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }) : "-"],
              ["Preferred Time", selected.prefTime || "-"],
              ["Duration",     selected.duration],
              ["Documents",    selected.hasDocs],
              ["Submitted",    fmtDate(selected.submittedAt)],
            ].map(([k, v]) => (
              <div key={k} style={{ background: "#f9fafb", borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{v || "-"}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "#f9fafb", borderLeft: `4px solid ${PNG_RED}`, borderRadius: "0 8px 8px 0", padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Purpose Description</div>
            <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.7 }}>{selected.description}</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              Admin Notes
              <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400, marginLeft: 6 }}>(included in email to applicant)</span>
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="e.g. Confirmed for 10:00 AM, Level 3 Conference Room B..."
              style={{ ...inputStyle, resize: "vertical", height: "auto" }} />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { s: "approved", label: "✓ Approve",  color: "#065f46", bg: "#d1fae5", border: "#34d399" },
              { s: "pending",  label: "⏳ Pending",  color: "#92400e", bg: "#fef3c7", border: "#fbbf24" },
              { s: "declined", label: "✕ Decline",  color: "#991b1b", bg: "#fee2e2", border: "#f87171" },
            ].map(({ s, label, color, bg, border }) => (
              <button key={s} onClick={() => changeStatus(selected.id, s)} disabled={saving}
                style={{
                  flex: 1, minWidth: 120,
                  background: selected.status === s ? bg : "#fff",
                  color, border: `1px solid ${border}`,
                  borderRadius: 8, padding: "10px 18px",
                  cursor: saving ? "not-allowed" : "pointer",
                  fontWeight: 700, fontSize: 14,
                }}>{label}</button>
            ))}
          </div>
          {saving && <div style={{ marginTop: 10, fontSize: 13, color: "#6b7280", textAlign: "center" }}>Saving…</div>}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 1rem 2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Appointment Requests</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => load()}
            style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, color: "#374151" }}>
            ↻ Refresh
          </button>
          <button onClick={onLogout}
            style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, color: "#6b7280" }}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { key: "all",      label: "Total",    color: "#374151", bg: "#f3f4f6" },
          { key: "pending",  label: "Pending",  color: "#92400e", bg: "#fef3c7" },
          { key: "approved", label: "Approved", color: "#065f46", bg: "#d1fae5" },
          { key: "declined", label: "Declined", color: "#991b1b", bg: "#fee2e2" },
        ].map(({ key, label, color, bg }) => (
          <div key={key} onClick={() => setFilter(key)} style={{
            background: filter === key ? bg : "#fafafa",
            border: `1px solid ${filter === key ? color : "#e5e7eb"}`,
            borderRadius: 10, padding: "12px 14px", cursor: "pointer", textAlign: "center",
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: filter === key ? color : "#374151" }}>{counts[key]}</div>
            <div style={{ fontSize: 12, color: filter === key ? color : "#6b7280", fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by name, organisation or reference number..."
        style={{ ...inputStyle, marginBottom: 16 }} />

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#9ca3af", fontSize: 14 }}>Loading appointments…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#9ca3af", fontSize: 14 }}>No appointment requests found.</div>
      ) : filtered.map(apt => (
        <div key={apt.id}
          onClick={() => { setSelected(apt); setNotes(apt.adminNotes || ""); }}
          style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", cursor: "pointer", marginBottom: 10 }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{apt.firstName} {apt.lastName}</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{apt.position} · {apt.organisation}</div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                {apt.reason === "Other" ? `Other: ${apt.reasonOther}` : apt.reason} ·&nbsp;
                {apt.prefDate ? new Date(apt.prefDate).toLocaleDateString("en-PG", { day: "2-digit", month: "short", year: "numeric" }) : ""} at {apt.prefTime}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <Badge status={apt.status} />
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>{apt.id}</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Submitted {fmtDate(apt.submittedAt)}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView]       = useState("public");
  const [adminAuth, setAuth]  = useState(false);
  const [toast, setToast]     = useState(null);
  const [apts, setApts]       = useState([]);

  useEffect(() => {
    if (!SB_URL || !SB_KEY) return;
    getAppointments().then(setApts).catch(() => {});
  }, []);

  const showToast = useCallback((msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const pendingCount = apts.filter(a => a.status === "pending").length;

  if (!SB_URL || !SB_KEY) {
    return (
      <div style={{ maxWidth: 560, margin: "4rem auto", padding: "0 1rem", textAlign: "center" }}>
        <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 12, padding: "2rem", fontSize: 14, color: "#92400e" }}>
          <strong>Environment variables not configured.</strong><br /><br />
          Please set the following in your Netlify dashboard under<br />
          <strong>Site Settings → Environment Variables:</strong><br /><br />
          <code style={{ display: "block", textAlign: "left", background: "#fff", padding: "1rem", borderRadius: 8, lineHeight: 2 }}>
            REACT_APP_SUPABASE_URL<br />
            REACT_APP_SUPABASE_ANON_KEY<br />
            REACT_APP_ADMIN_EMAIL<br />
            REACT_APP_ADMIN_PASSWORD
          </code>
          <br />Then trigger a redeploy in Netlify.
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", minHeight: "100vh", background: "#f8f8f6" }}>
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      <header style={{
        background: "#fff", borderBottom: `3px solid ${PNG_RED}`,
        padding: "14px 20px", marginBottom: 24,
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
      }}>
        <Logo />
        <div style={{ display: "flex", gap: 8 }}>
          <NavBtn label="Book Appointment" active={view === "public"} onClick={() => setView("public")} />
          <NavBtn label="Admin" active={view === "admin"} onClick={() => setView("admin")} badge={pendingCount} />
        </div>
      </header>

      {view === "public" && <PublicForm />}
      {view === "admin" && !adminAuth && <AdminLogin onLogin={() => setAuth(true)} />}
      {view === "admin" &&  adminAuth && <AdminDashboard onLogout={() => { setAuth(false); setView("public"); }} showToast={showToast} />}

      <footer style={{ textAlign: "center", padding: "2rem 1rem", color: "#9ca3af", fontSize: 12, borderTop: "1px solid #e5e7eb", marginTop: 40 }}>
        Chief Secretary to Government · Independent State of Papua New Guinea<br />
        Authorised by: Ivan Pomaleu, OBE — Chief Secretary · Effective 28 November 2023
      </footer>
    </div>
  );
}
