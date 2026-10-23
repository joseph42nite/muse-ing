"use client"

import React from "react"
import { Check, SkipForward } from "lucide-react"

interface StageTrackActionsProps {
  onMarkDone?: () => void
  onNextTrack?: () => void
  isMarkDoneVisible?: boolean
  isNextTrackVisible?: boolean
  nextTrackTitle?: string
  className?: string
}

export function StageTrackActions({
  onMarkDone,
  onNextTrack,
  isMarkDoneVisible = true,
  isNextTrackVisible = true,
  nextTrackTitle,
  className = "",
}: StageTrackActionsProps) {
  if (!isMarkDoneVisible && !isNextTrackVisible) return null

  return (
    <div className={`flex items-center gap-2.5 flex-wrap ${className}`}>
      {/* Mark Done Button (Editorial Muse Pill, emerald hover accent) */}
      {isMarkDoneVisible && onMarkDone && (
        <button
          type="button"
          onClick={onMarkDone}
          className="group relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white hover:bg-emerald-600 text-[#181615] hover:text-white border border-[#181615]/15 hover:border-emerald-600 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.14em] shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer select-none active:scale-[0.98]"
          title="Mark current song as completed"
        >
          <span className="w-4 h-4 rounded-full bg-emerald-100 group-hover:bg-white/20 text-emerald-700 group-hover:text-white flex items-center justify-center transition-colors">
            <Check className="w-2.5 h-2.5 stroke-[3]" />
          </span>
          <span>Mark Done</span>
        </button>
      )}

      {/* Next Track Button (Matches Landing Page Editorial Pill: Dark #181615 with Crimson #D92323 hover) */}
      {isNextTrackVisible && onNextTrack && (
        <button
          type="button"
          onClick={onNextTrack}
          className="group relative inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#181615] hover:bg-[#D92323] text-white text-[11px] sm:text-xs font-semibold uppercase tracking-[0.14em] shadow-xs hover:shadow-[0_4px_14px_rgba(217,35,35,0.35)] transition-all duration-200 cursor-pointer select-none active:scale-[0.98]"
          title={nextTrackTitle ? `Next: ${nextTrackTitle}` : "Play next track in setlist"}
        >
          <span>Next Track</span>
          <SkipForward className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      )}
    </div>
  )
}

export default StageTrackActions
