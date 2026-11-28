import type { NextConfig } from "next";

// Cabeceras de seguridad para todas las páginas y la API.
// - No se puede incrustar la app en otra web (evita "clickjacking").
// - El navegador no "adivina" tipos de archivo.
// - No se envía la dirección completa a otras webs al seguir un enlace.
// - Solo se permite el micrófono (dictado) y la ubicación desde la propia app;
//   cámara y pagos quedan desactivados.
// - Fuerza HTTPS durante dos años.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(self), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
