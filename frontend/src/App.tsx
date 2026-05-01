import { lazy, Suspense, useEffect, useState } from 'react'
import { GuestHome } from './pages/guest/GuestHome'
import { AUTH_SESSION_EXPIRED_EVENT } from './services/apiClient'
import { clearSavedSession, getCurrentUser, getSavedSession, type AuthUser } from './services/auth'

const AdminHome = lazy(() =>
  import('./pages/admin/AdminHome').then((module) => ({ default: module.AdminHome })),
)
const AuditorHome = lazy(() =>
  import('./pages/auditor/AuditorHome').then((module) => ({ default: module.AuditorHome })),
)
const LoginModal = lazy(() =>
  import('./components/auth/LoginModal').then((module) => ({ default: module.LoginModal })),
)
const RegisterModal = lazy(() =>
  import('./components/auth/RegisterModal').then((module) => ({ default: module.RegisterModal })),
)
const UserHome = lazy(() =>
  import('./pages/user/UserHome').then((module) => ({ default: module.UserHome })),
)

function App() {
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getSavedSession()?.user ?? null)
  const [isCheckingSession, setIsCheckingSession] = useState(() => Boolean(getSavedSession()?.accessToken))
  const [sessionNotice, setSessionNotice] = useState('')

  useEffect(() => {
    let active = true

    async function validateSession() {
      try {
        const user = await getCurrentUser()
        if (active) {
          setCurrentUser(user)
        }
      } catch {
        if (active) {
          setCurrentUser(null)
        }
      } finally {
        if (active) {
          setIsCheckingSession(false)
        }
      }
    }

    if (isCheckingSession) {
      void validateSession()
    }

    return () => {
      active = false
    }
  }, [isCheckingSession])

  useEffect(() => {
    let noticeTimer: number | undefined

    function handleSessionExpired() {
      clearSavedSession()
      setCurrentUser(null)
      setAuthModal(null)
      setIsCheckingSession(false)
      setSessionNotice('登录状态已失效，请重新登录。')
      window.clearTimeout(noticeTimer)
      noticeTimer = window.setTimeout(() => setSessionNotice(''), 3200)
    }

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired)

    return () => {
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired)
      window.clearTimeout(noticeTimer)
    }
  }, [])

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7faf5] text-sm text-slate-500 dark:bg-[#080b08] dark:text-white/55">
        正在校验登录状态...
      </div>
    )
  }

  return (
    <>
      {currentUser ? (
        <Suspense fallback={<AppLoading text="正在加载工作台..." />}>
          {currentUser.role === 'admin' ? (
            <AdminHome onLogout={handleLogout} user={currentUser} />
          ) : currentUser.role === 'auditor' ? (
            <AuditorHome onLogout={handleLogout} user={currentUser} />
          ) : (
            <UserHome onLogout={handleLogout} user={currentUser} />
          )}
        </Suspense>
      ) : (
        <GuestHome onLogin={() => setAuthModal('login')} onRegister={() => setAuthModal('register')} />
      )}
      <Suspense fallback={null}>
        {authModal === 'login' && (
          <LoginModal
            onClose={() => setAuthModal(null)}
            onLoginSuccess={(user) => {
              setCurrentUser(user)
              setAuthModal(null)
            }}
            onSwitchToRegister={() => setAuthModal('register')}
          />
        )}
        {authModal === 'register' && (
          <RegisterModal
            onClose={() => setAuthModal(null)}
            onRegisterSuccess={(user) => {
              setCurrentUser(user)
              setAuthModal(null)
            }}
            onSwitchToLogin={() => setAuthModal('login')}
          />
        )}
      </Suspense>
      {sessionNotice && (
        <div className="fixed left-1/2 top-4 z-[120] -translate-x-1/2 rounded-lg border border-amber-500/20 bg-amber-50/95 px-4 py-3 text-sm font-medium text-amber-900 shadow-lg shadow-black/10 backdrop-blur dark:border-amber-300/20 dark:bg-amber-950/90 dark:text-amber-100">
          {sessionNotice}
        </div>
      )}
    </>
  )

  function handleLogout() {
    clearSavedSession()
    setCurrentUser(null)
    setAuthModal(null)
  }
}

function AppLoading({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7faf5] text-sm text-slate-500 dark:bg-[#080b08] dark:text-white/55">
      {text}
    </div>
  )
}

export default App
