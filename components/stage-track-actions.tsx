"use client"

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
          className="group relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-emerald-500 text-[#F4EFE6] hover:text-white border border-[#F4EFE6]/45 hover:border-emerald-500 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.14em] shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer select-none active:scale-[0.98]"
          title="Mark current song as completed"
        >
          <span className="w-4 h-4 rounded-full bg-emerald-400/20 group-hover:bg-white/20 text-emerald-300 group-hover:text-white flex items-center justify-center transition-colors">
            <Check className="w-2.5 h-2.5 stroke-[3]" />
          </span>
          <span>Mark Done</span>
        </button>
      )}

      {/* Next Track: the landing's cream primary pill */}
      {isNextTrackVisible && onNextTrack && (
        <button
          type="button"
          onClick={onNextTrack}
          className="group relative inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F4EFE6] hover:bg-white text-[#0b0a0e] text-[11px] sm:text-xs font-semibold uppercase tracking-[0.14em] shadow-xs hover:shadow-[0_6px_18px_-6px_rgba(0,0,0,0.7)] transition-all duration-200 cursor-pointer select-none active:scale-[0.98]"
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
