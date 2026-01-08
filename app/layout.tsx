export const metadata = {
  title: "Nightlife Finder",
  description: "Pubs, Clubs, and Bars near you",
};

import AuthStatus from "@/components/AuthStatus";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <div style={{ position: "fixed", top: 8, right: 12, zIndex: 10, background: "rgba(255,255,255,0.85)", borderRadius: 6, padding: "6px 10px", boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>
          <AuthStatus />
        </div>
        {children}
      </body>
    </html>
  );
}
