"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-xl px-3 py-1.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
    >
      Sign out
    </button>
  );
}
