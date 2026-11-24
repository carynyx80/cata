import { ImageResponse } from "next/og";

export const alt = "Cata — pull something real.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#F5EDE0", padding: 72, alignItems: "center", justifyContent: "space-between", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 680 }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, color: "#E2487F", textTransform: "uppercase" }}>catapacks.xyz · bnb chain</div>
          <div style={{ display: "flex", flexWrap: "wrap", marginTop: 24, fontSize: 112, lineHeight: 0.95, fontWeight: 900, color: "#2B1A22", letterSpacing: -2 }}>
            pull something <span style={{ color: "#E2487F", marginLeft: 24 }}>real.</span>
          </div>
          <div style={{ display: "flex", marginTop: 32, fontSize: 30, color: "#5E4652" }}>rip it. flip it. bet on it. borrow on it. ship it.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", width: 300, height: 450, borderRadius: 54, border: "18px solid #2B1A22", background: "#FBF6EE", padding: 22, transform: "rotate(6deg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#E2487F", borderRadius: 18, padding: "14px 22px", color: "#FBF6EE" }}>
            <span style={{ fontSize: 24, letterSpacing: 4 }}>CATA</span>
            <span style={{ fontSize: 44, fontWeight: 900 }}>10</span>
          </div>
          <div style={{ display: "flex", flex: 1, marginTop: 20, borderRadius: 28, background: "#F4C3D3", alignItems: "center", justifyContent: "center", fontSize: 200, fontWeight: 900, color: "#2B1A22" }}>C</div>
        </div>
      </div>
    ),
    size,
  );
}
