"use client"

import React from "react"
import Link from "next/link"
import { QrCode, MapPin, Calendar, ExternalLink, Copy, Check, X } from "lucide-react"

interface QrCodeModalProps {
  open: boolean
  onClose: () => void
  locationName: string
  locationSlug: string
  eventDateOnly: string
  eventTitle: string
  artistName?: string
}

// Generates a crisp deterministic QR-style SVG matrix from the URL string (works 100% offline)
function generateMatrix(seed: string, size = 21): boolean[][] {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const border = r === 0 || r === 6 || c === 0 || c === 6
        const inner = r >= 2 && r <= 4 && c >= 2 && c <= 4
        grid[r0 + r][c0 + c] = border || inner
      }
    }
  }

  drawFinder(0, 0)
  drawFinder(0, size - 7)
  drawFinder(size - 7, 0)

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inFinder =
        (r < 8 && c < 8) ||
        (r < 8 && c >= size - 8) ||
        (r >= size - 8 && c < 8)
      if (inFinder) continue
      hash ^= (r * 31 + c * 17) & 0xff
      hash = Math.imul(hash, 16777619)
      grid[r][c] = (Math.abs(hash) + r + c) % 3 !== 0
    }
  }
  return grid
}

export default function QrCodeModal({
  open,
  onClose,
  locationName,
  locationSlug,
  eventDateOnly,
  eventTitle,
  artistName,
}: QrCodeModalProps) {
  const [copied, setCopied] = React.useState(false)

  if (!open) return null

  const relativeUrl = `/live?location=${encodeURIComponent(locationSlug)}&date=${encodeURIComponent(eventDateOnly)}`
  const fullUrl =
    typeof window !== "undefined" ? `${window.location.origin}${relativeUrl}` : relativeUrl
  const matrix = generateMatrix(`${locationSlug}:${eventDateOnly}`)

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md bg-[#101018] border border-white/15 rounded-3xl p-6 text-white relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 text-purple-300 text-xs font-medium mb-2">
          <QrCode className="w-4 h-4" />
          Location + Date Venue Table QR
        </div>
        <h3 className="text-xl font-semibold text-white">{eventTitle}</h3>
        {artistName && <p className="text-sm text-white/70 mt-0.5">Featuring {artistName}</p>}

        <div className="flex flex-wrap gap-2 mt-3">
          <span className="inline-flex items-center gap-1.5 text-xs bg-white/10 px-2.5 py-1 rounded-full text-white/90">
            <MapPin className="w-3.5 h-3.5 text-purple-400" />
            {locationName}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs bg-white/10 px-2.5 py-1 rounded-full text-white/90">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            {eventDateOnly}
          </span>
        </div>

        {/* Visual QR Code Card */}
        <div className="my-5 bg-white rounded-2xl p-5 flex flex-col items-center justify-center text-black shadow-inner">
          <svg viewBox="0 0 21 21" className="w-48 h-48" shapeRendering="crispEdges">
            {matrix.map((row, rIdx) =>
              row.map((cell, cIdx) =>
                cell ? (
                  <rect key={`${rIdx}-${cIdx}`} x={cIdx} y={rIdx} width={1} height={1} fill="#09090f" />
                ) : null
              )
            )}
          </svg>
          <p className="text-[11px] font-semibold tracking-wider uppercase text-neutral-700 mt-3">
            SCAN TO REQUEST & UPVOTE SONGS
          </p>
          <p className="text-[10px] text-neutral-500 mt-0.5 font-mono">
            {locationSlug} • {eventDateOnly}
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center justify-between gap-2 mb-4">
          <code className="text-xs text-purple-200 truncate">{relativeUrl}</code>
          <button
            onClick={handleCopy}
            className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs flex items-center gap-1 shrink-0 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="flex gap-2.5">
          <Link
            href={relativeUrl}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-amber-500 text-black font-semibold text-xs flex items-center justify-center gap-1.5 hover:opacity-95 transition"
          >
            <ExternalLink className="w-4 h-4" />
            Simulate QR Scan (Open Phone View)
          </Link>
        </div>
      </div>
    </div>
  )
}
