import { lazy, Suspense, useEffect, useState } from 'react'
import { GuestHome } from './pages/guest/GuestHome'
import { AdminHome } from './pages/admin/AdminHome'
import { AuditorHome } from './pages/auditor/AuditorHome'
import { UserHome } from './pages/user/UserHome'
import { clearSavedSession, getCurrentUser, getSavedSession, type AuthUser } from './services/auth'

const LoginModal = lazy(() =>
  import('./components/auth/LoginModal').then((module) => ({ default: module.LoginModal })),
)
const RegisterModal = lazy(() =>
  import('./components/auth/RegisterModal').then((module) => ({ default: module.RegisterModal })),
)

function App() {
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getSavedSession()?.user ?? null)
  const [isCheckingSession, setIsCheckingSession] = useState(() => Boolean(getSavedSession()?.accessToken))

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
        currentUser.role === 'admin' ? (
          <AdminHome
            onLogout={() => {
              clearSavedSession()
              setCurrentUser(null)
              setAuthModal(null)
            }}
            user={currentUser}
          />
        ) : currentUser.role === 'auditor' ? (
          <AuditorHome
            onLogout={() => {
              clearSavedSession()
              setCurrentUser(null)
              setAuthModal(null)
            }}
            user={currentUser}
          />
        ) : (
          <UserHome
            onLogout={() => {
              clearSavedSession()
              setCurrentUser(null)
              setAuthModal(null)
            }}
            user={currentUser}
          />
        )
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
            onSwitchToLogin={() => setAuthModal('login')}
          />
        )}
      </Suspense>
    </>
  )
}

export default App
