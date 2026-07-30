"use client";

import { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, ArrowRight, Video, Play, Box, Zap, Settings, Volume2, ShieldCheck, ChevronRight, Check } from "lucide-react";
import { createClient } from "@/src/lib/supabase/client";
import { DashboardStudio as LiveDashboard } from "./dashboard-studio";
import { LiveAuth } from "./live-auth";

// Types and generic structures
type View = "home" | "dashboard" | "auth";
type DashboardSection = "create" | "videos" | "assets" | "billing";

// New Home Component
function Home({ onCreate, onSignIn }: { onCreate: () => void; onSignIn: () => void }) {
  const [packages, setPackages] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/billing/packages')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setPackages(data);
      })
      .catch(err => console.error('Failed to load packages:', err));
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] selection:bg-[var(--lime)] selection:text-[var(--bg)] overflow-x-hidden font-sans">
      
      {/* Header Navigation */}
      <header className="fixed top-0 w-full z-50 bg-[var(--bg)]/80 backdrop-blur-md border-b border-[var(--text)]/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => window.scrollTo(0, 0)} className="flex items-center gap-2 text-xl font-bold tracking-tight hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-[var(--lime)] text-[var(--bg)] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            Morphly <span className="text-[10px] uppercase tracking-widest text-[var(--lime)] border border-[var(--lime)]/30 px-2 py-0.5 rounded-full ml-1 font-mono">LTX 2.3</span>
          </button>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[var(--text)]/70">
            <a href="#product" className="hover:text-[var(--text)] transition-colors">Product</a>
            <a href="#pricing" className="hover:text-[var(--text)] transition-colors">Pricing</a>
            <a href="#features" className="hover:text-[var(--text)] transition-colors">Features</a>
          </nav>
          
          <div className="flex items-center gap-4">
            <button onClick={onSignIn} className="text-sm font-medium text-[var(--text)]/70 hover:text-[var(--text)] transition-colors">
              Sign in
            </button>
            <button onClick={onCreate} className="text-sm font-medium px-4 py-2 rounded-lg bg-[var(--text)]/5 border border-[var(--text)]/10 hover:bg-[var(--text)]/10 transition-colors">
              Sign up
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-40 pb-32 px-6 flex flex-col items-center justify-center min-h-[90vh] overflow-hidden mt-16 border-b border-[var(--text)]/5">
        {/* Background Video */}
        <div className="absolute inset-0 z-0 bg-black">
          <video src="/media/morphly-hero.mp4" autoPlay loop muted playsInline className="w-full h-full object-cover opacity-100" />
          <div className="absolute inset-0 bg-black/30"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-5xl mx-auto text-center flex flex-col items-center text-white">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1] drop-shadow-2xl">
            Professional AI Video <br/> in One Click
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mb-10 leading-relaxed font-medium drop-shadow">
            Endless Possibilities. Morphly LTX 2.3 provides a state-of-the-art multimodal video generation model directly to your browser.
          </p>
          <button onClick={onCreate} className="px-8 py-4 rounded-xl bg-[var(--lime)] text-white font-bold text-lg hover:brightness-110 hover:scale-[1.02] transition-all flex items-center gap-2 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
            Get Started Now <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Pricing / Plans Section */}
      <section id="pricing" className="py-24 px-6 max-w-7xl mx-auto border-t border-[var(--text)]/5">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Morphly Credits & Plans</h2>
          <p className="text-[var(--text)]/60">Concept to video in one step, with various resource plans available.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {packages.length > 0 ? packages.map((pkg, i) => {
            const isPopular = pkg.price_cents === 2500 || i === 1; // Highlight middle/25$ plan
            return (
              <div key={pkg.id} className={`bg-[var(--panel)] ${isPopular ? 'border-[var(--lime)]/30 shadow-2xl z-10 md:-translate-y-4' : 'border-[var(--text)]/5 opacity-90'} border rounded-2xl p-8 backdrop-blur hover:bg-[var(--panel)]/60 transition-colors flex flex-col relative`}>
                {isPopular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--lime)] text-[var(--bg)] text-[10px] font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">Most Popular</div>
                )}
                <h3 className="text-xl font-bold mb-2">{pkg.name}</h3>
                <div className="text-3xl font-bold mb-6">${(pkg.price_cents / 100).toFixed(2)} <span className="text-sm font-normal text-[var(--text)]/50">/ {pkg.credits} Credits</span></div>
                <button onClick={onCreate} className={`w-full py-3 rounded-lg ${isPopular ? 'bg-[var(--text)] text-[var(--bg)]' : 'border border-[var(--text)]/20 hover:bg-[var(--text)]/5'} transition-all font-medium mb-8`}>Get Plan</button>
                <ul className="space-y-4 text-sm text-[var(--text)]/70 mt-auto">
                  <li className="flex items-start gap-3"><Check className="w-4 h-4 mt-0.5 text-[var(--lime)]" /> Generate high quality videos</li>
                  <li className="flex items-start gap-3"><Check className="w-4 h-4 mt-0.5 text-[var(--lime)]" /> Advanced LTX 2.3 integration</li>
                  <li className="flex items-start gap-3"><Check className="w-4 h-4 mt-0.5 text-[var(--lime)]" /> {pkg.credits > 1000 ? 'Priority' : 'Standard'} processing queue</li>
                </ul>
              </div>
            );
          }) : (
            <div className="col-span-3 text-center text-[var(--text)]/50 py-12">Loading packages...</div>
          )}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6 max-w-7xl mx-auto border-t border-[var(--text)]/5">
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Next-generation Video Generation Model</h2>
          <p className="text-[var(--text)]/60 max-w-2xl">Multimodal references and intelligent video editing elevate video AI to a new level of precision and consistency.</p>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          {[
            { icon: Box, title: "Multimodality", desc: "Combination of images, text, and structure." },
            { icon: Sparkles, title: "Intelligence", desc: "Native LTX 2.3 integration and precise rendering." },
            { icon: ShieldCheck, title: "Fidelity", desc: "Physics-compliant and superior motion quality." },
            { icon: Zap, title: "Intuitive", desc: "Powerful intent understanding and Gemini prompt enhancement." }
          ].map((feature, i) => (
            <div key={i} className="group bg-[var(--panel)]/30 border border-[var(--text)]/5 rounded-2xl p-6 hover:bg-[var(--panel)]/60 transition-colors relative overflow-hidden">
              <feature.icon className="w-8 h-8 text-[var(--lime)] mb-6" />
              <h3 className="text-lg font-bold mb-3">{feature.title}</h3>
              <p className="text-sm text-[var(--text)]/60 mb-8">{feature.desc}</p>
              
              <a href="#try" onClick={(e) => { e.preventDefault(); onCreate(); }} className="absolute bottom-6 left-6 text-sm font-medium text-[var(--text)]/50 group-hover:text-[var(--lime)] transition-colors flex items-center gap-1">
                Try Now <ChevronRight className="w-4 h-4 opacity-0 -ml-2 group-hover:ml-0 group-hover:opacity-100 transition-all" />
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 max-w-5xl mx-auto border-t border-[var(--text)]/5">
        <h2 className="text-3xl font-bold mb-12">FAQs</h2>
        <div className="grid md:grid-cols-2 gap-8">
          {[
            { q: "What is Morphly LTX 2.3?", a: "Morphly LTX 2.3 is a next-generation multimodal video generation model that allows professional-grade AI video generation from text and images." },
            { q: "How does the pricing work?", a: "Generations consume credits. Different resolutions, frame rates, and durations cost varying amounts of credits. You purchase credit packages that never expire." },
            { q: "Can I use the prompt enhancer?", a: "Yes! Our Gemini-powered prompt enhancer automatically optimizes your short prompts into detailed, highly descriptive 10-second scene directions." },
            { q: "What are the maximum specs?", a: "We support up to 1080p generation, at a native 25 FPS, for up to 10 seconds of high-fidelity video." },
          ].map((faq, i) => (
            <div key={i} className="p-6 border border-[var(--text)]/5 rounded-2xl bg-[var(--panel)]/20 hover:bg-[var(--panel)]/40 transition-colors">
              <h4 className="font-bold mb-3 text-[var(--text)]">{faq.q}</h4>
              <p className="text-sm text-[var(--text)]/60 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--text)]/5 bg-[var(--panel2)]/30 mt-12 py-16 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-5 gap-12 text-sm">
          <div className="col-span-2">
            <div className="flex items-center gap-2 text-lg font-bold tracking-tight mb-4">
              <div className="w-6 h-6 rounded-md bg-[var(--lime)] text-[var(--bg)] flex items-center justify-center">
                <Sparkles className="w-3 h-3" />
              </div>
              Morphly
            </div>
            <p className="text-[var(--text)]/50 max-w-xs mb-6">The AI-native creative engine for modern videography and rapid prototyping.</p>
            <div className="text-[var(--text)]/30 text-xs">© 2026 Morphly AI Ltd.</div>
          </div>
          
          <div>
            <h5 className="font-bold mb-4 text-[var(--text)]">Products</h5>
            <div className="flex flex-col gap-3 text-[var(--text)]/50">
              <a href="#" className="hover:text-[var(--text)] transition-colors">LTX 2.3 Studio</a>
              <a href="#" className="hover:text-[var(--text)] transition-colors">Pricing</a>
              <a href="#" className="hover:text-[var(--text)] transition-colors">API Explorer</a>
            </div>
          </div>
          
          <div>
            <h5 className="font-bold mb-4 text-[var(--text)]">Resources</h5>
            <div className="flex flex-col gap-3 text-[var(--text)]/50">
              <Link href="/docs" className="hover:text-[var(--text)] transition-colors">Documentation</Link>
              <Link href="/blog" className="hover:text-[var(--text)] transition-colors">Blog</Link>
              <Link href="/community" className="hover:text-[var(--text)] transition-colors">Community</Link>
            </div>
          </div>
          
          <div>
            <h5 className="font-bold mb-4 text-[var(--text)]">Company</h5>
            <div className="flex flex-col gap-3 text-[var(--text)]/50">
              <Link href="/about" className="hover:text-[var(--text)] transition-colors">About us</Link>
              <Link href="/privacy" className="hover:text-[var(--text)] transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-[var(--text)] transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>

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
    return <div aria-label="Loading Morphly" className="app-session-loading min-h-screen bg-[var(--bg)] flex items-center justify-center">
       <div className="w-8 h-8 rounded-full border-2 border-[var(--lime)] border-t-transparent animate-spin"></div>
    </div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        key={view}
        transition={{ duration: 0.18 }}
        className="bg-[var(--bg)]"
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
