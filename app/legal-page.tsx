import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";

export function LegalPage({
  children,
  eyebrow,
  title,
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="legal-site">
      <header>
        <nav aria-label="Legal page navigation">
          <Link aria-label="Morphly home" className="legal-brand" href="/">
            <span><Sparkles /></span>
            <b>Morphly</b>
            <em>LTX 2.3</em>
          </Link>
          <div>
            <Link href="/#product">Product</Link>
            <Link href="/#gallery">Gallery</Link>
            <Link href="/?view=auth">Sign in</Link>
            <Link className="legal-create" href="/?view=dashboard">
              Create video <ArrowRight />
            </Link>
          </div>
        </nav>
      </header>
      <main>
        <Link className="legal-back" href="/">
          <ArrowLeft /> Back to Morphly
        </Link>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p className="legal-effective">Effective July 26, 2026</p>
        <article>{children}</article>
      </main>
      <footer>
        <span>© 2026 Morphly</span>
        <div>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <a href="mailto:samuellucky2424@gmail.com">Contact</a>
        </div>
      </footer>
    </div>
  );
}
