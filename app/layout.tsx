import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chess",
  description: "Simple, clean chess. Play with a friend in seconds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("chess-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}if(t==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
