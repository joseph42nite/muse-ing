"use client"

import React, { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
} from "framer-motion"
import MuseLoadingScreen from "@/components/muse-loading-screen"
import QrCodeModal from "@/components/qr-code-modal"
import {
  MapPin,
  Calendar,
  Mic2,
  QrCode,
  ThumbsUp,
  Sparkles,
  Music,
  Instagram,
  Tv,
  ArrowRight,
  ListMusic,
  CheckCircle2,
  ExternalLink,
  X,
  Ticket,
  Menu,
} from "lucide-react"

export interface PublicEvent {
  id: string
  title: string
  description: string | null
  date: string
  event_date_only: string
  location_name: string
  location_slug: string
  ticket_price: number
  artist_id: string | null
  artist_name: string | null
  artist_instagram: string | null
  artist_avatar: string | null
  artist_bio: string | null
  confirmed_songs_count: number
  playlist_songs_count: number
  total_upvotes: number
  priority_dedications_count: number
  cover_image?: string
}

export interface FeaturedArtist {
  id: string
  name: string
  role_tag: string
  city: string
  instagram_handle: string
  avatar_url: string
  bio: string
  next_event_title: string
  next_event_location: string
  next_event_slug: string
  next_event_date: string
  date_badge: string
  card_number: string
}

const INITIAL_ARTISTS: FeaturedArtist[] = [
  {
    id: "artist-arjun-01",
    name: "Arjun Mehta & The Midnight Collective",
    role_tag: "Indie-Pop & Acoustic Soul",
    city: "Bengaluru",
    instagram_handle: "@arjunmehtalive",
    avatar_url:
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80",
    bio: "Indie-pop & acoustic soul vocalist performing live crowd-curated sets across Bengaluru & Mumbai.",
    next_event_title: "Unplugged Crowd Request Night",
    next_event_location: "Toit Brewhouse, Indiranagar • Bengaluru",
    next_event_slug: "toit-indiranagar",
    next_event_date: new Date().toISOString().slice(0, 10),
    date_badge: "TONIGHT • 20:30",
    card_number: "1/4",
  },
  {
    id: "artist-maya-02",
    name: "Maya Sen",
    role_tag: "Neo-Bollywood & Retro Unplugged",
    city: "Mumbai",
    instagram_handle: "@mayasenmusic",
    avatar_url:
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&auto=format&fit=crop&q=80",
    bio: "Neo-bollywood, retro classics & unplugged acoustic requests shaped live by every table in the room.",
    next_event_title: "Bollywood & Retro Sing-Along Live",
    next_event_location: "The Quarter, Royal Opera House • Mumbai",
    next_event_slug: "the-quarter-mumbai",
    next_event_date: new Date().toISOString().slice(0, 10),
    date_badge: "TONIGHT • 21:00",
    card_number: "2/4",
  },
  {
    id: "artist-kabir-03",
    name: "Kabir & The Neon Strings",
    role_tag: "Arena Rock & Sing-Along Anthems",
    city: "Pune",
    instagram_handle: "@kabirneonstrings",
    avatar_url:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&auto=format&fit=crop&q=80",
    bio: "High-energy rock, pop anthems & interactive HDMI stage karaoke nights where the crowd leads the chorus.",
    next_event_title: "Saturday Arena Anthems & Dedications",
    next_event_location: "Hard Rock Cafe, Koregaon Park • Pune",
    next_event_slug: "hard-rock-pune",
    next_event_date: new Date(Date.now() + 86400e3).toISOString().slice(0, 10),
    date_badge: "TOMORROW • 21:00",
    card_number: "3/4",
  },
  {
    id: "artist-zoya-04",
    name: "Zoya Kapoor & Velvet Echo",
    role_tag: "Midnight Jazz & Soul Dedications",
    city: "New Delhi",
    instagram_handle: "@zoyavelvetlive",
    avatar_url:
      "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=80",
    bio: "Intimate late-night vocals, live loop pedals, and spontaneous crowd shoutout ballads.",
    next_event_title: "Velvet Acoustic Sessions",
    next_event_location: "The Piano Man Jazz Club • New Delhi",
    next_event_slug: "toit-indiranagar",
    next_event_date: new Date(Date.now() + 86400e3).toISOString().slice(0, 10),
    date_badge: "THIS WEEKEND",
    card_number: "4/4",
  },
]

const INITIAL_EVENTS: PublicEvent[] = [
  {
    id: "gig-koramangala-tonight",
    title: "Unplugged Crowd Request Night",
    description:
      "Browse Arjun's live setlist, upvote the songs you want next, submit 3 song suggestions, or dedicate a song with a ₹50 live shoutout!",
    date: new Date().toISOString(),
    event_date_only: new Date().toISOString().slice(0, 10),
    location_name: "Toit Brewhouse, Indiranagar • Bengaluru",
    location_slug: "toit-indiranagar",
    ticket_price: 499,
    artist_id: "artist-arjun-01",
    artist_name: "Arjun Mehta & The Midnight Collective",
    artist_instagram: "@arjunmehtalive",
    artist_avatar:
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80",
    artist_bio:
      "Indie-pop & acoustic soul vocalist performing live crowd-curated sets across Bengaluru & Mumbai.",
    confirmed_songs_count: 8,
    playlist_songs_count: 4,
    total_upvotes: 180,
    priority_dedications_count: 2,
    cover_image:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "gig-bandra-tonight",
    title: "Bollywood & Retro Sing-Along Live",
    description:
      "Interactive acoustic evening where every song on the setlist is upvoted and shaped by the audience.",
    date: new Date().toISOString(),
    event_date_only: new Date().toISOString().slice(0, 10),
    location_name: "The Quarter, Royal Opera House • Mumbai",
    location_slug: "the-quarter-mumbai",
    ticket_price: 699,
    artist_id: "artist-maya-02",
    artist_name: "Maya Sen",
    artist_instagram: "@mayasenmusic",
    artist_avatar:
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=80",
    artist_bio: "Neo-bollywood, retro classics & unplugged acoustic requests.",
    confirmed_songs_count: 6,
    playlist_songs_count: 2,
    total_upvotes: 94,
    priority_dedications_count: 3,
    cover_image:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "gig-indiranagar-tomorrow",
    title: "Saturday Arena Anthems & Dedications",
    description:
      "Electric acoustic mashups, live LED karaoke lyrics, and crowd dedications all night.",
    date: new Date(Date.now() + 86400e3).toISOString(),
    event_date_only: new Date(Date.now() + 86400e3).toISOString().slice(0, 10),
    location_name: "Hard Rock Cafe, Koregaon Park • Pune",
    location_slug: "hard-rock-pune",
    ticket_price: 599,
    artist_id: "artist-kabir-03",
    artist_name: "Kabir & The Neon Strings",
    artist_instagram: "@kabirneonstrings",
    artist_avatar:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&auto=format&fit=crop&q=80",
    artist_bio: "High-energy rock, pop anthems & interactive sing-along nights.",
    confirmed_songs_count: 9,
    playlist_songs_count: 5,
    total_upvotes: 142,
    priority_dedications_count: 4,
    cover_image:
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&auto=format&fit=crop&q=80",
  },
]

const EVENT_COVERS = [
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&auto=format&fit=crop&q=80",
]

export default function HomePage() {
  const [events, setEvents] = useState<PublicEvent[]>(INITIAL_EVENTS)
  const [artists, setArtists] = useState<FeaturedArtist[]>(INITIAL_ARTISTS)
  const [selectedCity, setSelectedCity] = useState<string>("ALL")
  const [qrModalEvent, setQrModalEvent] = useState<PublicEvent | null>(null)
  const [activeArtistModal, setActiveArtistModal] = useState<FeaturedArtist | null>(null)
  const [activeSection, setActiveSection] = useState<number>(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    // Cinematic editorial entrance loader on landing page visit
    const timer = setTimeout(() => {
      setInitialLoading(false)
    }, 2400)
    return () => clearTimeout(timer)
  }, [])

  // Contact / Booking Form State (Section 3)
  const [inquiryType, setInquiryType] = useState<"reserve" | "host" | "artist">("reserve")
  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formEventId, setFormEventId] = useState<string>(INITIAL_EVENTS[0].id)
  const [formMessage, setFormMessage] = useState("")
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formSubmitted, setFormSubmitted] = useState< null | {
    name: string
    inquiryType: string
    eventTitle?: string
    eventId?: string
  }>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  // Responsive spring physics: calibrated for silky, momentum-driven inertia across horizontal and vertical transitions
  const rawProgress = useMotionValue(0)
  const smoothProgress = useSpring(rawProgress, {
    stiffness: 75,
    damping: 20,
    mass: 0.38,
  })

  // Camera translation track with cubic S-curve ease interpolation:
  // Phase 1: Section 1 (muse-ing) -> Section 2 (events) horizontal glide [0.10..0.28]
  // Phase 2: Section 2 (events) -> Section 3 (artists) velvet-smooth vertical dive [0.38..0.66]
  // Phase 3: Section 3 (artists) -> Section 4 (form on right) horizontal glide [0.76..0.94]
  const trackX = useTransform(
    smoothProgress,
    [0, 0.10, 0.14, 0.19, 0.24, 0.28, 0.76, 0.80, 0.85, 0.90, 0.94, 1.0],
    ["0vw", "0vw", "-6vw", "-50vw", "-94vw", "-100vw", "-100vw", "-106vw", "-150vw", "-194vw", "-200vw", "-200vw"]
  )
  const trackY = useTransform(
    smoothProgress,
    [0, 0.38, 0.42, 0.47, 0.52, 0.57, 0.62, 0.66, 1.0],
    ["0vh", "0vh", "-6vh", "-24vh", "-50vh", "-76vh", "-94vh", "-100vh", "-100vh"]
  )

  // Fluid cross-fade and depth transforms between Section 1, Section 2 (Events) and Section 3 (Artists)
  const section1Opacity = useTransform(smoothProgress, [0, 0.10, 0.20], [1, 1, 0])
  const section2Opacity = useTransform(smoothProgress, [0.18, 0.26, 0.44, 0.58], [0, 1, 1, 0.15])
  const section3Opacity = useTransform(smoothProgress, [0.44, 0.58, 0.74, 0.86], [0.15, 1, 1, 0.3])

  // Parallax shifts and opacity fades for the giant crimson serif words
  const artistsWordX = useTransform(smoothProgress, [0, 0.22], ["0vw", "-50vw"])
  const artistsWordY = useTransform(smoothProgress, [0, 0.12, 0.26], ["6.5vh", "-2vh", "-5vh"])
  const artistsWordOpacity = useTransform(smoothProgress, [0, 0.08, 0.18], [1, 0.8, 0])

  const eventsWordX = useTransform(smoothProgress, [0.22, 0.48], ["20vw", "-20vw"])
  const eventsWordY = useTransform(smoothProgress, [0.22, 0.35, 0.48], ["5vh", "-1vh", "-5vh"])
  const eventsWordOpacity = useTransform(smoothProgress, [0.16, 0.26, 0.44, 0.54], [0, 1, 1, 0])

  // Parallax & dynamic floating transforms for Artist Cards in Section 1
  const artistCard1X = useTransform(smoothProgress, [0, 0.05, 0.14, 0.26], ["0px", "-90px", "-420px", "-780px"])
  const artistCard1Y = useTransform(smoothProgress, [0, 0.05, 0.14, 0.26], ["0px", "10px", "180px", "360px"])
  const artistCard1Rot = useTransform(smoothProgress, [0, 0.05, 0.18], [-14, -18, -34])
  const artistCard1Opacity = useTransform(smoothProgress, [0, 0.14, 0.26], [1, 0.75, 0.1])

  const artistCard2X = useTransform(smoothProgress, [0, 0.05, 0.14, 0.26], ["0px", "-110px", "-300px", "-540px"])
  const artistCard2Y = useTransform(smoothProgress, [0, 0.05, 0.14, 0.26], ["0px", "-15px", "-240px", "-460px"])
  const artistCard2Rot = useTransform(smoothProgress, [0, 0.05, 0.18], [-3, -6, -38])
  const artistCard2Opacity = useTransform(smoothProgress, [0, 0.14, 0.26], [1, 0.75, 0.1])

  const artistCard3X = useTransform(smoothProgress, [0, 0.05, 0.14, 0.26], ["0px", "-75px", "320px", "680px"])
  const artistCard3Y = useTransform(smoothProgress, [0, 0.05, 0.14, 0.26], ["0px", "12px", "220px", "420px"])
  const artistCard3Rot = useTransform(smoothProgress, [0, 0.05, 0.18], [14, 10, 36])
  const artistCard3Opacity = useTransform(smoothProgress, [0, 0.14, 0.26], [1, 0.75, 0.1])

  const artistCard4X = useTransform(smoothProgress, [0, 0.05, 0.14, 0.26], ["0px", "-65px", "480px", "950px"])
  const artistCard4Y = useTransform(smoothProgress, [0, 0.05, 0.14, 0.26], ["0px", "-10px", "-180px", "-380px"])
  const artistCard4Rot = useTransform(smoothProgress, [0, 0.05, 0.18], [-8, -12, 38])
  const artistCard4Opacity = useTransform(smoothProgress, [0, 0.14, 0.26], [1, 0.75, 0.1])

  // Individual dynamic parallax transforms for Event Cards in Section 2
  const eventCard1X = useTransform(smoothProgress, [0.22, 0.48], ["-80px", "110px"])
  const eventCard1Y = useTransform(smoothProgress, [0.22, 0.48], ["-60px", "70px"])
  const eventCard1Rot = useTransform(smoothProgress, [0.22, 0.48], [-18, 12])

  const eventCard2X = useTransform(smoothProgress, [0.22, 0.48], ["60px", "-130px"])
  const eventCard2Y = useTransform(smoothProgress, [0.22, 0.48], ["-80px", "90px"])
  const eventCard2Rot = useTransform(smoothProgress, [0.22, 0.48], [16, -10])

  const eventCard3X = useTransform(smoothProgress, [0.22, 0.48], ["-40px", "140px"])
  const eventCard3Y = useTransform(smoothProgress, [0.22, 0.48], ["70px", "-110px"])
  const eventCard3Rot = useTransform(smoothProgress, [0.22, 0.48], [-12, 16])

  const eventCard4X = useTransform(smoothProgress, [0.22, 0.48], ["120px", "-90px"])
  const eventCard4Y = useTransform(smoothProgress, [0.22, 0.48], ["90px", "-70px"])
  const eventCard4Rot = useTransform(smoothProgress, [0.22, 0.48], [-20, 8])

  const eventCard5X = useTransform(smoothProgress, [0.22, 0.48], ["-100px", "80px"])
  const eventCard5Y = useTransform(smoothProgress, [0.22, 0.48], ["50px", "100px"])
  const eventCard5Rot = useTransform(smoothProgress, [0.22, 0.48], [12, -18])

  // Section 2: Cluster shift
  const eventClusterShiftX = useTransform(smoothProgress, [0.22, 0.48], ["50px", "-50px"])

  // Section 3: "artists" parallax (Vertical scroll down into Artists)
  // Perfectly keeps the letter 'a' framed within the viewport at rest
  const artists3WordX = useTransform(
    smoothProgress,
    [0.42, 0.58, 0.70, 0.90],
    ["8vw", "2vw", "0vw", "-24vw"]
  )
  const artists3WordY = useTransform(
    smoothProgress,
    [0.42, 0.58, 0.72],
    ["8vh", "0vh", "-6vh"]
  )
  const artists3WordOpacity = useTransform(smoothProgress, [0.42, 0.54, 0.76, 0.86], [0, 1, 1, 0])

  const artist3Card1X = useTransform(smoothProgress, [0.44, 0.62, 0.76, 0.94], ["0px", "0px", "-160px", "-480px"])
  const artist3Card1Y = useTransform(smoothProgress, [0.44, 0.62, 0.76, 0.94], ["-60px", "0px", "80px", "220px"])
  const artist3Card1Rot = useTransform(smoothProgress, [0.44, 0.62, 0.76, 0.94], [-14, -8, -20, -36])
  const artist3Card1Opacity = useTransform(smoothProgress, [0.44, 0.58, 0.80, 0.94], [0.3, 1, 0.8, 0])

  const artist3Card2X = useTransform(smoothProgress, [0.44, 0.62, 0.76, 0.94], ["0px", "0px", "-240px", "-640px"])
  const artist3Card2Y = useTransform(smoothProgress, [0.44, 0.62, 0.76, 0.94], ["60px", "0px", "-90px", "-260px"])
  const artist3Card2Rot = useTransform(smoothProgress, [0.44, 0.62, 0.76, 0.94], [6, 10, 24, 42])
  const artist3Card2Opacity = useTransform(smoothProgress, [0.44, 0.58, 0.80, 0.94], [0.3, 1, 0.8, 0])

  const artist3Card3X = useTransform(smoothProgress, [0.44, 0.62, 0.76, 0.94], ["0px", "0px", "180px", "520px"])
  const artist3Card3Y = useTransform(smoothProgress, [0.44, 0.62, 0.76, 0.94], ["-50px", "0px", "110px", "310px"])
  const artist3Card3Rot = useTransform(smoothProgress, [0.44, 0.62, 0.76, 0.94], [-10, 2, -18, -32])
  const artist3Card3Opacity = useTransform(smoothProgress, [0.44, 0.58, 0.80, 0.94], [0.3, 1, 0.8, 0])

  const artist3Card4X = useTransform(smoothProgress, [0.44, 0.62, 0.76, 0.94], ["0px", "0px", "280px", "740px"])
  const artist3Card4Y = useTransform(smoothProgress, [0.44, 0.62, 0.76, 0.94], ["70px", "0px", "-80px", "-240px"])
  const artist3Card4Rot = useTransform(smoothProgress, [0.44, 0.62, 0.76, 0.94], [14, 4, 28, 46])
  const artist3Card4Opacity = useTransform(smoothProgress, [0.44, 0.58, 0.80, 0.94], [0.3, 1, 0.8, 0])

  // Section 4: Red Booking Form slide from right
  const redFormSlideX = useTransform(smoothProgress, [0.76, 0.98], ["140px", "0px"])
  const progressLineScale = useTransform(smoothProgress, [0, 1], [0.12, 1])

  useEffect(() => {
    if (typeof fetch !== "function") return
    let mounted = true
    fetch("/api/public/events")
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return
        if (Array.isArray(data?.events) && data.events.length > 0) {
          const enriched: PublicEvent[] = data.events.map((ev: PublicEvent, idx: number) => ({
            ...ev,
            cover_image: ev.cover_image || EVENT_COVERS[idx % EVENT_COVERS.length],
          }))
          setEvents(enriched)
          setFormEventId(enriched[0].id)
        }
        if (Array.isArray(data?.artists) && data.artists.length > 0) {
          const mappedArtists: FeaturedArtist[] = data.artists.map((a: any, idx: number) => {
            const fallback = INITIAL_ARTISTS[idx % INITIAL_ARTISTS.length]
            return {
              id: a.id || fallback.id,
              name: a.name || fallback.name,
              role_tag: fallback.role_tag,
              city:
                a.next_event_location?.split("•")[1]?.trim() ||
                fallback.city,
              instagram_handle: a.instagram_handle || fallback.instagram_handle,
              avatar_url: a.avatar_url || fallback.avatar_url,
              bio: a.bio || fallback.bio,
              next_event_title: a.next_event_title || fallback.next_event_title,
              next_event_location: a.next_event_location || fallback.next_event_location,
              next_event_slug: a.next_event_slug || fallback.next_event_slug,
              next_event_date: a.next_event_date || fallback.next_event_date,
              date_badge: fallback.date_badge,
              card_number: `${idx + 1}/${Math.max(data.artists.length, 4)}`,
            }
          })
          // Keep 4 rich cards for the visual fan constellation
          const combined =
            mappedArtists.length >= 4
              ? mappedArtists.slice(0, 4)
              : [...mappedArtists, ...INITIAL_ARTISTS.slice(mappedArtists.length, 4)]
          setArtists(combined)
        }
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  // Sync window vertical scroll + horizontal trackpad deltaX to horizontal progress
  useEffect(() => {
    const updateScrollProgress = () => {
      if (typeof window === "undefined") return
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      if (maxScroll <= 0) {
        rawProgress.set(0)
        return
      }
      const next = Math.min(1, Math.max(0, window.scrollY / maxScroll))
      rawProgress.set(next)
      if (next < 0.20) setActiveSection(0)
      else if (next < 0.52) setActiveSection(1)
      else if (next < 0.84) setActiveSection(2)
      else setActiveSection(3)
    }

    const handleWheel = (e: WheelEvent) => {
      // Allow horizontal two-finger trackpad swipes to also scroll the page smoothly
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 4) {
        window.scrollBy({ top: e.deltaX, behavior: "auto" })
      }
    }

    let touchStartX = 0
    let touchStartY = 0

    const handleTouchStart = (e: TouchEvent) => {
      if (!e.touches || e.touches.length === 0) return
      touchStartX = e.touches[0].clientX
      touchStartY = e.touches[0].clientY
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!e.touches || e.touches.length === 0) return
      const currentX = e.touches[0].clientX
      const currentY = e.touches[0].clientY
      const deltaX = touchStartX - currentX
      const deltaY = touchStartY - currentY

      // When horizontal swipe on mobile is stronger than vertical, translate it to scroll progression
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
        window.scrollBy({ top: deltaX * 0.9, behavior: "auto" })
        touchStartX = currentX
        touchStartY = currentY
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault()
        window.scrollBy({ top: window.innerHeight * 0.45, behavior: "smooth" })
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault()
        window.scrollBy({ top: -window.innerHeight * 0.45, behavior: "smooth" })
      }
    }

    updateScrollProgress()
    window.addEventListener("scroll", updateScrollProgress, { passive: true })
    window.addEventListener("resize", updateScrollProgress)
    window.addEventListener("wheel", handleWheel, { passive: true })
    window.addEventListener("touchstart", handleTouchStart, { passive: true })
    window.addEventListener("touchmove", handleTouchMove, { passive: true })
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("scroll", updateScrollProgress)
      window.removeEventListener("resize", updateScrollProgress)
      window.removeEventListener("wheel", handleWheel)
      window.removeEventListener("touchstart", handleTouchStart)
      window.removeEventListener("touchmove", handleTouchMove)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [rawProgress])

  const sectionTargets = [0, 0.34, 0.66, 1.0]

  const scrollToSection = (index: 0 | 1 | 2 | 3) => {
    if (typeof window === "undefined") return
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    const targetProgress = sectionTargets[index] ?? 0
    rawProgress.set(targetProgress)
    setActiveSection(index)
    if (maxScroll > 0) {
      window.scrollTo({
        top: maxScroll * targetProgress,
        behavior: "smooth",
      })
    }
  }

  const handleAdvanceSection = () => {
    const next = (activeSection + 1) % 4
    scrollToSection(next as 0 | 1 | 2 | 3)
  }

  const locations = [
    "ALL",
    ...Array.from(
      new Set(
        events
          .map((e) => e.location_name?.split("•")[1]?.trim() || e.location_name)
          .filter(Boolean)
      )
    ),
  ]

  const filteredEvents =
    selectedCity === "ALL"
      ? events
      : events.filter((e) =>
          (e.location_name || "").toLowerCase().includes(selectedCity.toLowerCase())
        )

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!formName.trim() || !formEmail.trim()) {
      setFormError("Please enter your name and email address.")
      return
    }
    setFormSubmitting(true)
    const chosenEvent = events.find((ev) => ev.id === formEventId)
    try {
      const res = await fetch("/api/public/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          email: formEmail.trim(),
          phone: formPhone.trim(),
          inquiryType,
          eventId: formEventId,
          message: formMessage.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Could not submit your request.")
      }
      setFormSubmitted({
        name: formName.trim(),
        inquiryType,
        eventTitle: chosenEvent?.title,
        eventId: chosenEvent?.id,
      })
      setFormMessage("")
    } catch (err: any) {
      setFormError(err.message || "Something went wrong.")
    } finally {
      setFormSubmitting(false)
    }
  }

  const artistTransforms = [
    { x: artistCard1X, y: artistCard1Y, rotate: artistCard1Rot, opacity: artistCard1Opacity },
    { x: artistCard2X, y: artistCard2Y, rotate: artistCard2Rot, opacity: artistCard2Opacity },
    { x: artistCard3X, y: artistCard3Y, rotate: artistCard3Rot, opacity: artistCard3Opacity },
    { x: artistCard4X, y: artistCard4Y, rotate: artistCard4Rot, opacity: artistCard4Opacity },
  ]

  const eventTransforms = [
    { x: eventCard1X, y: eventCard1Y, rotate: eventCard1Rot },
    { x: eventCard2X, y: eventCard2Y, rotate: eventCard2Rot },
    { x: eventCard3X, y: eventCard3Y, rotate: eventCard3Rot },
    { x: eventCard4X, y: eventCard4Y, rotate: eventCard4Rot },
    { x: eventCard5X, y: eventCard5Y, rotate: eventCard5Rot },
  ]

  // Positions of the artist polaroid cards over the giant "muse-ing" word
  // Mobile-responsive: reduced card size, fanned outward so words remain clearly visible without blocking text
  const artistCardPositions = [
    "left-[28%] sm:left-[51%] md:left-[52%] top-[54%] sm:top-[41%] z-30",
    "left-[54%] sm:left-[58%] md:left-[60%] top-[24%] sm:top-[11%] z-10",
    "left-[8%] sm:left-[66%] md:left-[68%] top-[64%] sm:top-[33%] z-40",
    "left-[58%] sm:left-[74%] md:left-[76%] top-[39%] sm:top-[12%] z-20",
  ]

  // Positions & tilts for the Events constellation around the giant "events" word
  const eventCardConfigs = [
    {
      pos: "left-[4%] sm:left-[10%] top-[22%] sm:top-[14%]",
      rotate: -7,
      z: "z-20",
    },
    {
      pos: "left-[44%] sm:left-[39%] top-[18%] sm:top-[11%]",
      rotate: 8,
      z: "z-30",
    },
    {
      pos: "left-[24%] sm:left-[68%] top-[38%] sm:top-[14%]",
      rotate: -6,
      z: "z-20",
    },
    {
      pos: "left-[6%] sm:left-[24%] top-[56%] sm:top-[47%]",
      rotate: -12,
      z: "z-30",
    },
    {
      pos: "left-[45%] sm:left-[55%] top-[54%] sm:top-[46%]",
      rotate: 9,
      z: "z-30",
    },
  ]

  // Section 3 (Artists) transforms & card positions (shown when scrolling down from Events)
  const artist3Transforms = [
    { x: artist3Card1X, y: artist3Card1Y, rotate: artist3Card1Rot, opacity: artist3Card1Opacity },
    { x: artist3Card2X, y: artist3Card2Y, rotate: artist3Card2Rot, opacity: artist3Card2Opacity },
    { x: artist3Card3X, y: artist3Card3Y, rotate: artist3Card3Rot, opacity: artist3Card3Opacity },
    { x: artist3Card4X, y: artist3Card4Y, rotate: artist3Card4Rot, opacity: artist3Card4Opacity },
  ]

  const artist3CardConfigs = [
    { pos: "left-[28%] sm:left-[49%] md:left-[50%] top-[54%] sm:top-[38%]", z: "z-30" },
    { pos: "left-[54%] sm:left-[57%] md:left-[58%] top-[24%] sm:top-[10%]", z: "z-10" },
    { pos: "left-[8%] sm:left-[66%] md:left-[67%] top-[64%] sm:top-[32%]", z: "z-40" },
    { pos: "left-[58%] sm:left-[75%] md:left-[76%] top-[39%] sm:top-[11%]", z: "z-20" },
  ]

  // Build up to 5 event cards for the Section 2 visual constellation
  const displayEvents: PublicEvent[] =
    filteredEvents.length > 0 ? filteredEvents : events

  return (
    <div
      ref={containerRef}
      className="relative h-[520vh] bg-[#F4EFE6] text-[#181615] selection:bg-[#D92323] selection:text-white"
    >
      {/* Cinematic Editorial Entrance Loader */}
      <MuseLoadingScreen isLoading={initialLoading} minDurationMs={2400} />

      {/* Fixed Editorial Viewport Stage */}
      <div className="sticky top-0 h-screen w-screen overflow-hidden bg-[#F4EFE6]">
        {/* Subtle Warm Editorial Paper Grain & Vignette */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 opacity-50"
          style={{
            background:
              "radial-gradient(circle at 50% 45%, rgba(255,252,245,0.6) 0%, rgba(235,227,213,0.45) 70%, rgba(219,208,190,0.65) 100%)",
          }}
        />

        {/* FIXED TOP-LEFT BRAND (Prominent lowercase "m-" Logo in Instrument Serif) */}
        <header className="fixed top-0 left-0 right-0 z-40 flex items-start justify-between pl-8 xs:pl-10 sm:pl-12 pr-6 xs:pr-8 sm:pr-12 pt-6 sm:pt-8 pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto">
            <button
              type="button"
              onClick={() => scrollToSection(0)}
              className="group flex items-center transition-transform duration-300 hover:scale-110 cursor-pointer select-none"
              title="Muse-ing Home"
            >
              <span className="instrument text-5xl xs:text-6xl sm:text-5xl md:text-6xl font-normal leading-none tracking-tight">
                <span className="text-[#181615]">m</span>
                <span className="text-[#D92323]">-</span>
              </span>
            </button>
          </div>

          {/* DESKTOP TOP-RIGHT STACKED NAVIGATION */}
          <nav
            aria-label="Section navigation"
            className="hidden sm:flex flex-col items-end space-y-1 sm:space-y-1.5 pointer-events-auto"
          >
            <button
              type="button"
              onClick={() => scrollToSection(0)}
              className={`group flex items-center gap-2 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.16em] transition-colors cursor-pointer ${
                activeSection === 0
                  ? "text-[#D92323]"
                  : "text-[#181615]/75 hover:text-[#181615]"
              }`}
            >
              {activeSection === 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#D92323]" />
              )}
              MUSE-ING
            </button>
            <button
              type="button"
              onClick={() => scrollToSection(1)}
              className={`group flex items-center gap-2 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.16em] transition-colors cursor-pointer ${
                activeSection === 1
                  ? "text-[#D92323]"
                  : "text-[#181615]/75 hover:text-[#181615]"
              }`}
            >
              {activeSection === 1 && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#D92323]" />
              )}
              EVENTS
            </button>
            <button
              type="button"
              onClick={() => scrollToSection(2)}
              className={`group flex items-center gap-2 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.16em] transition-colors cursor-pointer ${
                activeSection === 2
                  ? "text-[#D92323]"
                  : "text-[#181615]/75 hover:text-[#181615]"
              }`}
            >
              {activeSection === 2 && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#D92323]" />
              )}
              ARTISTS
            </button>
            <button
              type="button"
              onClick={() => scrollToSection(3)}
              className={`group flex items-center gap-2 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.16em] transition-colors cursor-pointer ${
                activeSection === 3
                  ? "text-[#D92323]"
                  : "text-[#181615]/75 hover:text-[#181615]"
              }`}
            >
              {activeSection === 3 && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#D92323]" />
              )}
              BOOK / HOST
            </button>
            <Link
              href="/login"
              className="pt-1 text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.14em] text-[#181615]/55 hover:text-[#D92323] transition-colors flex items-center gap-1"
            >
              <Mic2 className="w-3 h-3" />
              ARTIST LOGIN
            </Link>
          </nav>

          {/* MOBILE TOP-RIGHT COMPACT PILL & DROPDOWN MENU */}
          <div className="sm:hidden relative pointer-events-auto">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              className="px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-[#181615]/20 text-[#181615] text-[10px] font-semibold uppercase tracking-[0.14em] flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#D92323]" />
              <span>
                {activeSection === 0
                  ? "MUSE-ING"
                  : activeSection === 1
                  ? "EVENTS"
                  : activeSection === 2
                  ? "ARTISTS"
                  : "BOOK"}
              </span>
              {mobileMenuOpen ? (
                <X className="w-3.5 h-3.5 text-[#D92323]" />
              ) : (
                <Menu className="w-3.5 h-3.5 text-[#181615]" />
              )}
            </button>

            <AnimatePresence>
              {mobileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.95 }}
                  transition={{ duration: 0.18 }}
                  className="absolute right-0 top-full mt-2 w-44 rounded-2xl bg-[#FAF7F2] border border-[#181615]/15 shadow-2xl p-2 space-y-1 z-50 text-[#181615]"
                >
                  {[
                    { label: "MUSE-ING", sec: 0 },
                    { label: "EVENTS", sec: 1 },
                    { label: "ARTISTS", sec: 2 },
                    { label: "BOOK / HOST", sec: 3 },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        scrollToSection(item.sec as 0 | 1 | 2 | 3)
                        setMobileMenuOpen(false)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-[0.14em] flex items-center justify-between transition-colors cursor-pointer ${
                        activeSection === item.sec
                          ? "bg-[#D92323] text-white"
                          : "hover:bg-[#181615]/5 text-[#181615]/85"
                      }`}
                    >
                      <span>{item.label}</span>
                      {activeSection === item.sec && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </button>
                  ))}
                  <div className="h-[1px] bg-[#181615]/10 my-1" />
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-left px-3 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-[0.14em] text-[#181615]/70 hover:text-[#D92323] flex items-center gap-1.5 transition-colors"
                  >
                    <Mic2 className="w-3 h-3" />
                    <span>Artist Login</span>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* FIXED BOTTOM-RIGHT "SCROLL TO CONTINUE" INDICATOR (Matches Reference Bottom-Right) */}
        <div className="fixed bottom-4 sm:bottom-8 right-4 sm:right-12 z-40 flex items-center gap-2 sm:gap-3">
          <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-widest text-[#181615]/50">
            0{activeSection + 1} / 04
          </span>
          <button
            type="button"
            onClick={handleAdvanceSection}
            className="group flex items-center gap-2.5 text-left cursor-pointer"
            title="Advance to next section"
          >
            <div className="w-8 sm:w-10 h-[1.5px] bg-[#181615]/20 overflow-hidden relative">
              <motion.div
                style={{ scaleX: progressLineScale, transformOrigin: "left" }}
                className="absolute inset-0 bg-[#181615]"
              />
            </div>
            <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.16em] leading-[1.15] text-[#181615] group-hover:text-[#D92323] transition-colors">
              {activeSection === 0 ? (
                <>
                  SCROLL TO
                  <br />
                  CONTINUE →
                </>
              ) : activeSection === 1 ? (
                <>
                  SCROLL DOWN
                  <br />
                  TO ARTISTS ↓
                </>
              ) : activeSection === 2 ? (
                <>
                  SCROLL TO
                  <br />
                  BOOKING →
                </>
              ) : (
                <>
                  BACK TO
                  <br />← START
                </>
              )}
            </span>
          </button>
        </div>

        {/* MULTI-AXIS SCROLLING TRACK (Translates horizontally & vertically) */}
        <motion.main
          style={{ x: trackX, y: trackY }}
          className="relative z-10 h-[200vh] w-[300vw] will-change-transform"
        >
          {/* ===================================================================
              SECTION 01: START — FEATURED PERFORMING ARTISTS
          =================================================================== */}
          <motion.section
            style={{ opacity: section1Opacity }}
            aria-label="Featured Performing Artists"
            className="absolute left-0 top-0 h-screen w-screen overflow-visible select-none"
          >
            {/* Editorial Micro-Intro */}
            <div className="absolute top-[11%] xs:top-[12%] sm:top-[27%] md:top-[28%] left-8 xs:left-10 sm:left-[7vw] md:left-[7.5vw] z-30 select-text">
              <p className="text-sm sm:text-lg md:text-xl font-normal text-[#181615]/85 tracking-normal font-sans">
                Hey, We&apos;re Muse-ing
              </p>
              <div className="mt-1 sm:mt-1.5 inline-block">
                <h1 className="text-lg sm:text-2xl md:text-[28px] font-medium text-[#181615] tracking-tight whitespace-nowrap">
                  A Live Music Experience •
                </h1>
                <div className="w-full h-[1.5px] sm:h-[2px] bg-[#181615] mt-1.5 sm:mt-2" />
              </div>
            </div>

            {/* Bottom-Left Editorial Paragraph */}
            <div className="absolute bottom-5 sm:bottom-12 md:bottom-14 left-8 xs:left-10 sm:left-[7vw] md:left-[7.5vw] z-30 max-w-[200px] xs:max-w-[240px] sm:max-w-[320px] select-text">
              <p className="text-[10px] sm:text-xs leading-[1.5] sm:leading-[1.65] text-[#181615]/75 font-normal">
                Connecting independent artists with live venue crowds through real-time setlists, requests, and dedications.
              </p>
            </div>

            {/* GIANT SERIF WORD ("muse-ing" entirely in crimson red) */}
            <motion.div
              style={{ x: artistsWordX, y: artistsWordY, opacity: artistsWordOpacity }}
              aria-hidden="true"
              className="pointer-events-none absolute left-[-1vw] sm:left-[1vw] top-[46%] -translate-y-1/2 z-0"
            >
              <span className="instrument block text-[#D92323] font-normal lowercase leading-[0.76] tracking-[-0.04em] text-[36vw] xs:text-[37vw] sm:text-[38vw] md:text-[34vw] whitespace-nowrap">
                muse-ing
              </span>
            </motion.div>

            {/* FLOATING TILTED POLAROID ARTIST CARDS (Layered Over Giant Red "artists" Text) */}
            <div className="absolute inset-0 z-20 pointer-events-none">
              {artists.slice(0, 4).map((artist, idx) => {
                const tf = artistTransforms[idx % artistTransforms.length]
                const posClass = artistCardPositions[idx % artistCardPositions.length]
                const liveHref = `/live?location=${encodeURIComponent(
                  artist.next_event_slug || "toit-indiranagar"
                )}&date=${encodeURIComponent(artist.next_event_date || "")}`

                return (
                  <motion.article
                    key={artist.id}
                    style={{
                      x: tf.x,
                      y: tf.y,
                      rotate: tf.rotate,
                      opacity: tf.opacity,
                    }}
                    whileHover={{
                      scale: 1.05,
                      rotate: 0,
                      zIndex: 50,
                      transition: { duration: 0.35, ease: "easeOut" },
                    }}
                    onClick={() => setActiveArtistModal(artist)}
                    className={`pointer-events-auto absolute ${posClass} w-[125px] xs:w-[138px] sm:w-[230px] md:w-[260px] aspect-[4/5] cursor-pointer group select-none`}
                  >
                    {/* Clean, Slim Luxury Off-White Gallery Picture Frame with Wide Open Center */}
                    <div className="relative w-full h-full rounded-[1px] shadow-[0_12px_32px_-4px_rgba(24,22,21,0.28),0_4px_12px_-2px_rgba(24,22,21,0.18),0_0_1px_rgba(24,22,21,0.3)] hover:shadow-[0_22px_45px_-6px_rgba(24,22,21,0.38),0_8px_20px_-4px_rgba(24,22,21,0.24)] transition-all duration-300">
                      {/* Artist Photo fills ~88% of the frame with maximum artwork visibility */}
                      <div className="absolute top-[6.1%] left-[8.4%] w-[82.9%] h-[87.6%] overflow-hidden bg-[#121110] z-0 shadow-inner">
                        <img
                          src={artist.avatar_url}
                          alt={artist.name}
                          className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-106"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent pointer-events-none" />

                        {/* Gallery Artwork Info Overlay */}
                        <div className="absolute bottom-2 sm:bottom-2.5 inset-x-2 sm:inset-x-2.5 flex items-end justify-between gap-1 text-white">
                          <div className="min-w-0 pr-0.5">
                            <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.16em] text-amber-200/90 font-medium truncate">
                              {artist.city}
                            </p>
                            <h2 className="text-[11px] sm:text-xs md:text-sm font-medium tracking-tight leading-tight truncate">
                              {artist.name}
                            </h2>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveArtistModal(artist)
                            }}
                            className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded bg-black/60 hover:bg-[#D92323] text-white text-[8px] sm:text-[9px] md:text-[10px] font-medium tracking-wide backdrop-blur-md border border-white/20 transition-all shrink-0 cursor-pointer shadow-sm group-hover:bg-[#D92323] group-hover:border-transparent"
                          >
                            Know more →
                          </button>
                        </div>
                      </div>

                      {/* Transparent Slim Off-White and Gold Museum Frame Overlay */}
                      <img
                        src="/art-frame-offwhite-4-5.png"
                        alt="Art Frame"
                        className="absolute inset-0 w-full h-full object-fill pointer-events-none z-10 drop-shadow-[0_2px_6px_rgba(0,0,0,0.18)]"
                      />
                    </div>
                  </motion.article>
                )
              })}
            </div>
          </motion.section>

          {/* ===================================================================
              SECTION 02: MIDDLE — EVENTS BEING HOSTED CURRENTLY
          =================================================================== */}
          <motion.section
            id="events-by-location"
            style={{ opacity: section2Opacity }}
            aria-label="Events Being Hosted Currently"
            className="absolute left-[100vw] top-0 h-screen w-screen overflow-visible select-none"
          >
            {/* Top-Left Section Eyebrow & City Filter Pills */}
            <div className="relative z-30 pt-16 sm:pt-24 pl-8 xs:pl-10 sm:pl-16 md:pl-20 pr-4 sm:pr-6 flex flex-wrap items-center justify-between gap-2 sm:gap-3 max-w-5xl select-text">
              <div>
                <p className="text-[9px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-[#D92323]">
                  02 • CURRENTLY HOSTED GIGS
                </p>
                <h2 className="text-base sm:text-2xl font-medium tracking-tight text-[#181615]">
                  Live Events Across Venues
                </h2>
              </div>

              {/* Location Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full py-0.5">
                {locations.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setSelectedCity(loc)}
                    className={`px-2.5 sm:px-3 py-1 rounded-full text-[9px] sm:text-xs font-semibold uppercase tracking-wider transition cursor-pointer shrink-0 ${
                      selectedCity === loc
                        ? "bg-[#D92323] text-white shadow-sm"
                        : "bg-white/75 text-[#181615]/75 border border-[#181615]/15 hover:bg-white"
                    }`}
                  >
                    {loc === "ALL" ? "All Cities" : loc}
                  </button>
                ))}
              </div>
            </div>

            {/* GIANT CRIMSON SERIF WORD ("events" — Matches "work" in Reference Frames 00:07-00:12) */}
            <motion.div
              style={{ x: eventsWordX, y: eventsWordY, opacity: eventsWordOpacity }}
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 z-0"
            >
              <span className="instrument block text-[#D92323] font-normal lowercase leading-[0.76] tracking-[-0.04em] text-[48vw] sm:text-[40vw] md:text-[36vw] whitespace-nowrap">
                events
              </span>
            </motion.div>

            {/* FLOATING TILTED POLAROID EVENT CARDS CONSTELLATION AROUND "events" */}
            <motion.div
              style={{ x: eventClusterShiftX }}
              className="absolute inset-0 z-20 pointer-events-none"
            >
              {displayEvents.slice(0, 5).map((ev, idx) => {
                const cfg = eventCardConfigs[idx % eventCardConfigs.length]
                const tf = eventTransforms[idx % eventTransforms.length]
                const qrHref = `/live?location=${encodeURIComponent(
                  ev.location_slug || "toit-indiranagar"
                )}&date=${encodeURIComponent(ev.event_date_only || "")}`
                const imgSrc =
                  ev.cover_image ||
                  ev.artist_avatar ||
                  EVENT_COVERS[idx % EVENT_COVERS.length]

                return (
                  <motion.div
                    key={ev.id}
                    style={{
                      x: tf.x,
                      y: tf.y,
                      rotate: tf.rotate,
                    }}
                    whileHover={{
                      scale: 1.05,
                      rotate: 0,
                      zIndex: 50,
                      transition: { duration: 0.35, ease: "easeOut" },
                    }}
                    className={`pointer-events-auto absolute ${cfg.pos} ${cfg.z} w-[140px] xs:w-[155px] sm:w-[275px] md:w-[300px] rounded-2xl bg-[#F4EFE6] p-2 xs:p-2.5 sm:p-3.5 shadow-[0_24px_60px_-8px_rgba(24,22,21,0.32),0_12px_28px_-6px_rgba(24,22,21,0.22),0_2px_8px_rgba(24,22,21,0.12)] border border-transparent select-text group transition-all duration-300 hover:shadow-[0_36px_85px_-10px_rgba(24,22,21,0.42),0_18px_36px_-6px_rgba(24,22,21,0.28)]`}
                  >
                    {/* Inner Framed Canvas Art with Clean Curved Borders */}
                    <div className="relative h-28 xs:h-32 sm:h-44 w-full overflow-hidden rounded-xl bg-[#121110] shadow-inner">
                      <img
                        src={imgSrc}
                        alt={ev.title}
                        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-106"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

                      <div className="absolute bottom-1.5 sm:bottom-2 inset-x-1.5 sm:inset-x-2 flex items-end justify-between text-white">
                        <div className="min-w-0 pr-1">
                          <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.18em] text-white/75 font-medium truncate">
                            {ev.artist_name || "Featured Artist"}
                          </p>
                          <h3 className="text-[11px] sm:text-xs md:text-sm font-semibold tracking-tight leading-tight truncate mt-0.5">
                            {ev.title}
                          </h3>
                        </div>
                        {ev.ticket_price > 0 && (
                          <span className="ml-1 px-1.5 py-0.5 rounded bg-[#F4EFE6] text-[#181615] text-[9px] sm:text-[10px] font-bold shrink-0 shadow-sm border border-transparent">
                            ₹{ev.ticket_price}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Clean Polaroid Caption Bar */}
                    <div className="pt-2 sm:pt-2.5 px-0.5 sm:px-1 text-[#181615] flex items-center justify-between gap-1.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 text-[9px] sm:text-[11px] font-medium text-[#5C5650] truncate">
                          <MapPin className="w-3 h-3 text-[#D92323] shrink-0" />
                          <span className="truncate">{ev.location_name}</span>
                        </div>
                      </div>
                      <Link
                        href={qrHref}
                        className="group/btn flex items-center gap-1.5 text-left cursor-pointer shrink-0"
                        title="Know more about event"
                      >
                        <span className="text-[8px] sm:text-[10px] font-semibold uppercase tracking-[0.14em] text-[#181615] group-hover/btn:text-[#D92323] transition-colors whitespace-nowrap">
                          MORE →
                        </span>
                      </Link>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>

            {/* Bottom-Left Bold Uppercase Statement */}
            <div className="absolute bottom-5 sm:bottom-10 left-5 sm:left-16 md:left-20 z-30 max-w-[210px] xs:max-w-[260px] sm:max-w-xl select-text">
              <p className="text-xs sm:text-xl md:text-2xl font-semibold uppercase tracking-tight leading-[1.2] text-[#181615]">
                SHAPE THE LIVE SETLIST IN REAL TIME, EXCITING CROWD MOMENTS THAT WILL BE PRESERVED.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setInquiryType("reserve")
                    scrollToSection(3)
                  }}
                  className="font-semibold uppercase tracking-wider text-[#D92323] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Book Table or Host →
                </button>
              </div>
            </div>
          </motion.section>

          {/* ===================================================================
              SECTION 03: ARTISTS — REACHED BY SCROLLING DOWN FROM EVENTS
          =================================================================== */}
          <motion.section
            id="featured-artists-section"
            style={{ opacity: section3Opacity }}
            aria-label="Curated Performing Artists"
            className="absolute left-[100vw] top-[100vh] h-screen w-screen overflow-visible select-none"
          >
            {/* Editorial Micro-Intro */}
            <div className="absolute top-[11%] xs:top-[12%] sm:top-[27%] md:top-[28%] left-5 sm:left-[7vw] md:left-[7.5vw] z-30 select-text">
              <p className="text-sm sm:text-lg md:text-xl font-normal text-[#181615]/85 tracking-normal font-sans">
                Curated Live Roster
              </p>
              <div className="mt-1 sm:mt-1.5 inline-block">
                <h1 className="text-lg sm:text-2xl md:text-[28px] font-medium text-[#181615] tracking-tight whitespace-nowrap">
                  Featured Performing Artists •
                </h1>
                <div className="w-full h-[1.5px] sm:h-[2px] bg-[#181615] mt-1.5 sm:mt-2" />
              </div>
            </div>

            {/* Bottom-Left Editorial Statement */}
            <div className="absolute bottom-5 sm:bottom-10 left-5 sm:left-16 md:left-20 z-30 max-w-[210px] xs:max-w-[260px] sm:max-w-xl select-text">
              <p className="text-xs sm:text-xl md:text-2xl font-semibold uppercase tracking-tight leading-[1.2] text-[#181615]">
                DISCOVER INDEPENDENT TALENT, UPVOTE SONGS LIVE FROM YOUR TABLE.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
                <Link
                  href="/artist"
                  className="font-semibold uppercase tracking-wider text-[#D92323] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Explore Shows →
                </Link>
                <span className="text-[#181615]/30">•</span>
                <button
                  type="button"
                  onClick={() => {
                    setInquiryType("artist")
                    scrollToSection(3)
                  }}
                  className="font-medium text-[#181615]/75 hover:text-[#181615] underline underline-offset-4 cursor-pointer"
                >
                  Join as Performer
                </button>
              </div>
            </div>

            {/* GIANT SERIF WORD ("artists" entirely in crimson red) */}
            <motion.div
              style={{ x: artists3WordX, y: artists3WordY, opacity: artists3WordOpacity }}
              aria-hidden="true"
              className="pointer-events-none absolute left-[4vw] sm:left-[5vw] md:left-[5.5vw] top-[46%] -translate-y-1/2 z-0"
            >
              <span className="instrument block text-[#D92323] font-normal lowercase leading-[0.76] tracking-[-0.04em] text-[48vw] sm:text-[40vw] md:text-[36vw] whitespace-nowrap">
                artists
              </span>
            </motion.div>

            {/* FLOATING TILTED ARTIST CARDS WITH VERTICAL PARALLAX */}
            <div className="absolute inset-0 z-20 pointer-events-none">
              {artists.slice(0, 4).map((artist, idx) => {
                const tf = artist3Transforms[idx % artist3Transforms.length]
                const cfg = artist3CardConfigs[idx % artist3CardConfigs.length]

                return (
                  <motion.article
                    key={`sec3-${artist.id}`}
                    style={{
                      x: tf.x,
                      y: tf.y,
                      rotate: tf.rotate,
                      opacity: tf.opacity,
                    }}
                    whileHover={{
                      scale: 1.05,
                      rotate: 0,
                      zIndex: 50,
                      transition: { duration: 0.35, ease: "easeOut" },
                    }}
                    onClick={() => setActiveArtistModal(artist)}
                    className={`pointer-events-auto absolute ${cfg.pos} ${cfg.z} w-[125px] xs:w-[138px] sm:w-[230px] md:w-[260px] aspect-[4/5] cursor-pointer group select-none`}
                  >
                    <div className="relative w-full h-full rounded-[1px] shadow-[0_12px_32px_-4px_rgba(24,22,21,0.28),0_4px_12px_-2px_rgba(24,22,21,0.18),0_0_1px_rgba(24,22,21,0.3)] hover:shadow-[0_22px_45px_-6px_rgba(24,22,21,0.38),0_8px_20px_-4px_rgba(24,22,21,0.24)] transition-all duration-300">
                      <div className="absolute top-[6.1%] left-[8.4%] w-[82.9%] h-[87.6%] overflow-hidden bg-[#121110] z-0 shadow-inner">
                        <img
                          src={artist.avatar_url}
                          alt={artist.name}
                          className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-106"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent pointer-events-none" />

                        <div className="absolute bottom-2 sm:bottom-2.5 inset-x-2 sm:inset-x-2.5 flex items-end justify-between gap-1 text-white">
                          <div className="min-w-0 pr-0.5">
                            <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.16em] text-amber-200/90 font-medium truncate">
                              {artist.city} • {artist.role_tag}
                            </p>
                            <h2 className="text-[11px] sm:text-xs md:text-sm font-medium tracking-tight leading-tight truncate">
                              {artist.name}
                            </h2>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveArtistModal(artist)
                            }}
                            className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded bg-black/60 hover:bg-[#D92323] text-white text-[8px] sm:text-[9px] md:text-[10px] font-medium tracking-wide backdrop-blur-md border border-white/20 transition-all shrink-0 cursor-pointer shadow-sm group-hover:bg-[#D92323] group-hover:border-transparent"
                          >
                            Know more →
                          </button>
                        </div>
                      </div>

                      <img
                        src="/art-frame-offwhite-4-5.png"
                        alt="Art Frame"
                        className="absolute inset-0 w-full h-full object-fill pointer-events-none z-10 drop-shadow-[0_2px_6px_rgba(0,0,0,0.18)]"
                      />
                    </div>
                  </motion.article>
                )
              })}
            </div>
          </motion.section>

          {/* ===================================================================
              SECTION 04: END — THE CRIMSON EDITORIAL FORM & FOOTER (SCROLLED FROM RIGHT)
          =================================================================== */}
          <section
            id="contact-form-section"
            aria-label="Book or Host Form"
            className="absolute left-[200vw] top-[100vh] h-screen w-screen flex flex-col justify-between px-4 sm:px-16 md:px-24 pt-16 sm:pt-24 pb-4 sm:pb-8 select-text overflow-y-auto sm:overflow-hidden"
          >
            {/* Center Crimson Red Form Container */}
            <div className="flex-1 flex items-center justify-center my-auto py-2">
              <motion.div
                style={{ x: redFormSlideX }}
                className="w-full max-w-[680px] bg-[#D92323] text-white px-5 sm:px-16 py-6 sm:py-12 rounded-2xl sm:rounded-3xl shadow-[0_30px_70px_-15px_rgba(217,35,35,0.45)] relative"
              >
                <div className="text-center max-w-md mx-auto mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-2xl font-semibold uppercase tracking-[0.14em] text-white mb-1.5 sm:mb-2">
                    BOOK OR HOST WITH US
                  </h2>
                  <p className="text-[10px] sm:text-xs text-white/85 leading-relaxed">
                    Reserve tickets for an upcoming live gig, host an interactive crowd-setlist night at your venue, or join the roster as a performing artist.
                  </p>

                  {/* Mode Selector Pills */}
                  <div className="inline-flex items-center gap-1 sm:gap-1.5 p-1 rounded-full bg-black/20 border border-white/15 mt-3 sm:mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setInquiryType("reserve")
                        setFormSubmitted(null)
                      }}
                      className={`px-2.5 sm:px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider transition cursor-pointer ${
                        inquiryType === "reserve"
                          ? "bg-white text-[#D92323]"
                          : "text-white/85 hover:text-white"
                      }`}
                    >
                      Reserve Event
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInquiryType("host")
                        setFormSubmitted(null)
                      }}
                      className={`px-2.5 sm:px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider transition cursor-pointer ${
                        inquiryType === "host"
                          ? "bg-white text-[#D92323]"
                          : "text-white/85 hover:text-white"
                      }`}
                    >
                      Host at Venue
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInquiryType("artist")
                        setFormSubmitted(null)
                      }}
                      className={`px-2.5 sm:px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider transition cursor-pointer ${
                        inquiryType === "artist"
                          ? "bg-white text-[#D92323]"
                          : "text-white/85 hover:text-white"
                      }`}
                    >
                      Join as Artist
                    </button>
                  </div>
                </div>

                {formSubmitted ? (
                  <div className="py-6 text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold uppercase tracking-wider">
                      Thank You, {formSubmitted.name}!
                    </h3>
                    <p className="text-xs text-white/90 max-w-sm mx-auto leading-relaxed">
                      We&apos;ve received your{" "}
                      {formSubmitted.inquiryType === "reserve"
                        ? `reservation request for ${formSubmitted.eventTitle || "the live gig"}`
                        : formSubmitted.inquiryType === "host"
                        ? "venue hosting inquiry"
                        : "artist roster application"}
                      . Our team will reach out shortly.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      {formSubmitted.eventId && (
                        <Link
                          href={`/book/${formSubmitted.eventId}`}
                          className="px-5 py-2.5 bg-[#181615] hover:bg-black text-white text-xs font-semibold uppercase tracking-widest transition inline-flex items-center gap-1.5"
                        >
                          <Ticket className="w-3.5 h-3.5" />
                          Instant Ticket Checkout
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => setFormSubmitted(null)}
                        className="px-4 py-2.5 border border-white/40 hover:bg-white/10 text-white text-xs uppercase tracking-wider transition cursor-pointer"
                      >
                        Send Another
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleFormSubmit} className="max-w-md mx-auto space-y-4">
                    <div>
                      <input
                        type="text"
                         aria-label="Name"
                        placeholder="Name"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        required
                        className="w-full bg-transparent border-b border-white/70 py-2 text-xs sm:text-sm text-white placeholder:text-white/85 focus:outline-none focus:border-white transition-colors"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input
                        type="email"
                        aria-label="Email"
                        placeholder="Email"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        required
                        className="w-full bg-transparent border-b border-white/70 py-2 text-xs sm:text-sm text-white placeholder:text-white/85 focus:outline-none focus:border-white transition-colors"
                      />
                      <input
                        type="tel"
                        aria-label="Phone"
                        placeholder="Phone (Optional)"
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                        className="w-full bg-transparent border-b border-white/70 py-2 text-xs sm:text-sm text-white placeholder:text-white/85 focus:outline-none focus:border-white transition-colors"
                      />
                    </div>

                    {inquiryType === "reserve" && (
                      <div>
                        <select
                          aria-label="Select Live Event"
                          value={formEventId}
                          onChange={(e) => setFormEventId(e.target.value)}
                          className="w-full bg-[#D92323] border-b border-white/70 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-white transition-colors cursor-pointer"
                        >
                          {events.map((ev) => (
                            <option key={ev.id} value={ev.id} className="bg-[#181615] text-white">
                              {ev.title} — {ev.location_name} (₹{ev.ticket_price})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <input
                        type="text"
                        aria-label="Message"
                        placeholder={
                          inquiryType === "reserve"
                            ? "Message (e.g., Table for 4, special song dedication request)"
                            : inquiryType === "host"
                            ? "Venue Name, City & Preferred Nights"
                            : "Instagram / Spotify Link & Genre"
                        }
                        value={formMessage}
                        onChange={(e) => setFormMessage(e.target.value)}
                        className="w-full bg-transparent border-b border-white/70 py-2 text-xs sm:text-sm text-white placeholder:text-white/85 focus:outline-none focus:border-white transition-colors"
                      />
                    </div>

                    {formError && (
                      <p className="text-xs text-amber-200 font-medium text-center">{formError}</p>
                    )}

                    <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="submit"
                        disabled={formSubmitting}
                        className="px-10 py-3 bg-[#181615] hover:bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] transition disabled:opacity-60 cursor-pointer"
                      >
                        {formSubmitting ? "Sending…" : "Send"}
                      </button>

                      {inquiryType === "reserve" && formEventId && (
                        <Link
                          href={`/book/${formEventId}`}
                          className="px-4 py-3 border border-white/45 hover:bg-white/15 text-white text-[11px] font-medium uppercase tracking-wider transition flex items-center gap-1.5"
                        >
                          Direct Ticket Checkout →
                        </Link>
                      )}
                    </div>
                  </form>
                )}
              </motion.div>
            </div>

            {/* Bottom Editorial Contact Metadata & Copyright Bar (Matches Reference Frame 00:16) */}
            <footer className="w-full max-w-5xl mx-auto pt-4 border-t border-[#181615]/15 text-[#181615]">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-3 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#181615]/55 mb-0.5">
                    Email
                  </p>
                  <a
                    href="mailto:hello@museing.live"
                    className="font-medium hover:text-[#D92323] transition-colors"
                  >
                    hello@museing.live
                  </a>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#181615]/55 mb-0.5">
                    Phone No
                  </p>
                  <a
                    href="tel:+919876543210"
                    className="font-medium hover:text-[#D92323] transition-colors"
                  >
                    +91 98765 43210
                  </a>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#181615]/55 mb-0.5">
                    Live Portals
                  </p>
                  <div className="flex items-center gap-3 font-medium">
                    <Link href="/live?location=toit-indiranagar" className="hover:text-[#D92323]">
                      Live QR
                    </Link>
                    <Link href="/artist" className="hover:text-[#D92323]">
                      Artist
                    </Link>
                    <Link href="/promoter" className="hover:text-[#D92323]">
                      Promoter
                    </Link>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#181615]/55 mb-0.5">
                    Social Media
                  </p>
                  <div className="flex items-center gap-2.5">
                    <a
                      href="https://instagram.com"
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Instagram"
                      className="w-6 h-6 rounded-full bg-[#181615] text-white flex items-center justify-center hover:bg-[#D92323] transition-colors"
                    >
                      <Instagram className="w-3 h-3" />
                    </a>
                    <Link
                      href="/live?location=toit-indiranagar"
                      aria-label="Live QR Experience"
                      className="w-6 h-6 rounded-full bg-[#181615] text-white flex items-center justify-center hover:bg-[#D92323] transition-colors"
                    >
                      <QrCode className="w-3 h-3" />
                    </Link>
                    <Link
                      href="/artist"
                      aria-label="Artist Stage"
                      className="w-6 h-6 rounded-full bg-[#181615] text-white flex items-center justify-center hover:bg-[#D92323] transition-colors"
                    >
                      <Mic2 className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="pt-2.5 border-t border-[#181615]/10 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#181615]/60">
                <span>Copyright © Muse-ing 2026</span>
                <div className="flex items-center gap-4">
                  <Link href="/login" className="hover:text-[#181615]">
                    Artist &amp; Admin Login
                  </Link>
                  <Link href="/venue-checkin" className="hover:text-[#181615]">
                    Venue Check-In
                  </Link>
                  <span>Privacy Policy</span>
                  <span>Terms &amp; Conditions</span>
                </div>
              </div>
            </footer>
          </section>
        </motion.main>
      </div>

      {/* ARTIST QUICK SPOTLIGHT MODAL */}
      <AnimatePresence>
        {activeArtistModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
            onClick={() => setActiveArtistModal(null)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-[#F4EFE6] text-[#181615] p-5 sm:p-6 shadow-2xl border border-[#181615]/15 rounded-2xl relative"
            >
              <button
                type="button"
                onClick={() => setActiveArtistModal(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#181615]/10 hover:bg-[#181615] hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-4 mb-4">
                <img
                  src={activeArtistModal.avatar_url}
                  alt={activeArtistModal.name}
                  className="w-20 h-24 object-cover rounded-xl shadow-md shrink-0"
                />
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#D92323] text-white text-[10px] font-semibold uppercase tracking-wider mb-1">
                    {activeArtistModal.city} • {activeArtistModal.date_badge}
                  </span>
                  <h3 className="text-xl font-semibold leading-snug">
                    {activeArtistModal.name}
                  </h3>
                  <p className="text-xs text-[#181615]/70">{activeArtistModal.role_tag}</p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-[#181615]/85 leading-relaxed mb-4">
                {activeArtistModal.bio}
              </p>

              <div className="p-3 bg-white rounded-2xl shadow-sm mb-4">
                <p className="text-[10px] uppercase tracking-wider text-[#D92323] font-semibold">
                  Currently Hosted Gig
                </p>
                <p className="text-sm font-semibold mt-0.5">
                  {activeArtistModal.next_event_title}
                </p>
                <p className="text-xs text-[#181615]/70 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-[#D92323]" />
                  {activeArtistModal.next_event_location}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/live?location=${encodeURIComponent(
                    activeArtistModal.next_event_slug || "toit-indiranagar"
                  )}&date=${encodeURIComponent(activeArtistModal.next_event_date || "")}`}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#D92323] hover:bg-[#b81b1b] text-white text-xs font-semibold uppercase tracking-wider text-center transition flex items-center justify-center gap-1.5"
                >
                  <Music className="w-3.5 h-3.5" />
                  Open Live Setlist &amp; Request
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setActiveArtistModal(null)
                    setInquiryType("reserve")
                    scrollToSection(2)
                  }}
                  className="py-2.5 px-4 rounded-xl bg-[#181615] hover:bg-black text-white text-xs font-semibold uppercase tracking-wider transition cursor-pointer"
                >
                  Book Table
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* VENUE TABLE QR CODE MODAL */}
      {qrModalEvent && (
        <QrCodeModal
          open={true}
          onClose={() => setQrModalEvent(null)}
          locationName={qrModalEvent.location_name || "Venue"}
          locationSlug={qrModalEvent.location_slug || "toit-indiranagar"}
          eventDateOnly={
            qrModalEvent.event_date_only ||
            new Date(qrModalEvent.date).toISOString().slice(0, 10)
          }
          eventTitle={qrModalEvent.title}
          artistName={qrModalEvent.artist_name || undefined}
        />
      )}
    </div>
  )
}
