import React from "react";
import { useTheme } from "../themeContext";
import "./ThemeToggle.css";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <label className="theme-toggle-switch">
      <input type="checkbox" checked={isDark} onChange={(e) => setTheme(e.target.checked ? "dark" : "light")} />
      <span className="theme-toggle-slider">
        <div className="theme-toggle-moons-hole">
          <div className="theme-toggle-moon-hole" />
          <div className="theme-toggle-moon-hole" />
          <div className="theme-toggle-moon-hole" />
        </div>
        <div className="theme-toggle-black-clouds">
          <div className="theme-toggle-black-cloud" />
          <div className="theme-toggle-black-cloud" />
          <div className="theme-toggle-black-cloud" />
        </div>
        <div className="theme-toggle-clouds">
          <div className="theme-toggle-cloud" />
          <div className="theme-toggle-cloud" />
          <div className="theme-toggle-cloud" />
          <div className="theme-toggle-cloud" />
          <div className="theme-toggle-cloud" />
          <div className="theme-toggle-cloud" />
          <div className="theme-toggle-cloud" />
        </div>
        <div className="theme-toggle-stars">
          {[0, 1, 2, 3, 4].map((i) => (
            <svg key={i} className="theme-toggle-star" viewBox="0 0 20 20">
              <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" />
            </svg>
          ))}
        </div>
      </span>
    </label>
  );
}
