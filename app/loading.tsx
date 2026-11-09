import MuseLoadingScreen from "@/components/muse-loading-screen"

// Shown while a route's server components load. The screen paints its own studio background.
export default function Loading() {
  return <MuseLoadingScreen isLoading />
}
