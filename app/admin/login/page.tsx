import { configured } from '@/lib/server/db';
import { LoginForm } from '@/components/admin/controls';
export default function LoginPage() {
  const ready = configured() && Boolean(process.env.SUPABASE_SECRET_KEY);
  return (
    <div className="admin-login">
      <p className="admin-kicker">A little space to run your store</p>
      <h1>Welcome back.</h1>
      <p className="muted" style={{ margin: '1rem 0 2rem' }}>
        Manage your collection, care for your orders, and make yourself at home.
      </p>
      <section className="admin-panel">
        <h2>Administrator sign in</h2>
        {!ready && (
          <div className="admin-note">
            Connect Supabase and create your first administrator using the setup guide before
            signing in. Store administration is closed until setup is complete.
          </div>
        )}
        <LoginForm configured={ready} />
      </section>
      <p className="muted" style={{ fontSize: 12 }}>
        Access is restricted to approved store administrators.
      </p>
    </div>
  );
}
