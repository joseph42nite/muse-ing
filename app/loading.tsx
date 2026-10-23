import MuseLoadingScreen from "@/components/muse-loading-screen"

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[100] bg-[#F4EFE6] text-[#181615] overflow-hidden">
      <MuseLoadingScreen isLoading={true} />
    </div>
  )
}
