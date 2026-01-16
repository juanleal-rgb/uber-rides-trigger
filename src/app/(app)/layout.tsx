import { Layout } from "@/components/layout";
import { AuthGuard } from "@/components/auth/auth-guard";

/**
 * App Layout - Wraps all authenticated pages
 * AuthGuard ensures user is authenticated before rendering content
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <Layout>{children}</Layout>
    </AuthGuard>
  );
}
