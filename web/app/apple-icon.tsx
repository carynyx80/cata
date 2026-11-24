import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home-screen icon: the slab mark on cream. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5EDE0" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 100, height: 150, borderRadius: 18, border: "7px solid #2B1A22", background: "#FBF6EE", padding: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#E2487F", borderRadius: 7, padding: "3px 7px", color: "#FBF6EE", fontSize: 10, letterSpacing: 1 }}>
            <span>CATA</span>
            <span style={{ fontSize: 15, fontWeight: 900 }}>10</span>
          </div>
          <div style={{ display: "flex", flex: 1, marginTop: 7, borderRadius: 10, background: "#F4C3D3", alignItems: "center", justifyContent: "center", fontSize: 62, fontWeight: 900, color: "#2B1A22" }}>C</div>
        </div>
      </div>
    ),
    size,
  );
}
