"use client";

import {
  ArrowRight,
  Check,
  Film,
  Image as ImageIcon,
  Menu,
  MessageSquareText,
  Play,
  Settings2,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { DashboardStudio as LiveDashboard } from "./dashboard-studio";
import { LiveAuth } from "./live-auth";
import { createClient } from "@/src/lib/supabase/client";

type View = "home" | "dashboard" | "auth";
type DashboardSection = "create" | "videos" | "assets" | "billing";

type VideoSpec = {
  duration: string;
  mode: string;
  poster: string;
  prompt: string;
  resolution: string;
  src: string;
  title: string;
};

const HERO_VIDEO: VideoSpec = {
  duration: "8 seconds",
  mode: "Text to video",
  poster: "/media/morphly-hero-poster.webp",
  prompt:
    "A graphite performance coupe moves through a rain-soaked city at blue hour, controlled dolly shot, natural reflections.",
  resolution: "1024 × 576",
  src: "/media/morphly-hero.mp4",
  title: "Blue-hour motion study",
};

const GALLERY_VIDEOS: VideoSpec[] = [
  HERO_VIDEO,
  {
    duration: "5 seconds",
    mode: "Image to video",
    poster: "/media/morphly-image-motion-poster.webp",
    prompt: "Subtle portrait motion with a slow camera push and preserved facial detail.",
    resolution: "576 × 1024",
    src: "/media/morphly-image-motion.mp4",
    title: "Portrait motion test",
  },
  {
    duration: "8 seconds",
    mode: "Video to video",
    poster: "/media/morphly-video-transform-poster.webp",
    prompt: "Restyle the source footage with restrained cinematic color and stable movement.",
    resolution: "768 × 432",
    src: "/media/morphly-video-transform.mp4",
    title: "Footage transformation",
  },
  {
    duration: "3 seconds",
    mode: "Text to video",
    poster: "/media/morphly-product-study-poster.webp",
    prompt: "Minimal product turntable, soft directional light, clean dark studio.",
    resolution: "512 × 512",
    src: "/media/morphly-product-study.mp4",
    title: "Product study",
  },
];

const MODE_ROWS = [
  {
    action: "Start with a prompt",
    description:
      "Describe the subject, motion, camera, lighting, and atmosphere. Morphly turns the direction into a new video.",
    icon: MessageSquareText,
    input: "Text direction",
    mode: "Text to video",
    output: "A generated video",
  },
  {
    action: "Animate an image",
    description:
      "Upload a source image, select it from your asset library, and direct the movement without changing modes.",
    icon: ImageIcon,
    input: "JPG, PNG, or WebP",
    mode: "Image to video",
    output: "A motion sequence",
  },
  {
    action: "Transform a clip",
    description:
      "Upload existing footage and provide a new visual direction while preserving the source movement.",
    icon: Video,
    input: "MP4, MOV, or WebM",
    mode: "Video to video",
    output: "A transformed video",
  },
];

function Brand() {
  return (
    <a aria-label="Morphly home" className="mkt-brand" href="#top">
      <span>
        <Sparkles />
      </span>
      <b>Morphly</b>
      <em>LTX 2.3</em>
    </a>
  );
}

function MarketingHeader({
  onCreate,
  onSignIn,
}: {
  onCreate: () => void;
  onSignIn: () => void;
}) {
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
  }

  return (
    <header className="mkt-header">
      <nav aria-label="Primary navigation" className="mkt-nav">
        <Brand />
        <div className={`mkt-nav-links ${open ? "open" : ""}`}>
          <a href="#product" onClick={close}>Product</a>
          <a href="#gallery" onClick={close}>Gallery</a>
          <a href="#pricing" onClick={close}>Pricing</a>
          <a href="#how-it-works" onClick={close}>How it works</a>
        </div>
        <div className="mkt-nav-actions">
          <button className="mkt-sign-in" onClick={onSignIn} type="button">
            Sign in
          </button>
          <button className="mkt-primary compact" onClick={onCreate} type="button">
            Create video <ArrowRight />
          </button>
          <button
            aria-expanded={open}
            aria-label={open ? "Close navigation" : "Open navigation"}
            className="mkt-menu"
            onClick={() => setOpen((current) => !current)}
            type="button"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </nav>
    </header>
  );
}

function AssetSlot({
  children,
  filename,
}: {
  children?: ReactNode;
  filename: string;
}) {
  return (
    <div className="mkt-asset-slot">
      {children ?? <Film />}
      <b>Product media slot</b>
      <span>Add a real Morphly output at</span>
      <code>{filename}</code>
    </div>
  );
}

function HeroBackgroundVideo() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return null;
  }

  return (
    <div aria-hidden="true" className="mkt-hero-media">
      <video
        autoPlay
        loop
        muted
        onCanPlay={(event) => {
          event.currentTarget.muted = true;
          void event.currentTarget.play().catch(() => undefined);
        }}
        onError={() => setFailed(true)}
        playsInline
        preload="auto"
        tabIndex={-1}
      >
        <source src={HERO_VIDEO.src} type="video/mp4" />
      </video>
    </div>
  );
}

function ProductVideo({
  compact = false,
  video,
}: {
  compact?: boolean;
  video: VideoSpec;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <article className={`mkt-video ${compact ? "compact" : ""}`}>
      <div className="mkt-video-frame">
        {failed ? (
          <AssetSlot filename={`public${video.src}`} />
        ) : (
          <video
            aria-label={`${video.title}, ${video.mode}`}
            controls
            muted
            onError={() => setFailed(true)}
            playsInline
            poster={video.poster}
            preload={compact ? "none" : "metadata"}
          >
            <source src={video.src} type="video/mp4" />
            Your browser does not support embedded video.
          </video>
        )}
      </div>
      <div className="mkt-video-caption">
        <div>
          <h3>{video.title}</h3>
          <p>{video.prompt}</p>
        </div>
        <dl>
          <div><dt>Mode</dt><dd>{video.mode}</dd></div>
          <div><dt>Length</dt><dd>{video.duration}</dd></div>
          <div><dt>Output</dt><dd>{video.resolution}</dd></div>
        </dl>
      </div>
    </article>
  );
}

function DashboardEvidence() {
  const [failed, setFailed] = useState(false);

  return (
    <div className="mkt-dashboard-evidence">
      {failed ? (
        <AssetSlot filename="public/media/morphly-dashboard.webp">
          <Settings2 />
        </AssetSlot>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt="Morphly creator dashboard showing generation modes and render settings"
          onError={() => setFailed(true)}
          src="/media/morphly-dashboard.webp"
        />
      )}
    </div>
  );
}

function MarketingFooter({
  onCreate,
}: {
  onCreate: (section?: DashboardSection) => void;
}) {
  return (
    <footer className="mkt-footer">
      <div>
        <Brand />
        <p>A focused LTX 2.3-powered studio for creating video from text and media.</p>
      </div>
      <nav aria-label="Footer navigation">
        <a href="#product">Product</a>
        <a href="#gallery">Gallery</a>
        <button onClick={() => onCreate("billing")} type="button">Pricing</button>
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
        <a href="mailto:samuellucky2424@gmail.com">Contact</a>
      </nav>
      <small>© 2026 Morphly. AI video, directed by you.</small>
    </footer>
  );
}

function Home({
  onCreate,
  onSignIn,
}: {
  onCreate: (section?: DashboardSection) => void;
  onSignIn: () => void;
}) {
  return (
    <div className="marketing-site" id="top">
      <MarketingHeader
        onCreate={() => onCreate("create")}
        onSignIn={onSignIn}
      />
      <main>
        <section className="mkt-hero" id="product">
          <HeroBackgroundVideo />
          <div className="mkt-hero-inner">
            <motion.div
              className="mkt-hero-copy"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <span className="mkt-kicker">AI video generation · LTX 2.3</span>
              <h1>Create cinematic video from a prompt, image, or clip.</h1>
              <p>
                Morphly brings text-to-video, image-to-video and video transformation
                into one focused creative studio powered by LTX 2.3.
              </p>
              <div className="mkt-actions">
                <button className="mkt-primary" onClick={() => onCreate("create")} type="button">
                  Create your first video <ArrowRight />
                </button>
                <button className="mkt-secondary" onClick={() => onCreate("videos")} type="button">
                  <Play /> View generated videos
                </button>
              </div>
              <small>Start with 50 free credits. No card required.</small>
            </motion.div>
          </div>
        </section>

        <section className="mkt-proof-strip" aria-label="Current product workflow">
          <span>Prompt or media input</span>
          <ArrowRight />
          <span>Format and motion controls</span>
          <ArrowRight />
          <span>Generated video output</span>
        </section>

        <section className="mkt-section mkt-gallery-section" id="gallery">
          <div className="mkt-section-heading">
            <span className="mkt-kicker">Generated output</span>
            <h2>Judge the product by the frames it produces.</h2>
            <p>
              This gallery is wired for real Morphly-generated files. Until approved
              showcase media is supplied, every missing asset is labelled with its
              required filename.
            </p>
          </div>
          <div className="mkt-gallery">
            {GALLERY_VIDEOS.map((video, index) => (
              <ProductVideo compact={index !== 0} key={video.src} video={video} />
            ))}
          </div>
        </section>

        <section className="mkt-section mkt-modes-section">
          <div className="mkt-section-heading narrow">
            <span className="mkt-kicker">Three creation modes</span>
            <h2>Use the source material you already have.</h2>
          </div>
          <div className="mkt-mode-list">
            {MODE_ROWS.map(({ action, description, icon: Icon, input, mode, output }) => (
              <article key={mode}>
                <div className="mkt-mode-number"><Icon /></div>
                <div>
                  <span>{mode}</span>
                  <h3>{action}</h3>
                  <p>{description}</p>
                </div>
                <dl>
                  <div><dt>You provide</dt><dd>{input}</dd></div>
                  <div><dt>Morphly produces</dt><dd>{output}</dd></div>
                </dl>
                <button onClick={() => onCreate("create")} type="button">
                  Open studio <ArrowRight />
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="mkt-section mkt-workflow" id="how-it-works">
          <div className="mkt-workflow-copy">
            <span className="mkt-kicker">How Morphly works</span>
            <h2>One clear path from direction to output.</h2>
            <ol>
              <li>
                <span>01</span>
                <div><h3>Add your prompt or media</h3><p>Write the scene or upload an image or video source.</p></div>
              </li>
              <li>
                <span>02</span>
                <div><h3>Choose format and motion settings</h3><p>Select preset, resolution, duration, frame rate, and optional advanced controls.</p></div>
              </li>
              <li>
                <span>03</span>
                <div><h3>Generate, review and export</h3><p>Track progress, review the completed output, and download the generated file.</p></div>
              </li>
            </ol>
          </div>
          <DashboardEvidence />
        </section>

        <section className="mkt-section mkt-capabilities">
          <div className="mkt-section-heading narrow">
            <span className="mkt-kicker">Available now</span>
            <h2>Controls that match the operating studio.</h2>
          </div>
          <div className="mkt-capability-grid">
            {[
              ["Modes", "Text to video, image to video, and video to video"],
              ["Aspect ratios", "1:1, 16:9, and 9:16"],
              ["Output sizes", "512 × 512 through 1024 × 576 or 576 × 1024"],
              ["Durations", "4, 8, or 10 seconds"],
              ["Frame rate", "Preset-controlled 8 fps"],
              ["Credits", "Calculated before generation from the selected configuration"],
              ["Source formats", "JPG, PNG, WebP, MP4, MOV, and WebM"],
              ["Output", "Review in the studio and export the completed video"],
            ].map(([label, value]) => (
              <article key={label}>
                <Check />
                <span>{label}</span>
                <p>{value}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mkt-section mkt-pricing" id="pricing">
          <div>
            <span className="mkt-kicker">Usage-based credits</span>
            <h2>See the cost before you generate.</h2>
          </div>
          <div>
            <p>
              Morphly calculates credits from the mode, duration, frame rate,
              resolution, and preset you select. Your available and reserved balances
              remain visible in the studio.
            </p>
            <button className="mkt-secondary" onClick={() => onCreate("billing")} type="button">
              View credit options <ArrowRight />
            </button>
          </div>
        </section>

        <section className="mkt-final-cta">
          <div>
            <span className="mkt-kicker">Start creating</span>
            <h2>Direct the next frame.</h2>
            <p>Open Morphly Studio and turn a prompt, image, or clip into video.</p>
          </div>
          <div className="mkt-actions">
            <button className="mkt-primary" onClick={() => onCreate("create")} type="button">
              Create video <ArrowRight />
            </button>
            <button className="mkt-secondary" onClick={onSignIn} type="button">
              Sign in
            </button>
          </div>
        </section>
      </main>
      <MarketingFooter onCreate={onCreate} />
    </div>
  );
}

export default function HomePage() {
  const [view, setCurrentView] = useState<View>("home");
  const [sessionReady, setSessionReady] = useState(false);

  const setView = useCallback((nextView: View) => {
    const url = new URL(window.location.href);
    if (nextView === "dashboard") {
      url.searchParams.set("view", "dashboard");
      url.searchParams.delete("auth");
      url.searchParams.delete("reset");
    } else if (nextView === "auth") {
      url.searchParams.set("view", "auth");
      url.searchParams.delete("section");
    } else {
      url.searchParams.delete("view");
      url.searchParams.delete("section");
      url.searchParams.delete("auth");
      url.searchParams.delete("reset");
    }
    window.history.replaceState(null, "", url);
    setCurrentView(nextView);
  }, []);

  const openDashboard = useCallback(
    (section: DashboardSection = "create") => {
      setView("dashboard");
      const url = new URL(window.location.href);
      url.searchParams.set("section", section);
      window.history.replaceState(null, "", url);
    },
    [setView],
  );

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const resetRequested = params.get("reset") === "1";
    const requestedView: View =
      params.get("auth") === "signup" || params.get("view") === "auth"
        ? "auth"
        : params.get("view") === "dashboard"
          ? "dashboard"
          : "home";
    const supabase = createClient();

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        const nextView =
          resetRequested
            ? "auth"
            : data.session && requestedView === "auth"
              ? "dashboard"
              : !data.session && requestedView === "dashboard"
                ? "auth"
                : requestedView;
        setView(nextView);
        setSessionReady(true);
      })
      .catch(() => {
        if (!active) return;
        setView(requestedView === "dashboard" ? "auth" : requestedView);
        setSessionReady(true);
      });

    return () => {
      active = false;
    };
  }, [setView]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  if (!sessionReady) {
    return <div aria-label="Loading Morphly" className="app-session-loading" />;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        key={view}
        transition={{ duration: 0.18 }}
      >
        {view === "home" ? (
          <Home
            onCreate={openDashboard}
            onSignIn={() => setView("auth")}
          />
        ) : view === "dashboard" ? (
          <LiveDashboard setView={setView} />
        ) : (
          <LiveAuth setView={setView} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
