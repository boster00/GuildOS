import { Cinzel, Inter } from "next/font/google";
import { getSEOTags } from "@/libs/seo";
import site from "@/libs/council/site";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const font = Inter({ subsets: ["latin"] });
const fantasyFont = Cinzel({ subsets: ["latin"], variable: "--font-fantasy" });

export const viewport = {
  themeColor: site.colors.main,
  width: "device-width",
  initialScale: 1,
};

export const metadata = getSEOTags();

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-theme={site.colors.theme}
      className={`${font.className} ${fantasyFont.variable}`}
    >
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
