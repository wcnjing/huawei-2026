"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { JetBrains_Mono } from "next/font/google";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

type Status = "idle" | "sending" | "sent" | "error";

export default function EmailGate() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const val = email.trim();
    if (!val || status === "sending") return;

    setStatus("sending");
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: val }),
      });

      if (!res.ok) throw new Error("Request failed");
      setStatus("sent");
    } catch (err) {
      console.error("Email send failed:", err);
      setStatus("error");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") submit();
  };

  return (
    <div
      className={jetbrainsMono.className}
      style={{
        background:
          "radial-gradient(ellipse 900px 500px at 20% -10%, rgba(53,224,161,0.07), transparent 60%), radial-gradient(ellipse 700px 500px at 100% 110%, rgba(53,224,161,0.05), transparent 60%), #060a10",
        color: "#e7f3ee",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <style>{`
        @keyframes ts-pulse{ 0%,100%{opacity:1;} 50%{opacity:.35;} }
        .ts-input::placeholder{ color:#56706b; }
        .ts-input:focus{ box-shadow: 0 0 0 1px #35e0a1, 0 0 16px rgba(53,224,161,0.25); }
        .ts-send:hover{ background:rgba(53,224,161,0.08); border-color:#35e0a1 !important; box-shadow:0 0 14px rgba(53,224,161,0.25); }
        .ts-send:active{ transform:translateY(1px); }
      `}</style>

      <div style={{ width: "100%", maxWidth: 480 }}>
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
            HUAWEI TECH4LIFE 2026
          </div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#9fb3ae",
              border: "1px solid #2a3f47",
              borderRadius: 3,
              padding: "5px 10px",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#35e0a1",
                boxShadow: "0 0 8px #35e0a1",
                animation: "ts-pulse 1.8s infinite ease-in-out",
              }}
            />
            TERMINAL LIVE
          </div>
        </div>

        {/* prompt panel */}
        <div
          style={{
            border: "1px solid #2a3f47",
            background: "#0b1119",
            borderRadius: 6,
            padding: "32px 28px",
            boxShadow:
              "0 0 0 1px rgba(53,224,161,0.04), 0 30px 60px -20px rgba(0,0,0,0.6)",
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: "#e7f3ee",
              marginBottom: 20,
              lineHeight: 1.6,
            }}
          >
            <span style={{ color: "#ffb454", marginRight: 10 }}>[SYS]</span>
            Please enter your email address to start.
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              border: "1px solid #1c2b32",
              background: "#0e161f",
              borderRadius: 4,
              padding: "12px 16px",
            }}
          >
            <span style={{ color: "#35e0a1", fontWeight: 700, flexShrink: 0 }}>
              &gt;
            </span>
            <input
              ref={inputRef}
              className="ts-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="you@example.com"
              autoComplete="email"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#e7f3ee",
                fontSize: 14,
                letterSpacing: 0.3,
              }}
            />
          </div>

          <button
            className="ts-send"
            onClick={submit}
            disabled={status === "sending"}
            style={{
              marginTop: 16,
              width: "100%",
              background: "transparent",
              border: "1px solid #1c7a5c",
              color: "#35e0a1",
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              padding: "12px 14px",
              borderRadius: 3,
              cursor: status === "sending" ? "not-allowed" : "pointer",
              opacity: status === "sending" ? 0.6 : 1,
            }}
          >
            {status === "sending"
              ? "Sending..."
              : status === "sent"
              ? "Sent — check your inbox"
              : "Continue"}
          </button>

          {status === "error" && (
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "#ff5f56",
              }}
            >
              [SYS] Something went wrong sending that email. Try again.
            </div>
          )}
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
          Input is processed locally in this page
        </div>
      </div>
    </div>
  );
}