"use client";

import { JetBrains_Mono } from "next/font/google";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export default function DrillRevealPage() {
  return (
    <div
      className={jetbrainsMono.className}
      style={{
        background:
          "radial-gradient(ellipse 900px 500px at 20% -10%, rgba(255,95,86,0.08), transparent 60%), radial-gradient(ellipse 700px 500px at 100% 110%, rgba(53,224,161,0.05), transparent 60%), #060a10",
        color: "#e7f3ee",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 560 }}>
        {/* header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            border: "1px solid #1c2b32",
            background: "linear-gradient(180deg, #0b1119, #0e161f)",
            borderRadius: 4,
            padding: "14px 20px",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: 3,
              color: "#35e0a1",
              textShadow: "0 0 12px rgba(53,224,161,0.35)",
            }}
          >
            SCAM SHIELD
          </div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#ff5f56",
              border: "1px solid #7a2b26",
              borderRadius: 3,
              padding: "5px 10px",
            }}
          >
            Drill Result
          </div>
        </div>

        {/* reveal panel */}
        <div
          style={{
            border: "1px solid #7a2b26",
            background: "#0b1119",
            borderRadius: 6,
            padding: "36px 30px",
            boxShadow:
              "0 0 0 1px rgba(255,95,86,0.05), 0 30px 60px -20px rgba(0,0,0,0.6)",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>

          <div
            style={{
              fontSize: 19,
              fontWeight: 700,
              color: "#ff5f56",
              marginBottom: 14,
              letterSpacing: 0.5,
            }}
          >
            This was a scam.
          </div>

          <p style={{ fontSize: 14, lineHeight: 1.7, color: "#e7f3ee", marginBottom: 16 }}>
            You just clicked a link from a simulated phishing email — part of a{" "}
            <strong style={{ color: "#35e0a1" }}>SafeSpace</strong> safety drill.
            In a real scam, this exact link could have led to a fake login page
            designed to steal your password, OTP, or banking details.
          </p>

          <div
            style={{
              border: "1px solid #1c2b32",
              background: "#0e161f",
              borderRadius: 4,
              padding: "16px 18px",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "#56706b",
                marginBottom: 10,
              }}
            >
              What gave it away
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8, color: "#9fb3ae" }}>
              <li>Urgent, fear-based language ("Immediate Action Required")</li>
              <li>A generic or unofficial-sounding sender identity</li>
              <li>A request to verify account details via a link in an email</li>
              <li>Pressure to act quickly, before you can think it through</li>
            </ul>
          </div>

          <a
            href="/dashboard"
            style={{
              display: "inline-block",
              background: "transparent",
              border: "1px solid #1c7a5c",
              color: "#35e0a1",
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              padding: "12px 20px",
              borderRadius: 3,
              textDecoration: "none",
            }}
          >
            Back to Dashboard
          </a>
        </div>

        <div
          style={{
            marginTop: 16,
            fontSize: 10.5,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "#56706b",
            textAlign: "center",
          }}
        >
          No real data was collected on this page
        </div>
      </div>
    </div>
  );
}