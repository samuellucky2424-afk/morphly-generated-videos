import { LegalPage } from "../legal-page";

export default function DocsPage() {
  return (
    <LegalPage eyebrow="Resources" title="Documentation">
      <section>
        <h2>Morphly Documentation</h2>
        <p>
          Welcome to the Morphly API and usage documentation. Here you can find comprehensive guides on how to integrate and use the Morphly LTX 2.3 model in your workflows.
        </p>
        <p>
          Our documentation is currently being updated to reflect the new multimodal capabilities. Please check back soon for detailed endpoints, SDK usage, and video generation parameters.
        </p>
      </section>
    </LegalPage>
  );
}
