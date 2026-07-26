"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import {
  ArrowRight, Clapperboard, Download, Film, Image as ImageIcon, Menu,
  MessageSquareText, Play, Sparkles, WandSparkles, X
} from "lucide-react";
import { DashboardStudio as LiveDashboard } from "./dashboard-studio";
import { LiveAuth } from "./live-auth";

type View = "home" | "dashboard" | "auth";

function Logo() {
  return <button onClick={() => location.hash = ""} className="logo" aria-label="Morphly home">
    <span className="logo-mark"><Sparkles size={17}/></span><span>Morphly</span><em>LTX 2.3</em>
  </button>;
}

function Nav({ setView }: { setView: (v: View) => void }) {
  const [open, setOpen] = useState(false);
  const go = (id: string) => { setView("home"); setOpen(false); setTimeout(() => document.getElementById(id)?.scrollIntoView({behavior:"smooth"}), 50); };
  return <header className="nav-wrap">
    <nav className="nav">
      <Logo/>
      <div className={`nav-links ${open ? "open" : ""}`}>
        {["Home","About","Services","Gallery","Projects","Blog"].map(x => <button key={x} onClick={() => go(x.toLowerCase())}>{x}</button>)}
        <button onClick={() => go("contact")}>Contact</button>
      </div>
      <div className="nav-actions">
        <button className="text-btn desktop" onClick={() => setView("auth")}>Sign in</button>
        <button className="lime-btn small" onClick={() => setView("dashboard")}>Start creating <ArrowRight size={15}/></button>
        <button className="menu-btn" onClick={() => setOpen(!open)} aria-label="Toggle navigation">{open ? <X/> : <Menu/>}</button>
      </div>
    </nav>
  </header>;
}

function Hero({ setView }: { setView: (v: View) => void }) {
  const hero = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".hero-copy > *", { y: 32, opacity: 0, duration: .9, stagger: .11, ease: "power3.out" });
      gsap.to(".orb", { y: -16, x: 10, duration: 3.2, repeat: -1, yoyo: true, ease: "sine.inOut" });
    }, hero);
    return () => ctx.revert();
  }, []);
  return <section className="hero" id="home" ref={hero}>
    <div className="orb orb-one"/><div className="orb orb-two"/><div className="hero-grid"/>
    <div className="hero-copy">
      <div className="eyebrow"><span/> Built on LTX 2.3 · Faster. Sharper. Cinematic.</div>
      <h1>Your idea.<br/><span>Now in motion.</span></h1>
      <p>Turn a sentence, image, or rough clip into production-ready AI video—without a studio, timeline, or learning curve.</p>
      <div className="hero-actions">
        <button className="lime-btn" onClick={() => setView("dashboard")}><WandSparkles size={18}/> Generate your first video</button>
        <button className="ghost-btn" onClick={() => document.getElementById("showreel")?.scrollIntoView({behavior:"smooth"})}><Play size={16} fill="currentColor"/> Watch showreel</button>
      </div>
      <div className="proof"><div className="avatars"><i>AM</i><i>LK</i><i>JR</i><i>+2k</i></div><span><b>4.9/5</b> from creative teams<br/>No card required · 50 free credits</span></div>
    </div>
    <div className="hero-stage" aria-label="AI video creation preview">
      <div className="stage-top"><span><i/> LIVE COMPOSITION</span><span>16:9 · 1080P</span></div>
      <div className="video-scene">
        <div className="scene-sun"/><div className="scene-road"/><div className="scene-car"><div/><i/><i/></div>
        <div className="prompt-float"><Sparkles size={14}/><span>“A cinematic electric coupe racing through a bioluminescent city at dusk”</span></div>
        <button className="play-big"><Play fill="currentColor"/></button>
      </div>
      <div className="timeline">
        <div className="timeline-head"><span>SCENE 01</span><span>00:06 / 00:08</span></div>
        <div className="track"><span/><b style={{left:"72%"}}/></div>
        <div className="clips"><i/><i/><i/><i/><i/></div>
      </div>
    </div>
  </section>;
}

function Home({ setView }: { setView: (v: View) => void }) {
  return <><Nav setView={setView}/><main>
    <Hero setView={setView}/>
    <section className="ticker" aria-label="Capabilities"><div>TEXT TO VIDEO <Sparkles/> IMAGE TO VIDEO <Sparkles/> VIDEO RESTYLE <Sparkles/> PRODUCT ADS <Sparkles/> CINEMATIC STORIES <Sparkles/> TEXT TO VIDEO</div></section>
    <section className="section story" id="about">
      <div className="section-kicker">The creative engine</div><h2>From thought to film<br/><span>in three moves.</span></h2>
      <div className="steps">
        {[["01","Describe it","Write what you see in your head. Set the mood, camera, pace and style."],["02","Direct it","Add a reference image or clip. Fine-tune movement with cinematic controls."],["03","Ship it","Generate, upscale and export. Ready for ads, campaigns, socials and stories."]].map((s,i)=><motion.article key={s[0]} initial={{opacity:0,y:24}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*.12}}>
          <span>{s[0]}</span><div className="step-icon">{i===0?<MessageSquareText/>:i===1?<Clapperboard/>:<Download/>}</div><h3>{s[1]}</h3><p>{s[2]}</p>
        </motion.article>)}
      </div>
    </section>
    <section className="section studio-section" id="services">
      <div className="split-title"><div><div className="section-kicker">One studio. Every format.</div><h2>Build exactly<br/>what you imagined.</h2></div><p>Advanced generation modes with simple controls—designed for marketers, filmmakers, agencies and ambitious brands.</p></div>
      <div className="services">
        {[["Text to video","Write a scene. Morphly handles composition, movement and light.","01",<MessageSquareText key="a"/>],["Image to video","Give still images natural motion without losing character or detail.","02",<ImageIcon key="b"/>],["Video to video","Transform footage into a new style while preserving its original movement.","03",<Film key="c"/>]].map((x,i)=><motion.article key={String(x[0])} whileHover={{y:-8}} className={i===1?"featured":""}>
          <div className={`service-art art-${i}`}>{x[3]}<div className="scan"/><span>{x[2]}</span></div><h3>{x[0]}</h3><p>{x[1]}</p><button onClick={()=>setView("dashboard")}>Open studio <ArrowRight size={15}/></button>
        </motion.article>)}
      </div>
    </section>
    <section className="showcase" id="showreel"><div className="showcase-copy"><div className="section-kicker">LTX 2.3 quality</div><h2>Motion that feels<br/><em>directed.</em></h2><p>Consistent characters, precise prompts, realistic physics and camera movement engineered for storytelling.</p><div className="metrics"><div><b>3×</b><span>faster rendering</span></div><div><b>1080p</b><span>native output</span></div><div><b>24 fps</b><span>fluid motion</span></div></div></div><div className="show-frame"><div className="portrait-silhouette"/><span>Shot on Morphly</span><button><Play fill="currentColor"/></button></div></section>
    <section className="section" id="gallery"><div className="section-kicker">Made with Morphly</div><div className="split-title"><h2>Small prompt.<br/>Big screen energy.</h2><button className="ghost-btn" onClick={()=>setView("dashboard")}>Explore gallery <ArrowRight/></button></div>
      <div className="gallery-grid">{["Aether shoes / Product film","Midnight Tokyo / Concept","Solis skin / Campaign","Desert signal / Short film","Motion studies / Fashion"].map((x,i)=><article className={`gallery-card g${i}`} key={x}><div className="fake-scene"><span/><button aria-label={`Play ${x}`}><Play fill="currentColor"/></button></div><p>{x}</p></article>)}</div>
    </section>
    <section className="section projects" id="projects"><div className="section-kicker">Project showcase</div><h2>Made to move<br/>business forward.</h2><div className="project-row"><div><b>+44%</b><span>campaign engagement</span></div><div><b>12 hrs</b><span>from brief to launch</span></div><div><b>−68%</b><span>production cost</span></div><p>“Morphly let our three-person team launch a global-quality campaign before lunch.”<br/><strong>— Amara Obi, Creative Director</strong></p></div></section>
    <section className="section journal" id="blog"><div className="split-title"><div><div className="section-kicker">The motion journal</div><h2>Ideas worth<br/>putting in motion.</h2></div><button className="ghost-btn">View all stories <ArrowRight/></button></div><div className="articles">{["How AI video changes the creative brief","Seven prompts for cinematic product films","LTX 2.3: A practical creative guide"].map((x,i)=><article key={x}><div className={`article-img ai${i}`}><span>0{i+1}</span></div><small>{i===0?"Creative strategy":i===1?"Prompt craft":"Product"} · 6 min</small><h3>{x}</h3><a>Read story <ArrowRight size={14}/></a></article>)}</div></section>
    <section className="cta" id="contact"><div><div className="section-kicker">Your next frame starts here</div><h2>Ready when<br/>your idea is.</h2><p>Start with 50 free credits. No card. No complicated timeline.</p></div><div><button className="lime-btn" onClick={()=>setView("auth")}>Create free account <ArrowRight/></button><button className="ghost-btn">Request a quote</button></div></section>
  </main><Footer/></>;
}

function Footer() { return <footer><Logo/><p>AI video, directed by you.</p><div><a href="#services">Services</a><a href="#gallery">Gallery</a><a href="#blog">Journal</a><a href="/admin/login">Admin</a><a href="#contact">Contact</a></div><span>© 2026 Morphly. Built for motion.</span></footer> }

export default function HomePage() {
 const [view,setView]=useState<View>("home");
 useEffect(()=>{
   const params=new URLSearchParams(location.search);
   const requestedView: View =
     params.get("auth")==="signup"||params.get("view")==="auth"
       ? "auth"
       : params.get("view")==="dashboard"
         ? "dashboard"
         : "home";
   const timer=window.setTimeout(()=>setView(requestedView),0);
   return ()=>window.clearTimeout(timer);
 },[]);
 useEffect(()=>{scrollTo(0,0)},[view]);
 return <AnimatePresence mode="wait"><motion.div key={view} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.25}}>{view==="home"?<Home setView={setView}/>:view==="dashboard"?<LiveDashboard setView={setView}/>:<LiveAuth setView={setView}/>}</motion.div></AnimatePresence>;
}
