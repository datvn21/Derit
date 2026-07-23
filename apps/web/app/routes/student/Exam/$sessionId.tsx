import React from "react";
import Layout from "~/components/Exam/Layout";
import { useRequireRole } from "~/hooks/useAuth";

export default function $sessionId() {
  const user = useRequireRole("student");
  if (!user) return null;
  return <Layout />;
}
