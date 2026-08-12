import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  CreditCard,
  Download,
  Grid2x2,
  Image as ImageIcon,
  LayoutGrid,
  Menu,
  PenLine,
  Star,
  Type,
  UploadCloud,
  Wand2,
  Zap,
} from "lucide-react";

const NAV_LINKS = [
  { label: "Features", target: "features" },
  { label: "Templates", target: "showcase" },
  { label: "Pricing", target: "cta" },
];

const FEATURES = [
  { icon: LayoutGrid, title: "Templates", body: "Professionally designed templates" },
  { icon: ImageIcon, title: "Graphics & Photos", body: "Millions of free images & graphics" },
  { icon: BarChart3, title: "Charts & Tables", body: "Visualize data with beautiful charts" },
  { icon: Type, title: "Text & Styling", body: "Advanced text tools and effects" },
  { icon: UploadCloud, title: "Uploads", body: "Upload and edit your own assets" },
  { icon: Grid2x2, title: "Pages & Layouts", body: "Multi-page designs made simple" },
];

const STORIES = [
  {
    image: "/canvaE.png",
    alt: "The AI Illustrations panel inside the Vaycona editor",
    title: "Clean Canvas, simple working space",
    body: "Use the canvas to do make your imgination comes true. You have the ability too choose any size for your page.",
  },
  {
    image: "/templates-suite-detail.png",
    alt: "Browsing template categories and starter designs in Vaycona",
    title: "Hundreds of starting points, zero blank pages",
    body: "Weddings, marketing decks, travel posts, menus — pick a category and start from a real design instead of an empty canvas. Every template stays fully editable, so it's a head start, never a straitjacket.",
  },
];

const STEPS = [
  { icon: LayoutGrid, title: "1. Choose a template", body: "Pick a template or start from scratch." },
  { icon: PenLine, title: "2. Customize", body: "Drag, drop, edit text, add images and more." },
  { icon: BarChart3, title: "3. Create & Refine", body: "Use powerful tools to perfect your design." },
  { icon: Download, title: "4. Export & Share", body: "Export in any format and share with the world." },
];

const ICON_CHIP = "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-100";

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Hamburger menu holding every nav-bar control except "Log in" (which stays
// pinned to the far right of the header per its own button) — Features/
// Templates/Pricing/Resources/About plus the "Get Started Free" CTA.
function NavMenu({ onGetStarted }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function go(target) {
    scrollToId(target);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/35 text-white hover:bg-white/10"
      >
        <Menu size={18} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-56 rounded-xl border border-orange-100 bg-white p-2 shadow-2xl">
          {NAV_LINKS.map((link) => (
            <button
              key={link.label}
              type="button"
              onClick={() => go(link.target)}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-orange-50 hover:text-orange-700"
            >
              {link.label}
            </button>
          ))}
          <span className="flex items-center gap-1 px-3 py-2 text-sm text-slate-700">
            Resources
            <ChevronDown size={14} />
          </span>
          <span className="block px-3 py-2 text-sm text-slate-700">About</span>

          <div className="my-1 border-t border-slate-100" />

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onGetStarted();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Get Started Free
          </button>
        </div>
      )}
    </div>
  );
}

// The first thing a signed-out visitor sees (AppRoot.jsx's Gate renders this
// before LoginPage). Pure marketing/orientation surface — no auth state of
// its own; "Log in"/"Get Started Free" just flip AppRoot's authView over to
// LoginPage.jsx, which already offers both password and Google sign-in, so
// this page doesn't need to duplicate either flow.
export default function LandingPage({ onLogin, onGetStarted }) {
  useEffect(() => {
    const elements = document.querySelectorAll(".reveal");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -40px 0px" }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="vaycona-page min-h-screen bg-white text-slate-900">
      {/* Top nav */}
      <header className="sticky top-0 z-20 border-b border-white/15 bg-[#df5b0c]/90 backdrop-blur-md">
        <div className="grid grid-cols-3 items-center px-4 py-3 sm:px-8 lg:px-12">
          <div className="flex items-center justify-start">
            <NavMenu onGetStarted={onGetStarted} />
          </div>

          <div className="flex items-center justify-center gap-2.5">
            <span className="vaycona-brand text-xl font-semibold tracking-[0.18em] text-white">VAYCONA</span>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={onLogin}
              className="rounded-xl border border-white/35 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Log in
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
<section className="relative overflow-hidden bg-gradient-to-b from-[#f97316] via-[#ea580c] to-[#fff7ed]">
  {/* Typography */}
  <style>
    {`
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');

      .vaycona-page {
        font-family: 'DM Sans', sans-serif;
      }

      .vaycona-page h1,
      .vaycona-page h2,
      .vaycona-page h3,
      .vaycona-brand {
        font-family: 'Space Grotesk', sans-serif;
      }

      .reveal {
        opacity: 0;
        transform: translateY(26px);
        transition: opacity 800ms cubic-bezier(.2,.7,.2,1), transform 800ms cubic-bezier(.2,.7,.2,1);
        transition-delay: var(--reveal-delay, 0ms);
      }

      .reveal.is-visible {
        opacity: 1;
        transform: translateY(0);
      }

      .hero-title {
        animation: heroEnter 900ms cubic-bezier(.2,.75,.2,1) both;
      }

      .hero-subtitle {
        animation: heroEnter 900ms 120ms cubic-bezier(.2,.75,.2,1) both;
      }

      .hero-copy {
        animation: heroEnter 900ms 220ms cubic-bezier(.2,.75,.2,1) both;
      }

      .hero-actions {
        animation: heroEnter 900ms 320ms cubic-bezier(.2,.75,.2,1) both;
      }

      .hero-benefits {
        animation: heroEnter 900ms 420ms cubic-bezier(.2,.75,.2,1) both;
      }

      .float-art {
        animation: floatArt 7s ease-in-out infinite;
        transform-origin: center;
        will-change: transform;
      }

      .float-art-slow {
        animation: floatArtSlow 9s ease-in-out infinite;
        will-change: transform;
      }

      .interactive-card {
        transition: transform 300ms cubic-bezier(.2,.7,.2,1), border-color 300ms ease, background-color 300ms ease;
      }

      .interactive-card:hover {
        transform: translateY(-6px);
      }

      .image-lift {
        transition: transform 600ms cubic-bezier(.2,.7,.2,1), filter 600ms ease;
      }

      .image-lift:hover {
        transform: translateY(-8px) scale(1.012);
        filter: brightness(1.04);
      }

      @keyframes heroEnter {
        from { opacity: 0; transform: translateY(22px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes floatArt {
        0%, 100% { transform: translateY(0) rotate(-0.25deg); }
        50% { transform: translateY(-14px) rotate(0.25deg); }
      }

      @keyframes floatArtSlow {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-9px); }
      }

      @media (prefers-reduced-motion: reduce) {
        .reveal,
        .hero-title,
        .hero-subtitle,
        .hero-copy,
        .hero-actions,
        .hero-benefits,
        .float-art,
        .float-art-slow {
          animation: none !important;
          transition: none !important;
          opacity: 1 !important;
          transform: none !important;
        }
      }
    `}
  </style>

  <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center justify-items-center gap-12 px-4 py-16 text-center sm:px-6 md:py-24 lg:gap-8">
    
    <div className="flex w-full flex-col items-center">
      
      {/* Heading */}
      <h1 className="hero-title max-w-4xl text-4xl font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:text-5xl md:text-6xl lg:text-7xl">
        Something great in your mind today?
      </h1>
      <p className="hero-subtitle mt-4 text-lg font-medium tracking-[-0.015em] text-orange-50 sm:text-xl md:text-2xl">
        Let us build something amazing.
      </p>

      <p className="hero-copy mt-5 max-w-2xl text-base leading-7 text-orange-50/90 sm:text-lg">
        Vaycona is the all-in-one design platform to create stunning graphics, documents, presentations, and more — faster and easier.
      </p>

      {/* Buttons */}
      <div className="hero-actions mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onGetStarted}
          className="flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-orange-700 shadow-lg shadow-orange-950/10 transition-all duration-200 hover:-translate-y-0.5 hover:bg-orange-50"
        >
          Start Designing Free
          <ArrowRight size={16} />
        </button>

        <button
          type="button"
          onClick={() => scrollToId("features")}
          className="rounded-xl border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/20"
        >
          Explore Features
        </button>
      </div>

      {/* Benefits */}
      <div className="hero-benefits mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-orange-50/90 sm:text-sm">
        
        <span className="flex items-center gap-1.5">
          <CreditCard size={14} />
          No credit card required
        </span>

        <span className="flex items-center gap-1.5">
          <Zap size={14} />
          Easy to use for everyone
        </span>

        <span className="flex items-center gap-1.5">
          <Wand2 size={14} />
          Powerful professional tools
        </span>

      </div>
    </div>
  </div>

        <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
            <img
              src="/hero-editor-bear.png"
              alt="The Vaycona editor open on a colorful poster design"
              className="float-art image-lift w-full"
            />
          </div>


      </section>

      {/* Features */}
      <section id="features" className="border-t border-orange-100 bg-[#fff7ed]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="reveal max-w-xl">
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">Everything you need to create</h2>
            <p className="mt-3 text-base text-slate-600">Powerful tools. Beautiful results.</p>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-6">
            {FEATURES.map((feature, i) => (
              <div key={feature.title} className="reveal interactive-card rounded-xl p-2" style={{ "--reveal-delay": `${i * 70}ms` }}>
                <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${ICON_CHIP}`}>
                  <feature.icon size={19} />
                </span>
                <h3 className="mt-3 text-sm font-semibold text-slate-950">{feature.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase — templates, charts, and tables in one panel; captions
          are baked into the artwork itself. */}
      <section id="showcase" className="bg-[#fffaf5] px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
        <img
          src="/showcase-panels-glow.png"
          alt="Templates, chart, and table tools inside the Vaycona editor"
          className="reveal float-art-slow image-lift mx-auto w-full max-w-5xl"
        />
        <div className="reveal mx-auto mt-10 max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-3xl">
            Templates, charts, and tables — all in one place
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            Start from a professionally designed template, drop in a live chart, or build out a table — every tool
            lives inside the same canvas, so you never have to jump between apps to finish a design.
          </p>
        </div>
        </div>
      </section>

      {/* Feature stories — alternating image/copy rows, expanding on what
          the showcase panel above only shows at a glance. */}
      <section className="bg-[#fffdf9] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-20">
          {STORIES.map((story, i) => (
            <div key={story.title} className="reveal grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
              <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                <img
                  src={story.image}
                  alt={story.alt}
                  className="image-lift w-full rounded-xl border border-slate-200 shadow-sm"
                />
              </div>
              <div className={i % 2 === 1 ? "lg:order-1" : ""}>
                <h3 className="text-2xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-3xl">{story.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">{story.body}</p>
              </div>
            </div>
          ))}
        </div>
        </div>
      </section>

      {/* AI section — plain surface, no card wrapper; purple stays contained
          to the product artwork itself rather than the section chrome. */}
      <section className="border-t border-orange-100 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-5 lg:gap-16">
          <div className="reveal lg:col-span-2">
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">Create faster with AI</h2>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-slate-600">
              Generate images, write content, and get design inspiration without leaving the editor.
            </p>
            <button
              type="button"
              onClick={onGetStarted}
              className="mt-7 flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-orange-600"
            >
              Explore AI Tools
              <Wand2 size={15} />
            </button>
          </div>

          <div className="lg:col-span-3">
            <img
              src="/ai-generate-pair.png"
              alt="Example AI-generated artwork inside Vaycona's image generator"
              className="reveal float-art-slow image-lift w-full"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-slate-200 bg-[#fffaf5]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="reveal text-center text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">How Vaycona works</h2>

          <div className="relative mt-14 grid grid-cols-1 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="pointer-events-none absolute left-0 right-0 top-6 hidden border-t border-dashed border-orange-200 lg:block" />
            {STEPS.map((step, i) => (
              <div key={step.title} className="reveal interactive-card relative flex flex-col items-center rounded-xl p-3 text-center" style={{ "--reveal-delay": `${i * 90}ms` }}>
                <span className={`flex h-12 w-12 items-center justify-center rounded-lg ${ICON_CHIP}`}>
                  <step.icon size={20} />
                </span>
                <h3 className="mt-3 text-sm font-semibold text-slate-950">{step.title}</h3>
                <p className="mt-1 max-w-[180px] text-xs leading-relaxed text-slate-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-white px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
        <div
          id="cta"
          className="relative overflow-hidden rounded-2xl border border-orange-200 bg-[#fff7ed] p-8 shadow-xl shadow-orange-100/50 sm:p-12"
        >
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-orange-500/10 blur-[100px]" />
          <img
            src="/logo.png"
            alt=""
            aria-hidden="true"
            className="float-art-slow pointer-events-none absolute -bottom-10 -right-10 z-0 h-40 w-40 rotate-6 rounded-3xl object-cover opacity-20 sm:h-48 sm:w-48"
          />

          <div className="reveal relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-md">
              <h2 className="text-2xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-3xl">Ready to bring your ideas to life?</h2>
              <p className="mt-2 text-sm text-slate-600">Start designing with Vaycona — free, no credit card required.</p>
            </div>

            <div className="flex flex-col items-start gap-4 md:items-end">
              <button
                type="button"
                onClick={onGetStarted}
                className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-orange-600"
              >
                Start Designing Free
                <ArrowRight size={16} />
              </button>
              <div className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
                {["No credit card required", "Free forever plan", "Upgrade anytime"].map((label) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <Check size={13} className="text-orange-400" />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      <footer id="footer" className="border-t border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500 sm:px-6">
        © {new Date().getFullYear()} Vaycona. All rights reserved.
      </footer>
    </div>
  );
}
