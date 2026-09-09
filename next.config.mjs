/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Applies to every route.
        source: "/(.*)",
        headers: [
          // Prevents the app from being loaded in an iframe on another
          // site (clickjacking protection).
          { key: "X-Frame-Options", value: "DENY" },
          // Stops the browser from guessing content types away from what
          // the server declared (mitigates some XSS/MIME-sniffing attacks).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Don't leak the full URL (which can contain LGU names, ids,
          // etc.) to external sites via the Referer header.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // This is an internal ops tool — no reason any page needs
          // camera/mic/location access.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Enforced by browsers only over HTTPS; harmless locally over
          // http://localhost. Enable once the app is actually deployed
          // behind HTTPS so browsers refuse to fall back to plain HTTP.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};
export default nextConfig;
