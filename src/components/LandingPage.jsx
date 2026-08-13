import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  CreditCard,
  Crown,
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
import { useLanguage } from "../languageContext";
import { STRINGS } from "../i18n";

const NAV_TARGETS = [
  { key: "features", target: "features" },
  { key: "templates", target: "showcase" },
  { key: "pricing", target: "cta" },
];

const PLAN_ICONS = { pro: Crown, business: Building2 };

const FEATURE_ICONS = [LayoutGrid, ImageIcon, BarChart3, Type, UploadCloud, Grid2x2];

const STORY_IMAGES = ["/canvaE.png", "/templates-suite-detail.png"];

const STEP_ICONS = [LayoutGrid, PenLine, BarChart3, Download];

const ICON_CHIP = "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-100";

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Hamburger menu holding every nav-bar control except "Log in" (which stays
// pinned to the far right of the header per its own button) — Features/
// Templates/Pricing/Resources/About plus the "Get Started Free" CTA.
function NavMenu({ onGetStarted }) {
  const { language, setLanguage } = useLanguage();
  const c = STRINGS[language].common;
  const t = STRINGS[language].landing;
  const navLinks = NAV_TARGETS.map(({ key, target }) => ({ label: t.nav[key], target }));
  const plans = [
    { key: "pro", icon: PLAN_ICONS.pro, ...t.plans.pro },
    { key: "business", icon: PLAN_ICONS.business, ...t.plans.business },
  ];
  const [open, setOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
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

  useEffect(() => {
    if (!open) setPlansOpen(false);
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
        aria-label={t.nav.menu}
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/35 text-white hover:bg-white/10"
      >
        <Menu size={18} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-56 rounded-xl border border-orange-100 bg-white p-2 shadow-2xl">
          {navLinks.map((link) => (
            <button
              key={link.label}
              type="button"
              onClick={() => go(link.target)}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-orange-50 hover:text-orange-700"
            >
              {link.label}
            </button>
          ))}
          <div>
            <button
              type="button"
              onClick={() => setPlansOpen((v) => !v)}
              aria-expanded={plansOpen}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-orange-50 hover:text-orange-700"
            >
              {t.nav.plans}
              <ChevronDown size={14} className={`transition-transform ${plansOpen ? "rotate-180" : ""}`} />
            </button>

            {plansOpen && (
              <div className="space-y-2 px-1 pb-2 pt-1">
                {plans.map((plan) => (
                  <div key={plan.key} className="rounded-lg border border-orange-100 bg-orange-50/60 p-3">
                    <div className="flex items-center gap-2">
                      <plan.icon size={14} className="shrink-0 text-orange-600" />
                      <span className="text-sm font-semibold text-slate-900">{plan.name}</span>
                      <span className="ml-auto text-xs font-medium text-slate-500">{plan.price}</span>
                    </div>
                    <p className="mt-0.5 pl-5.5 text-xs text-slate-500">{plan.tagline}</p>
                    <ul className="mt-2 space-y-1">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-1.5 text-xs text-slate-600">
                          <Check size={12} className="mt-0.5 shrink-0 text-orange-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          <span className="flex items-center gap-1 px-3 py-2 text-sm text-slate-700">
            {t.nav.resources}
            <ChevronDown size={14} />
          </span>
          <span className="block px-3 py-2 text-sm text-slate-700">{t.nav.about}</span>

          <div className="my-1 border-t border-slate-100" />

          <div className="px-3 py-2">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">{c.language}</span>
            <div className="flex gap-1 rounded-lg border border-slate-200 p-1">
              {[
                { key: "en", label: "English" },
                { key: "fr", label: "Français" },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setLanguage(option.key)}
                  className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                    language === option.key
                      ? "bg-orange-100 text-orange-700"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="my-1 border-t border-slate-100" />

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onGetStarted();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            {t.nav.getStartedFree}
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
  const { language } = useLanguage();
  const t = STRINGS[language].landing;

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
              {t.nav.logIn}
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
        {t.hero.heading}
      </h1>
      <p className="hero-subtitle mt-4 text-lg font-medium tracking-[-0.015em] text-orange-50 sm:text-xl md:text-2xl">
        {t.hero.subtitle}
      </p>

      <p className="hero-copy mt-5 max-w-2xl text-base leading-7 text-orange-50/90 sm:text-lg">
        {t.hero.copy}
      </p>

      {/* Buttons */}
      <div className="hero-actions mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onGetStarted}
          className="flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-orange-700 shadow-lg shadow-orange-950/10 transition-all duration-200 hover:-translate-y-0.5 hover:bg-orange-50"
        >
          {t.hero.startDesigning}
          <ArrowRight size={16} />
        </button>

        <button
          type="button"
          onClick={() => scrollToId("features")}
          className="rounded-xl border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/20"
        >
          {t.hero.exploreFeatures}
        </button>
      </div>

      {/* Benefits */}
      <div className="hero-benefits mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-orange-50/90 sm:text-sm">

        <span className="flex items-center gap-1.5">
          <CreditCard size={14} />
          {t.hero.benefitNoCard}
        </span>

        <span className="flex items-center gap-1.5">
          <Zap size={14} />
          {t.hero.benefitEasy}
        </span>

        <span className="flex items-center gap-1.5">
          <Wand2 size={14} />
          {t.hero.benefitPowerful}
        </span>

      </div>
    </div>
  </div>

        <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
            <img
              src="/hero-editor-bear.png"
              alt={t.hero.imageAlt}
              className="float-art image-lift w-full"
            />
          </div>


      </section>

      {/* Features */}
      <section id="features" className="border-t border-orange-100 bg-[#fff7ed]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="reveal max-w-xl">
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">{t.featuresSection.heading}</h2>
            <p className="mt-3 text-base text-slate-600">{t.featuresSection.subheading}</p>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-6">
            {t.features.map((feature, i) => {
              const FeatureIcon = FEATURE_ICONS[i];
              return (
                <div key={feature.title} className="reveal interactive-card rounded-xl p-2" style={{ "--reveal-delay": `${i * 70}ms` }}>
                  <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${ICON_CHIP}`}>
                    <FeatureIcon size={19} />
                  </span>
                  <h3 className="mt-3 text-sm font-semibold text-slate-950">{feature.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{feature.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Showcase — templates, charts, and tables in one panel; captions
          are baked into the artwork itself. */}
      <section id="showcase" className="bg-[#fffaf5] px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
        <img
          src="/showcase-panels-glow.png"
          alt={t.showcase.imageAlt}
          className="reveal float-art-slow image-lift mx-auto w-full max-w-5xl"
        />
        <div className="reveal mx-auto mt-10 max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-3xl">
            {t.showcase.heading}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            {t.showcase.body}
          </p>
        </div>
        </div>
      </section>

      {/* Feature stories — alternating image/copy rows, expanding on what
          the showcase panel above only shows at a glance. */}
      <section className="bg-[#fffdf9] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-20">
          {t.stories.map((story, i) => (
            <div key={story.title} className="reveal grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
              <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                <img
                  src={STORY_IMAGES[i]}
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
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">{t.ai.heading}</h2>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-slate-600">
              {t.ai.body}
            </p>
            <button
              type="button"
              onClick={onGetStarted}
              className="mt-7 flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-orange-600"
            >
              {t.ai.cta}
              <Wand2 size={15} />
            </button>
          </div>

          <div className="lg:col-span-3">
            <img
              src="/ai-generate-pair.png"
              alt={t.ai.imageAlt}
              className="reveal float-art-slow image-lift w-full"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-slate-200 bg-[#fffaf5]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="reveal text-center text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">{t.howItWorks.heading}</h2>

          <div className="relative mt-14 grid grid-cols-1 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="pointer-events-none absolute left-0 right-0 top-6 hidden border-t border-dashed border-orange-200 lg:block" />
            {t.steps.map((step, i) => {
              const StepIcon = STEP_ICONS[i];
              return (
                <div key={step.title} className="reveal interactive-card relative flex flex-col items-center rounded-xl p-3 text-center" style={{ "--reveal-delay": `${i * 90}ms` }}>
                  <span className={`flex h-12 w-12 items-center justify-center rounded-lg ${ICON_CHIP}`}>
                    <StepIcon size={20} />
                  </span>
                  <h3 className="mt-3 text-sm font-semibold text-slate-950">{step.title}</h3>
                  <p className="mt-1 max-w-[180px] text-xs leading-relaxed text-slate-600">{step.body}</p>
                </div>
              );
            })}
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
              <h2 className="text-2xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-3xl">{t.cta.heading}</h2>
              <p className="mt-2 text-sm text-slate-600">{t.cta.body}</p>
            </div>

            <div className="flex flex-col items-start gap-4 md:items-end">
              <button
                type="button"
                onClick={onGetStarted}
                className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-orange-600"
              >
                {t.cta.start}
                <ArrowRight size={16} />
              </button>
              <div className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
                {t.cta.bullets.map((label) => (
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
        {t.footer(new Date().getFullYear())}
      </footer>
    </div>
  );
}
