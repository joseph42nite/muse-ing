"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

export default function SignUpPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      role: "promoter" as const,
      promoter_code: "",
      password: "",
      repeatPassword: "",
    },
  })

  const password = watch("password")
  const role = watch("role")
  const name = watch("name")

  useEffect(() => {
    if (role === "promoter" && name) {
      const promoterCode = name.slice(0, 3).toUpperCase() + Math.floor(100 + Math.random() * 900)
      setValue("promoter_code", promoterCode)
    } else {
      setValue("promoter_code", "")
    }
  }, [role, name, setValue])

  const handleSignUp = async (values: any) => {
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    if (values.password !== values.repeatPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })

      if (signUpError) throw signUpError

      if (data.user) {
        const { error: insertError } = await supabase.from("users").insert([
          {
            id: data.user.id,
            name: values.name,
            email: values.email,
            phone: values.phone,
            role: values.role,
            promoter_code: values.role === "promoter" ? values.promoter_code : null,
          },
        ])

        if (insertError) throw insertError
      }

      router.push("/auth/sign-up-success")
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred during sign up"
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-white/80 hover:text-white text-sm font-light mb-6 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <h1 className="text-3xl font-light text-white mb-2">Create an account</h1>
          <p className="text-white/60 text-sm">Get started with your new account</p>
        </div>

        <form onSubmit={handleSubmit(handleSignUp)} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-white/80 text-sm font-light mb-2">
              Name
            </label>
            <input
              id="name"
              type="text"
              placeholder="Your name"
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/40 transition-colors"
              {...register("name", { required: "Name is required" })}
            />
            {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor="email" className="block text-white/80 text-sm font-light mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/40 transition-colors"
              {...register("email", {
                required: "Email is required",
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: "Invalid email address",
                },
              })}
            />
            {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="phone" className="block text-white/80 text-sm font-light mb-2">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              placeholder="Your phone number"
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/40 transition-colors"
              {...register("phone")}
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-white/80 text-sm font-light mb-2">
              I am a...
            </label>
            <select
              id="role"
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/40 transition-colors"
              {...register("role", { required: "Please select a role" })}
            >
              <option value="promoter">Promoter</option>
              <option value="venue">Venue</option>
            </select>
            {errors.role && <p className="text-sm text-red-500 mt-1">{errors.role.message}</p>}
          </div>

          {role === "promoter" && (
            <div>
              <label htmlFor="promoter_code" className="block text-white/80 text-sm font-light mb-2">
                Promoter Code
              </label>
              <input
                id="promoter_code"
                type="text"
                readOnly
                placeholder="Your unique promoter code"
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/40 transition-colors"
                {...register("promoter_code")}
              />
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-white/80 text-sm font-light mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/40 transition-colors"
              {...register("password", {
                required: "Password is required",
                minLength: {
                  value: 6,
                  message: "Password must be at least 6 characters",
                },
              })}
            />
            {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label
              htmlFor="repeatPassword"
              className="block text-white/80 text-sm font-light mb-2"
            >
              Confirm Password
            </label>
            <input
              id="repeatPassword"
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/40 transition-colors"
              {...register("repeatPassword", {
                required: "Please confirm your password",
                validate: (value) => value === password || "Passwords do not match",
              })}
            />
            {errors.repeatPassword && (
              <p className="text-sm text-red-500 mt-1">{errors.repeatPassword.message}</p>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            className="w-full px-6 py-2 rounded-lg bg-white text-black font-normal text-sm transition-all duration-300 hover:bg-white/90 cursor-pointer mt-6"
            disabled={isLoading}
          >
            {isLoading ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <p className="text-center text-white/60 text-sm mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-white hover:text-white/80 transition-colors">
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}