import React from "react";
import { Clock, Lock } from "lucide-react";

export default function PlanStatusBanner({ canEdit, isTrialing, currentPeriodEnd, onOpenPricing }) {
  if (canEdit && !isTrialing) return null;

  if (!canEdit) {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
        <span className="flex items-center gap-2">
          <Lock size={14} className="shrink-0" />
          Your trial has ended. Your designs are safe — subscribe to keep editing.
        </span>
        <button
          className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          onClick={onOpenPricing}
        >
          Subscribe
        </button>
      </div>
    );
  }

  const daysLeft = currentPeriodEnd != null ? Math.max(0, Math.ceil((currentPeriodEnd - Date.now()) / 86400000)) : null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600">
      <span className="flex items-center gap-2">
        <Clock size={14} className="shrink-0" />
        {daysLeft != null ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your free trial.` : "You're on a free trial."}
      </span>
      <button className="shrink-0 text-xs font-medium text-amber-700 hover:underline" onClick={onOpenPricing}>
        Manage plan
      </button>
    </div>
  );
}
