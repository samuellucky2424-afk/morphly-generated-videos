"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import {
  ArrowRight, BarChart3, Bell, Check, ChevronRight, CircleUserRound, Clapperboard,
  Clock3, CreditCard, Download, Film, Gauge, Image as ImageIcon, Layers3, LayoutDashboard,
  Menu, MessageSquareText, Moon, Play, Plus, Search, Settings, ShieldCheck, Sparkles,
  Upload, Users, Video, WandSparkles, X, Zap
} from "lucide-react";
import { LiveAuth, LiveDashboard } from "./live-app";

type View = "home" | "dashboard" | "admin" | "auth";
type Mode = "Text to video" | "Image to video" | "Video to video";

const jobs = [
  { title: "Aurora running shoe", mode: "Image to video", status: "Ready", time: "00:08", tone: "green" },
  { title: "Neon city launch", mode: "Text to video", status: "Generating 72%", time: "00:06", tone: "yellow" },
  { title: "Luxury watch macro", mode: "Video to video", status: "Ready", time: "00:10", tone: "purple" },
];

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
  </main><Footer setView={setView}/></>;
}

function Footer({setView}:{setView:(v:View)=>void}) { return <footer><Logo/><p>AI video, directed by you.</p><div><a href="#services">Services</a><a href="#gallery">Gallery</a><a href="#blog">Journal</a><button onClick={()=>setView("admin")}>Admin</button><a href="#contact">Contact</a></div><span>© 2026 Morphly. Built for motion.</span></footer> }

function Side({active,setActive,admin=false}:{active:string,setActive:(x:string)=>void,admin?:boolean}) {
 const items = admin ? [["Overview",LayoutDashboard],["Users",Users],["Generations",Film],["Billing",CreditCard],["Analytics",BarChart3],["System health",Gauge],["Settings",Settings]] : [["Create",WandSparkles],["My videos",Film],["Assets",Layers3],["Billing",CreditCard],["Settings",Settings]];
 return <aside className="side"><Logo/><div className="side-label">{admin?"CONTROL CENTER":"STUDIO"}</div>{items.map(([x,I]:any)=><button className={active===x?"active":""} onClick={()=>setActive(x)} key={x}><I size={18}/>{x}</button>)}<div className="side-bottom"><div className="mini-user"><span>LS</span><div><b>Lucky Samuel</b><small>{admin?"Super Admin":"Pro creator"}</small></div></div><button onClick={()=>location.reload()}><ArrowRight className="rotate" size={17}/> Back to site</button></div></aside>
}

function Dashboard({setView}:{setView:(v:View)=>void}) {
 const [active,setActive]=useState("Create"); const [mode,setMode]=useState<Mode>("Text to video"); const [generating,setGenerating]=useState(false);
 return <div className="app-shell"><Side active={active} setActive={setActive}/><div className="app-main"><div className="app-top"><button className="back-mobile" onClick={()=>setView("home")}><X/></button><div><small>MORPHLY STUDIO</small><h1>{active}</h1></div><div className="top-tools"><button><Search/></button><button><Bell/><i/></button><div className="credit-pill"><Zap size={14} fill="currentColor"/><b>1,240</b> credits</div><button className="avatar">LS</button></div></div>
 {active==="Create" ? <div className="workspace"><div className="mode-tabs">{(["Text to video","Image to video","Video to video"] as Mode[]).map(x=><button key={x} onClick={()=>setMode(x)} className={mode===x?"active":""}>{x==="Text to video"?<MessageSquareText/>:x==="Image to video"?<ImageIcon/>:<Video/>}{x}</button>)}</div>
 <div className="creator-grid"><section className="prompt-panel"><div className="panel-head"><h2>{mode}</h2><span>10 credits/sec</span></div>{mode!=="Text to video"&&<label className="dropzone"><Upload/><b>Drop your {mode==="Image to video"?"image":"video"} here</b><span>or browse files · max 200MB</span><input type="file"/></label>}<label className="prompt-label"><span>Describe your scene <small>0 / 1200</small></span><textarea defaultValue={mode==="Text to video"?"A cinematic close-up of a futuristic electric sports car gliding through a rain-soaked neon city at blue hour. Volumetric light, shallow depth of field, slow dolly shot.":""} placeholder="Describe motion, camera, lighting and atmosphere..."/></label><div className="control-grid"><label>Model<select><option>LTX Video 2.3</option><option>LTX Fast</option></select></label><label>Aspect ratio<select><option>16:9 · Landscape</option><option>9:16 · Portrait</option><option>1:1 · Square</option></select></label><label>Duration<select><option>6 seconds</option><option>8 seconds</option><option>10 seconds</option></select></label><label>Quality<select><option>1080p</option><option>720p</option></select></label></div><div className="estimate"><span><Sparkles/> Estimated cost</span><b>60 credits</b></div><button className="generate-btn" onClick={()=>{setGenerating(true);setTimeout(()=>setGenerating(false),3500)}} disabled={generating}>{generating?<><span className="spinner"/> Generating your scene…</>:<><WandSparkles/> Generate video <span>⌘↵</span></>}</button></section>
 <section className="preview-panel"><div className="panel-head"><h2>Preview</h2><span>16:9</span></div><div className="preview-screen"><AnimatePresence mode="wait">{generating?<motion.div key="gen" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="generating"><div className="gen-orbit"><Sparkles/></div><b>Composing your frames</b><span>72% · About 14 seconds left</span><div><i/></div></motion.div>:<motion.div key="empty" initial={{opacity:0}} animate={{opacity:1}} className="empty-preview"><div className="scene-mini"/><button><Play fill="currentColor"/></button><span>Your latest preview</span></motion.div>}</AnimatePresence></div><div className="preview-actions"><button><Download/> Export</button><button><Plus/> New variation</button></div></section></div>
 <div className="recent-head"><div><h2>Recent generations</h2><p>Your latest projects and renders.</p></div><button>View all <ChevronRight/></button></div><div className="job-grid">{jobs.map((j,i)=><article key={j.title}><div className={`job-thumb jt${i}`}><Play fill="currentColor"/></div><div><h3>{j.title}</h3><p>{j.mode} · {j.time}</p><span className={j.tone}>{j.status}</span></div><button>•••</button></article>)}</div></div> : <AccountPage active={active}/>}</div></div>
}

function AccountPage({active}:{active:string}) {
 if(active==="Billing") return <div className="content-page"><div className="stat-grid"><article><span>Credit balance</span><b>1,240</b><small>≈ 124 seconds of video</small></article><article><span>Current plan</span><b>Creator Pro</b><small>Renews Aug 26, 2026</small></article><article><span>This month</span><b>680</b><small>credits used</small></article></div><div className="wide-card"><div><h2>Creator Pro</h2><p>5,000 credits monthly · Priority queue · 1080p output</p></div><button className="lime-btn">Manage plan</button></div><h2>Billing history</h2><div className="table">{["Jul 26, 2026|Creator Pro|$90.00|Paid","Jun 26, 2026|Creator Pro|$90.00|Paid","May 18, 2026|Credit top-up|$18.00|Paid"].map(x=><div key={x}>{x.split("|").map(y=><span key={y}>{y}</span>)}<button><Download size={15}/></button></div>)}</div></div>;
 if(active==="Settings") return <div className="content-page settings-page"><div className="wide-card profile-card"><span className="big-avatar">LS</span><div><h2>Lucky Samuel</h2><p>lucky@morphly.studio</p></div><button>Change photo</button></div><div className="form-card"><h2>Profile information</h2><div className="control-grid"><label>Full name<input defaultValue="Lucky Samuel"/></label><label>Display name<input defaultValue="Lucky"/></label><label>Email address<input defaultValue="lucky@morphly.studio"/></label><label>Company<input defaultValue="Morphly Labs"/></label></div><button className="lime-btn">Save changes</button></div></div>;
 return <div className="content-page"><div className="empty-state"><div><Film/></div><h2>{active}</h2><p>{active==="My videos"?"Every render, version and export—organized in one place.":"Upload and manage reusable images, clips and brand assets."}</p><button className="lime-btn"><Plus/> Add new</button></div></div>;
}

function Admin({setView}:{setView:(v:View)=>void}) {
 const [active,setActive]=useState("Overview");
 return <div className="app-shell admin-shell"><Side active={active} setActive={setActive} admin/><div className="app-main"><div className="app-top"><button className="back-mobile" onClick={()=>setView("home")}><X/></button><div><small>ADMIN CONSOLE</small><h1>{active}</h1></div><div className="top-tools"><span className="health"><i/> All systems operational</span><button><Bell/></button><button className="avatar">LS</button></div></div><div className="content-page">
 <div className="admin-hero"><div><span>Sunday, July 26</span><h2>Good morning, Lucky.</h2><p>Here’s what’s happening across Morphly today.</p></div><button className="lime-btn"><Download/> Export report</button></div>
 <div className="stat-grid four">{[["Total users","12,482","+12.4%"],["Videos generated","48,290","+18.7%"],["Revenue","$84,240","+9.2%"],["Credits consumed","2.4M","+21.5%"]].map((x,i)=><article key={x[0]}><div className={`stat-icon si${i}`}>{i===0?<Users/>:i===1?<Film/>:i===2?<CreditCard/>:<Zap/>}</div><span>{x[0]}</span><b>{x[1]}</b><small className="up">{x[2]} <em>vs last month</em></small></article>)}</div>
 <div className="admin-grid"><section className="chart-card"><div className="card-title"><div><h2>Platform growth</h2><p>Revenue and generation volume</p></div><select><option>Last 7 days</option></select></div><div className="chart"><div className="chart-lines"/><svg viewBox="0 0 600 180" preserveAspectRatio="none"><defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dffe47" stopOpacity=".35"/><stop offset="100%" stopColor="#dffe47" stopOpacity="0"/></linearGradient></defs><path d="M0 160 C70 145 80 80 140 105 S220 125 270 70 S350 95 400 45 S500 75 600 15 L600 180 L0 180Z" fill="url(#grad)"/><path d="M0 160 C70 145 80 80 140 105 S220 125 270 70 S350 95 400 45 S500 75 600 15" fill="none" stroke="#dffe47" strokeWidth="4"/></svg><div className="xlabels"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div></section><section className="activity-card"><div className="card-title"><div><h2>Live activity</h2><p>Latest platform events</p></div><button>View all</button></div>{[["New user signup","Amara O. joined Creator","2m"],["Video completed","Product launch · 1080p","4m"],["Payment received","Creator Pro · $90","8m"],["Credit warning","David K. · 42 left","12m"]].map((x,i)=><div className="activity" key={x[0]}><i className={`act${i}`}>{i===0?<Users/>:i===1?<Check/>:i===2?<CreditCard/>:<Zap/>}</i><div><b>{x[0]}</b><span>{x[1]}</span></div><small>{x[2]}</small></div>)}</section></div>
 <div className="users-card"><div className="card-title"><div><h2>Recent users</h2><p>Newest accounts across the platform</p></div><button>Manage users <ArrowRight/></button></div><div className="user-table"><div className="thead"><span>User</span><span>Plan</span><span>Credits</span><span>Status</span><span>Joined</span></div>{[["AO","Amara Obi","Creator Pro","4,620","Active","Today"],["DK","David Kim","Starter","42","Low credits","Today"],["NS","Nora Smith","Agency","18,400","Active","Yesterday"],["JM","Jay Mensah","Free","50","Trial","Yesterday"]].map(u=><div className="trow" key={u[1]}><span><i>{u[0]}</i><b>{u[1]}</b></span><span>{u[2]}</span><span>{u[3]}</span><span><em>{u[4]}</em></span><span>{u[5]}</span></div>)}</div></div></div></div></div>;
}

function Auth({setView}:{setView:(v:View)=>void}) {
 const [signup,setSignup]=useState(true); const [done,setDone]=useState(false);
 return <div className="auth-page"><button className="auth-back" onClick={()=>setView("home")}><ArrowRight/> Back to home</button><div className="auth-brand"><Logo/><div className="auth-visual"><div className="ring r1"/><div className="ring r2"/><div className="auth-spark"><Sparkles/></div></div><div><span>MAKE THE IMPOSSIBLE VISIBLE</span><h1>Every frame begins<br/>with an idea.</h1><p>Bring yours to life with LTX 2.3—faster than the thought that started it.</p></div></div><div className="auth-form-wrap"><div className="auth-form"><div className="mobile-logo"><Logo/></div>{done?<div className="success"><div><Check/></div><h2>Welcome to Morphly.</h2><p>Your workspace is ready with 50 free credits.</p><button className="lime-btn" onClick={()=>setView("dashboard")}>Open your studio <ArrowRight/></button></div>:<><span className="auth-tag">{signup?"START CREATING":"WELCOME BACK"}</span><h2>{signup?"Create your account":"Sign in to Morphly"}</h2><p>{signup?"50 free credits. No credit card required.":"Continue creating where you left off."}</p><button className="google-btn"><span>G</span> Continue with Google</button><div className="or"><span>or continue with email</span></div><form onSubmit={e=>{e.preventDefault();setDone(true)}}>{signup&&<label>Full name<input required placeholder="Lucky Samuel"/></label>}<label>Email address<input type="email" required placeholder="you@company.com"/></label><label>Password<input type="password" required minLength={8} placeholder="At least 8 characters"/></label>{signup&&<label>Referral code <small>Optional</small><input placeholder="MORPHLY-2026"/></label>}<button className="lime-btn" type="submit">{signup?"Create free account":"Sign in"} <ArrowRight/></button></form><p className="switch">{signup?"Already have an account?":"New to Morphly?"} <button onClick={()=>setSignup(!signup)}>{signup?"Sign in":"Create account"}</button></p><small className="legal">By continuing, you agree to Morphly’s Terms of Service and Privacy Policy.</small></>}</div></div></div>;
}

export default function HomePage() {
 const [view,setView]=useState<View>("home");
 useEffect(()=>{scrollTo(0,0)},[view]);
 return <AnimatePresence mode="wait"><motion.div key={view} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.25}}>{view==="home"?<Home setView={setView}/>:view==="dashboard"?<LiveDashboard setView={setView}/>:view==="admin"?<Admin setView={setView}/>:<LiveAuth setView={setView}/>}</motion.div></AnimatePresence>;
}
