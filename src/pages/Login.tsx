import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

const styles = `
@keyframes drift1 {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  25% { transform: translate(80px, -60px) rotate(6deg) scale(1.08); }
  50% { transform: translate(-40px, 30px) rotate(-4deg) scale(0.95); }
  75% { transform: translate(50px, 40px) rotate(3deg) scale(1.03); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes drift2 {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  33% { transform: translate(-70px, 50px) rotate(-5deg) scale(1.06); }
  66% { transform: translate(60px, -40px) rotate(7deg) scale(0.97); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
@keyframes drift3 {
  0% { transform: translate(0, 0) rotate(0deg); }
  25% { transform: translate(-60px, -40px) rotate(-3deg); }
  50% { transform: translate(50px, 60px) rotate(5deg); }
  75% { transform: translate(-30px, -20px) rotate(-2deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
@keyframes pulseGlow {
  0%, 100% { opacity: 0.15; }
  50% { opacity: 0.3; }
}
@keyframes grain {
  0%, 100% { transform: translate(0, 0); }
  10% { transform: translate(-5%, -5%); }
  20% { transform: translate(-10%, 5%); }
  30% { transform: translate(5%, -10%); }
  40% { transform: translate(-5%, 15%); }
  50% { transform: translate(-10%, 5%); }
  60% { transform: translate(15%, 0); }
  70% { transform: translate(0, 10%); }
  80% { transform: translate(-15%, 0); }
  90% { transform: translate(10%, 5%); }
}
@keyframes shardFloat {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; filter: drop-shadow(0 0 4px rgba(255,89,0,0.2)); }
  50% { transform: translate(0, 0) rotate(0deg) scale(1.08); opacity: 1; filter: drop-shadow(0 0 14px rgba(255,89,0,0.6)); }
}
@keyframes shardFloat2 {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.2); }
}
`

export default function Login() {
  const { signIn, configError } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setError(null)
    const { error } = await signIn(data.email, data.password, rememberMe)
    if (error) {
      setError(error.message)
    } else {
      const redirectUrl = sessionStorage.getItem('acceptanceRedirect')
      if (redirectUrl) {
        sessionStorage.removeItem('acceptanceRedirect')
        window.location.href = redirectUrl
      } else {
        navigate('/dashboard')
      }
    }
  }

  return (
    <>
      <style>{styles}</style>
      <div className="fixed inset-0 overflow-hidden" style={{ backgroundColor: '#1B1A1C' }}>
        {/* Abstract 3D tube shapes */}
        <div className="fixed inset-0 z-0">
          {/* Large orange nebula — top left */}
          <div
            style={{
              position: 'absolute',
              top: '-8%',
              left: '-5%',
              width: '55%',
              height: '60%',
              borderRadius: '40% 60% 70% 30% / 50% 40% 60% 50%',
              background: 'radial-gradient(ellipse at 30% 40%, #FF5900 0%, #FF590040 50%, transparent 70%)',
              opacity: 0.25,
              filter: 'blur(80px)',
              animation: 'drift1 25s ease-in-out infinite',
            }}
          />

          {/* Orange cosmic ring — bottom right */}
          <div
            style={{
              position: 'absolute',
              bottom: '-10%',
              right: '-8%',
              width: '60%',
              height: '65%',
              borderRadius: '60% 40% 30% 70% / 40% 60% 40% 60%',
              background: 'radial-gradient(ellipse at 70% 60%, #FF5900 0%, #FF590030 45%, transparent 70%)',
              opacity: 0.2,
              filter: 'blur(90px)',
              animation: 'drift2 30s ease-in-out infinite',
            }}
          />

          {/* Orange cosmic swirl — center right */}
          <div
            style={{
              position: 'absolute',
              top: '15%',
              right: '-10%',
              width: '40%',
              height: '75%',
              borderRadius: '50% 50% 30% 70% / 60% 30% 70% 40%',
              background: 'radial-gradient(ellipse at 50% 50%, #FF5900 0%, #FF590020 50%, transparent 75%)',
              opacity: 0.15,
              filter: 'blur(100px)',
              animation: 'drift3 28s ease-in-out infinite',
            }}
          />

          {/* Orange cosmic cloud — bottom left */}
          <div
            style={{
              position: 'absolute',
              bottom: '-5%',
              left: '5%',
              width: '35%',
              height: '45%',
              borderRadius: '30% 70% 50% 50% / 40% 40% 60% 60%',
              background: 'radial-gradient(ellipse at 60% 40%, #FF5900 0%, #FF590025 55%, transparent 80%)',
              opacity: 0.18,
              filter: 'blur(70px)',
              animation: 'drift1 35s ease-in-out infinite reverse',
            }}
          />

          {/* Orange cosmic flare — top right */}
          <div
            style={{
              position: 'absolute',
              top: '-15%',
              right: '10%',
              width: '30%',
              height: '55%',
              borderRadius: '40% 60% 60% 40% / 70% 30% 70% 30%',
              background: 'radial-gradient(ellipse at 40% 30%, #FF5900 0%, #FF590015 50%, transparent 75%)',
              opacity: 0.12,
              filter: 'blur(85px)',
              animation: 'drift2 32s ease-in-out infinite 3s',
            }}
          />

          {/* Orange cosmic core — middle left */}
          <div
            style={{
              position: 'absolute',
              top: '40%',
              left: '3%',
              width: '25%',
              height: '25%',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #FF5900 0%, #FF590060 30%, transparent 70%)',
              opacity: 0.2,
              filter: 'blur(60px)',
              animation: 'pulseGlow 8s ease-in-out infinite',
            }}
          />

          {/* Bright orange star burst — center */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '15%',
              height: '15%',
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle, #FF5900 0%, #FF590040 40%, transparent 70%)',
              opacity: 0.1,
              filter: 'blur(50px)',
              animation: 'pulseGlow 6s ease-in-out infinite 1.5s',
            }}
          />

          {/* Orange cosmic wave — bottom center */}
          <div
            style={{
              position: 'absolute',
              bottom: '-15%',
              left: '25%',
              width: '50%',
              height: '30%',
              borderRadius: '50% 50% 40% 60% / 60% 40% 60% 40%',
              background: 'radial-gradient(ellipse at 50% 50%, #FF5900 0%, #FF590020 40%, transparent 70%)',
              opacity: 0.1,
              filter: 'blur(75px)',
              animation: 'drift3 26s ease-in-out infinite 2s',
            }}
          />
        </div>

        {/* Login card */}
        <div className="fixed inset-0 z-20 flex items-center justify-center p-4 sm:p-8">
          <div
            className="w-full max-w-md rounded-2xl border p-8 sm:p-10"
            style={{
              backgroundColor: 'rgba(27,26,28,0.7)',
              borderColor: 'rgba(255,89,0,0.15)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,89,0,0.1), 0 0 80px rgba(255,89,0,0.05)',
            }}
          >
            {/* Animated Megaphone Logo */}
            <div className="flex items-center gap-3 mb-8">
              <div className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="#FF5900" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  {/* Megaphone body */}
                  <path d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
                    style={{ animation: 'shardFloat 4s ease-in-out infinite 0s' } as React.CSSProperties} />
                  {/* Sound wave left */}
                  <path d="M2 10h1" strokeWidth="2"
                    style={{ animation: 'shardFloat2 3s ease-in-out infinite 0.4s', opacity: 0.7 } as React.CSSProperties} />
                  {/* Sound wave right */}
                  <path d="M21 10h1" strokeWidth="2"
                    style={{ animation: 'shardFloat2 3s ease-in-out infinite 0.8s', opacity: 0.7 } as React.CSSProperties} />
                </svg>
              </div>
              <div>
                <span className="text-lg font-bold" style={{ color: '#CACDD7' }}>Marketing Department</span>
                <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: '#CACDD7', opacity: 0.4 }}>Internal Portal</p>
              </div>
            </div>

            <h2 className="text-2xl mb-1" style={{ color: '#CACDD7', fontWeight: 700 }}>Sign in</h2>
            <p className="text-sm mb-8" style={{ color: '#CACDD7', fontWeight: 300, opacity: 0.6 }}>Enter your credentials to access the portal</p>

            {/* Error */}
            {(error || configError) && (
              <div className="mb-6 flex items-start gap-3 rounded-xl p-4" style={{ backgroundColor: '#FF590010', border: '1px solid #FF590030' }}>
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#FF5900' }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm" style={{ color: '#FF5900', fontWeight: 500 }}>{configError ? 'Configuration Error' : 'Authentication failed'}</p>
                  <p className="text-sm mt-0.5" style={{ color: '#FF5900', opacity: 0.7 }}>{configError || error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm mb-2" style={{ color: '#CACDD7', fontWeight: 500, opacity: 0.8 }}>Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5" style={{ color: '#FF5900', opacity: 0.6 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    {...register('email')}
                    type="email"
                    id="email"
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl outline-none transition border"
                    style={{
                      backgroundColor: '#1B1A1C',
                      borderColor: errors.email ? '#FF5900' : '#3E4048',
                      color: '#CACDD7',
                    }}
                    placeholder="you@company.com"
                  />
                </div>
                {errors.email && (
                  <p className="mt-2 text-sm flex items-center gap-1" style={{ color: '#FF5900' }}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm mb-2" style={{ color: '#CACDD7', fontWeight: 500, opacity: 0.8 }}>Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5" style={{ color: '#FF5900', opacity: 0.6 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    className="w-full pl-12 pr-12 py-3.5 rounded-xl outline-none transition border"
                    style={{
                      backgroundColor: '#1B1A1C',
                      borderColor: errors.password ? '#FF5900' : '#3E4048',
                      color: '#CACDD7',
                    }}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center transition"
                    style={{ color: '#FF5900', opacity: 0.6 }}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-2 text-sm flex items-center gap-1" style={{ color: '#FF5900' }}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 rounded" style={{ accentColor: '#FF5900', borderColor: '#3E4048' }} />
                  <span className="text-sm" style={{ color: '#CACDD7', opacity: 0.6, fontWeight: 300 }}>Remember me</span>
                </label>
                <a href="#" className="text-sm transition hover:underline" style={{ color: '#CACDD7', opacity: 0.6, fontWeight: 500 }}>
                  Forgot password?
                </a>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#FF5900', color: '#1B1A1C', fontWeight: 700 }}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="mt-8 pt-8 border-t" style={{ borderColor: '#3E4048' }}>
              <p className="text-center text-sm" style={{ color: '#CACDD7', opacity: 0.5, fontWeight: 300 }}>
                Need access? Contact{' '}
                <a href="mailto:it@company.com" className="hover:underline" style={{ color: '#CACDD7', fontWeight: 500 }}>
                  IT Support
                </a>
              </p>
              <p className="text-center text-xs mt-2" style={{ color: '#CACDD7', opacity: 0.35, fontWeight: 300 }}>
                This is an internal system. Unauthorized access is prohibited.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}