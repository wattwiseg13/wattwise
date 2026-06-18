import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useAuthStore } from "@/store/authStore";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" />;
  const target = user.role === "consumer" ? "/dashboard" : user.role === "municipality" ? "/municipality" : "/technician";
  return <Navigate to={target} />;
}
