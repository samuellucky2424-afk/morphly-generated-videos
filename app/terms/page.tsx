import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Terms of Service — Morphly",
  description: "Terms governing use of the Morphly AI video generation service.",
};

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Legal" title="Terms of Service">
      <section>
        <h2>Using Morphly</h2>
        <p>
          Morphly provides tools for generating video from prompts, images, and
          existing footage. You are responsible for the prompts and media you upload,
          the instructions you provide, and how you use or distribute generated
          output.
        </p>
      </section>
      <section>
        <h2>Your account</h2>
        <p>
          Keep your login credentials secure and provide accurate account
          information. Activity performed through your account is treated as your
          activity. We may restrict access when necessary to protect the service,
          users, or third parties.
        </p>
      </section>
      <section>
        <h2>Credits and generation</h2>
        <p>
          Morphly displays an estimated credit cost before generation. Credits may
          be reserved while a render is active, charged when it completes, or
          returned when an eligible render fails or is cancelled. Purchased credits
          and payment processing may be subject to additional checkout terms.
        </p>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <p>
          Do not use Morphly to violate law, intellectual-property rights, privacy
          rights, platform security, or the safety of another person. Do not upload
          media you are not authorized to use.
        </p>
      </section>
      <section>
        <h2>Availability</h2>
        <p>
          AI generation can be interrupted by model, infrastructure, or storage
          providers. We work to keep job status and credit handling accurate, but the
          service may occasionally be unavailable or delayed.
        </p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>
          Questions about these terms can be sent to{" "}
          <a href="mailto:samuellucky2424@gmail.com">
            samuellucky2424@gmail.com
          </a>.
        </p>
      </section>
    </LegalPage>
  );
}
