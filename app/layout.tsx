export const metadata = {
  title: "Nightlife Finder",
  description: "Pubs, Clubs, and Bars near you",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}

