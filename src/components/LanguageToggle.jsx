import React from "react";
import { useLanguage } from "../languageContext";
import "./LanguageToggle.css";

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const isFrench = language === "fr";

  return (
    <div className="lang-toggle-container">
      <div className="lang-toggle-wrap">
        <input
          className="lang-toggle-input"
          id="lang-holo-toggle"
          type="checkbox"
          checked={isFrench}
          onChange={(e) => setLanguage(e.target.checked ? "fr" : "en")}
        />
        <label className="lang-toggle-track" htmlFor="lang-holo-toggle">
          <div className="lang-track-lines">
            <div className="lang-track-line" />
          </div>

          <div className="lang-toggle-thumb">
            <div className="lang-thumb-core" />
            <div className="lang-thumb-inner" />
            <div className="lang-thumb-scan" />
            <div className="lang-thumb-particles">
              <div className="lang-thumb-particle" />
              <div className="lang-thumb-particle" />
              <div className="lang-thumb-particle" />
              <div className="lang-thumb-particle" />
              <div className="lang-thumb-particle" />
            </div>
          </div>

          <div className="lang-toggle-data">
            <div className="lang-data-text lang-off">French</div>
            <div className="lang-data-text lang-on">English</div>
            <div className="lang-status-indicator lang-off" />
            <div className="lang-status-indicator lang-on" />
          </div>

          <div className="lang-energy-rings">
            <div className="lang-energy-ring" />
            <div className="lang-energy-ring" />
            <div className="lang-energy-ring" />
          </div>

          <div className="lang-interface-lines">
            <div className="lang-interface-line" />
            <div className="lang-interface-line" />
            <div className="lang-interface-line" />
            <div className="lang-interface-line" />
            <div className="lang-interface-line" />
            <div className="lang-interface-line" />
          </div>

          <div className="lang-toggle-reflection" />
          <div className="lang-holo-glow" />
        </label>
      </div>
    </div>
  );
}
