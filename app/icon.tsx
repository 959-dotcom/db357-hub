import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "32px",
          height: "32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#060709",
          color: "#E5C158",
          border: "1px solid #D4AF37",
          borderRadius: "8px",
          fontSize: 9,
          letterSpacing: 0.4,
        }}
      >
        DB
      </div>
    ),
    size,
  );
}
