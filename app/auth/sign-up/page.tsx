"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import Link from "next/link"
import { ArrowLeft, Mic2 } from "lucide-react"

export default function SignUpPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      role: "artist" as "artist" | "promoter" | "venue",
      instagram_handle: "",
      avatar_url: "",
      password: "",
      repeatPassword: "",
    },
  })

  const password = watch("password")
  const role = watch("role")

  const handleSignUp = async (values: any) => {
    setIsLoading(true)
    setError(null)

    if (values.password !== values.repeatPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Sign up failed.")

      if (body.role === "artist") router.push("/artist")
      else if (body.role === "venue") router.push("/venue-checkin")
      else router.push("/promoter")
    } catch (err: any) {
      setError(err.message || "An error occurred during sign up")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#07070b] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="w-full max-w-md bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 relative z-10">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center text-white/70 hover:text-white text-sm font-light mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Home
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs mb-3">
            <Mic2 className="w-3.5 h-3.5" />
            Create Account
          </div>
          <h1 className="text-3xl font-light text-white mb-1">Join Muse-ing</h1>
          <p className="text-white/60 text-sm">Set up your Artist profile, pre-load your setlist, and run interactive gigs</p>
        </div>

        <form onSubmit={handleSubmit(handleSignUp)} className="space-y-4">
          <div>
            <label htmlFor="role" className="block text-white/80 text-xs font-medium mb-1.5">
              Account Type
            </label>
            <select
              id="role"
              className="w-full px-4 py-2.5 rounded-xl bg-[#14141f] border border-white/15 text-white text-sm focus:outline-none focus:border-purple-400"
              {...register("role", { required: "Please select a role" })}
            >
              <option value="artist">Performing Artist / Band</option>
              <option value="venue">Venue Partner</option>
              <option value="promoter">Event Promoter</option>
            </select>
          </div>

          <div>
            <label htmlFor="name" className="block text-white/80 text-xs font-medium mb-1.5">
              {role === "artist" ? "Artist / Stage Name" : "Name"}
            </label>
            <input
              id="name"
              type="text"
              placeholder={role === "artist" ? "e.g., Arjun Mehta Live" : "Your name"}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white placeholder-white/35 text-sm focus:outline-none focus:border-purple-400"
              {...register("name", { required: "Name is required" })}
            />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
          </div>

          {role === "artist" && (
            <>
              <div>
                <label htmlFor="instagram_handle" className="block text-white/80 text-xs font-medium mb-1.5">
                  Instagram Handle (Shown on Audience Phones)
                </label>
                <input
                  id="instagram_handle"
                  type="text"
                  placeholder="@yourinstagram"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white placeholder-white/35 text-sm focus:outline-none focus:border-purple-400"
                  {...register("instagram_handle")}
                />
              </div>
              <div>
                <label htmlFor="avatar_url" className="block text-white/80 text-xs font-medium mb-1.5">
                  Profile Photo URL (Optional)
                </label>
                <input
                  id="avatar_url"
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white placeholder-white/35 text-sm focus:outline-none focus:border-purple-400"
                  {...register("avatar_url")}
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="email" className="block text-white/80 text-xs font-medium mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white placeholder-white/35 text-sm focus:outline-none focus:border-purple-400"
                {...register("email", { required: "Email is required" })}
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-white/80 text-xs font-medium mb-1.5">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                placeholder="9876543210"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white placeholder-white/35 text-sm focus:outline-none focus:border-purple-400"
                {...register("phone")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="password" className="block text-white/80 text-xs font-medium mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white placeholder-white/35 text-sm focus:outline-none focus:border-purple-400"
                {...register("password", {
                  required: "Password is required",
                  minLength: { value: 6, message: "Min 6 chars" },
                })}
              />
            </div>
            <div>
              <label htmlFor="repeatPassword" className="block text-white/80 text-xs font-medium mb-1.5">
                Confirm Password
              </label>
              <input
                id="repeatPassword"
                type="password"
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white placeholder-white/35 text-sm focus:outline-none focus:border-purple-400"
                {...register("repeatPassword", {
                  required: "Confirm password",
                  validate: (v) => v === password || "Mismatch",
                })}
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            className="w-full px-6 py-3 rounded-xl bg-white text-black font-medium text-sm transition-all duration-300 hover:bg-white/90 cursor-pointer mt-2"
            disabled={isLoading}
          >
            {isLoading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-white/60 text-xs mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-white hover:text-white/80 underline underline-offset-4">
            Artist Login
          </Link>
        </p>
      </div>
    </div>
  )
}
