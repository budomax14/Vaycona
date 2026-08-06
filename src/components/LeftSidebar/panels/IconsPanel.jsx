import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Bell,
  Briefcase,
  Camera,
  ChartColumn,
  Check,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  CircleUser,
  Cloud,
  CloudRain,
  Compass,
  CreditCard,
  DollarSign,
  Flag,
  Gift,
  Heart,
  Home,
  Info,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Music,
  Pause,
  Phone,
  Play,
  Plus,
  Search,
  Send,
  Share2,
  ShoppingBag,
  ShoppingCart,
  Smile,
  Snowflake,
  Star,
  Sun,
  Tag,
  ThumbsUp,
  TrendingUp,
  Umbrella,
  User,
  Users,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { ICON_CATEGORIES, searchIcons } from "../../../iconCatalog";

// Explicit named imports (never `import * as`) so tree-shaking keeps only
// these ~40 icons in the bundle — this map is the sidebar picker's own UI
// iconography (identical to how every other icon in this app's chrome
// already renders), not the inserted canvas object. The canvas object
// itself (IconNode.jsx) is built from the same icon's raw vector data as
// real Konva shapes, never this component.
const ICON_COMPONENTS = {
  Home, Star, Heart, Check, X, Plus, Search,
  Mail, MessageCircle, Phone, Send,
  Share2, ThumbsUp, Bell, Users,
  Briefcase, TrendingUp, ChartColumn, DollarSign,
  ArrowRight, ArrowLeft, MapPin, Compass, ChevronRight,
  Play, Pause, Camera, Music, Image: ImageIcon,
  ShoppingCart, ShoppingBag, Tag, CreditCard, Gift,
  User, CircleUser, Smile,
  Sun, Cloud, CloudRain, Umbrella, Snowflake,
  CircleAlert, Info, CircleHelp, Lock, Flag, Award,
};
export default function IconsPanel({ onAddIcon }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchIcons(query), [query]);
  const grouped = useMemo(() => {
    if (query.trim()) return [{ category: "Results", icons: results }];
    return ICON_CATEGORIES.map((category) => ({
      category,
      icons: results.filter((icon) => icon.category === category),
    }));
  }, [results, query]);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-800">Icons</h3>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search icons by name or category"
          aria-label="Search icons"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-2 text-sm text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
        />
      </div>

      {grouped.every((group) => group.icons.length === 0) && (
        <p className="text-sm text-gray-400">No icons match "{query}".</p>
      )}

      {grouped.map(
        (group) =>
          group.icons.length > 0 && (
            <div key={group.category} className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {group.category}
              </span>
              <div className="grid grid-cols-4 gap-2">
                {group.icons.map((icon) => {
                  const IconComp = ICON_COMPONENTS[icon.name];
                  return (
                    <button
                      key={icon.name}
                      type="button"
                      className="flex flex-col items-center gap-1 rounded-xl border border-gray-200 py-3 text-gray-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
                      onClick={() => onAddIcon(icon.name)}
                      title={icon.name}
                      aria-label={`Add ${icon.name} icon`}
                    >
                      {IconComp && <IconComp size={20} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )
      )}
    </div>
  );
}
