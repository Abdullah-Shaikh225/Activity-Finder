import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { GoogleAuthWrapper } from "./context/GoogleAuthWrapper";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Activity Finder — Discover Things To Do Near You",
  description:
    "Find parties, restaurants, cafes, and group activities near your location. Use GPS or search by address to discover exciting nearby places.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body
        className="min-h-full flex flex-col"
        style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
      >
        <GoogleAuthWrapper>
          <AuthProvider>{children}</AuthProvider>
        </GoogleAuthWrapper>
      </body>
    </html>
  );
}
