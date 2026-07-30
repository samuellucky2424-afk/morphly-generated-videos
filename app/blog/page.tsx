import { LegalPage } from "../legal-page";

export default function BlogPage() {
  return (
    <LegalPage eyebrow="Resources" title="Blog">
      <section>
        <h2>Latest from Morphly</h2>
        <p>
          Read the latest updates, announcements, and tutorials from the Morphly team. Learn about our newest AI video generation models, prompt engineering techniques, and community showcases.
        </p>
        <p>
          Coming soon: Dive deep into the architecture of LTX 2.3 and discover how we optimized generation speed directly within the browser ecosystem.
        </p>
      </section>
    </LegalPage>
  );
}
