import type { Config } from "@react-router/dev/config";

export default {
  // Production web is served as static files by nginx.
  ssr: false,
} satisfies Config;
