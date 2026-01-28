export const metadata = {
  title: "plubs live",
  description: "Find pubs, clubs, and bar prices near you",
};

import AuthStatus from "@/components/AuthStatus";
import StartupKeyCheck from "@/components/StartupKeyCheck";
import HomeButton from "@/components/HomeButton";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <StartupKeyCheck />
        <div
          style={{
            position: "fixed",
            top: 8,
            right: 12,
            zIndex: 10002,
            background: "#ffffff",
            color: "#111827",
            border: "1px solid #ff3b30",
            borderRadius: 10,
            padding: "6px 10px",
            boxShadow: "0 10px 30px rgba(255,59,48,0.15)",
          }}
        >
          <AuthStatus />
        </div>
        {/* Home button (bottom-left; hidden on home pages) */}
        <HomeButton />
        {children}
      </body>
    </html>
  );
}
