import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — Morphly",
  description: "How Morphly handles account, media, generation, and payment data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Legal" title="Privacy Policy">
      <section>
        <h2>Information we handle</h2>
        <p>
          Morphly stores the account information needed for authentication and
          profile management, along with wallet balances, credit transactions, and
          generation history associated with your account.
        </p>
      </section>
      <section>
        <h2>Prompts, uploads, and outputs</h2>
        <p>
          Prompts, source images, source videos, and generated outputs are processed
          to provide the generation workflow. Media is stored with account ownership
          metadata so that authenticated users can access their own assets and
          outputs.
        </p>
      </section>
      <section>
        <h2>Service providers</h2>
        <p>
          Morphly uses Supabase for authentication, structured data, and media
          storage; RunPod for asynchronous generation work; and Flutterwave for
          supported payment flows. These providers process data required to perform
          their part of the service.
        </p>
      </section>
      <section>
        <h2>Security and access</h2>
        <p>
          Product and administrator APIs verify authenticated sessions and apply
          server-side authorization. Administrative credit adjustments create
          ledger and audit records.
        </p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>
          You can update supported profile settings, remove eligible uploaded
          assets, and delete eligible generations from the studio. Contact us if you
          need help with account or privacy requests.
        </p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>
          Privacy questions can be sent to{" "}
          <a href="mailto:samuellucky2424@gmail.com">
            samuellucky2424@gmail.com
          </a>.
        </p>
      </section>
    </LegalPage>
  );
}
