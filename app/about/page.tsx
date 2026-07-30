import { LegalPage } from "../legal-page";

export default function AboutPage() {
  return (
    <LegalPage eyebrow="Company" title="About Us">
      <section>
        <h2>Our Mission</h2>
        <p>
          Morphly is dedicated to democratizing high-quality video generation through state-of-the-art AI. We believe that professional-grade videography should be accessible to everyone, directly from their browser, without the need for expensive hardware or complex software.
        </p>
        <p>
          Our flagship model, LTX 2.3, represents a significant leap forward in multimodal video generation, combining unparalleled ease of use with breathtaking visual fidelity.
        </p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>
          For business inquiries, partnerships, or general questions, please reach out to us at <a href="mailto:samuellucky2424@gmail.com">samuellucky2424@gmail.com</a>.
        </p>
      </section>
    </LegalPage>
  );
}
