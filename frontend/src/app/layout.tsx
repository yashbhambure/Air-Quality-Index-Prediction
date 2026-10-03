import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";

export const metadata: Metadata = {
  title: "AQI Intelligence — AI Environmental Intelligence Platform",
  description:
    "Real-time Air Quality Index prediction powered by PCA dimensionality reduction and Random Forest regression. Monitor PM2.5, PM10, NOx, SO₂, CO, O₃ and more.",
  keywords: ["AQI", "Air Quality Index", "PM2.5", "PCA", "Random Forest", "environmental intelligence"],
  openGraph: {
    title: "AQI Intelligence Platform",
    description: "Atmospheric Intelligence: PCA Dimensionality Reduction & Random Forest Regressor",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@100..900&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.cdnfonts.com/css/google-sans"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased font-sans min-h-screen w-full flex flex-col bg-[#0B0F14] text-[#F8FAFC] overflow-x-hidden">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
