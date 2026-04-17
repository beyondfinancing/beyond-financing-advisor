export default function AdminPage() {
  return (
    <main style={{ padding: 40 }}>
      <h1>Beyond Intelligence Admin</h1>

      <div style={{ marginTop: 20 }}>
        <a href="/admin/users">Manage Users</a>
      </div>

      <div style={{ marginTop: 20 }}>
        <a href="/admin/lenders">Manage Lenders</a>
      </div>
    </main>
  );
}
