
import Link from "next/link"

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-light text-white mb-2">Account Created!</h1>
        <p className="text-white/60 text-sm mb-8">
          Please check your email for a confirmation link to activate your account.
        </p>
        <Link href="/login" className="text-white hover:text-white/80 transition-colors">
          Go to Login
        </Link>
      </div>
    </div>
  )
}
