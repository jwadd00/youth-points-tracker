import "./globals.css";
import Nav from "@/components/Nav";

export const metadata = {
  title: "Rock Youth Rewards",
  description: "Youth group rewards and engagement tracker"
};

export const runtime = "nodejs";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
