import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { GuestHome } from './pages/guest/GuestHome'
import { PublicOnly, RequireRole } from './routes/guards'
import { getDefaultPathForRole } from './routes/routeConfig'
import { AUTH_SESSION_EXPIRED_EVENT } from './services/apiClient'
import { clearSavedSession, getCurrentUser, getSavedSession, type AuthUser } from './services/auth'
import { getPublicPlatformAppearance } from './services/systemSettings'
import { applyBrandTheme } from './utils/brandTheme'
import { applyPlatformBranding } from './utils/platformBranding'

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
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}

function AppShell() {
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getSavedSession()?.user ?? null)
  const [isCheckingSession, setIsCheckingSession] = useState(() => Boolean(getSavedSession()?.accessToken))
  const [sessionNotice, setSessionNotice] = useState('')
  const location = useLocation()
  const navigate = useNavigate()

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
    let active = true

    async function loadPlatformAppearance() {
      try {
        const appearance = await getPublicPlatformAppearance()
        if (active) {
          applyBrandTheme(appearance.themeColor, appearance.themePalette)
          applyPlatformBranding(appearance)
        }
      } catch {
        applyBrandTheme('#2A6438')
        applyPlatformBranding()
      }
    }

    void loadPlatformAppearance()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let noticeTimer: number | undefined

    const routeNotice = (location.state as { notice?: string } | null)?.notice
    if (routeNotice) {
      setSessionNotice(routeNotice)
      window.clearTimeout(noticeTimer)
      noticeTimer = window.setTimeout(() => setSessionNotice(''), 3200)
      window.history.replaceState({}, document.title, location.pathname)
    }

    function handleSessionExpired() {
      clearSavedSession()
      setCurrentUser(null)
      setAuthModal(null)
      setIsCheckingSession(false)
      setSessionNotice('登录状态已失效，请重新登录。')
      navigate('/', { replace: true })
      window.clearTimeout(noticeTimer)
      noticeTimer = window.setTimeout(() => setSessionNotice(''), 3200)
    }

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired)

    return () => {
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired)
      window.clearTimeout(noticeTimer)
    }
  }, [location.pathname, location.state, navigate])

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-sm text-slate-500  dark:text-white/55">
        正在校验登录状态...
      </div>
    )
  }

  return (
    <>
      <Routes>
        {['/', '/rules', '/announcements', '/certificates', '/about'].map((path) => (
          <Route
            element={(
              <PublicOnly user={currentUser}>
                <GuestHome onLogin={() => setAuthModal('login')} onRegister={() => setAuthModal('register')} />
              </PublicOnly>
            )}
            key={path}
            path={path}
          />
        ))}
        <Route
          element={(
            <RequireRole allowedRole="student" user={currentUser}>
              <Suspense fallback={<AppLoading text="正在加载用户工作台..." />}>
                {currentUser && <UserHome onLogout={handleLogout} user={currentUser} />}
              </Suspense>
            </RequireRole>
          )}
          path="/user/*"
        />
        <Route
          element={(
            <RequireRole allowedRole="auditor" user={currentUser}>
              <Suspense fallback={<AppLoading text="正在加载审核工作台..." />}>
                {currentUser && <AuditorHome onLogout={handleLogout} user={currentUser} />}
              </Suspense>
            </RequireRole>
          )}
          path="/auditor/*"
        />
        <Route
          element={(
            <RequireRole allowedRole="admin" user={currentUser}>
              <Suspense fallback={<AppLoading text="正在加载管理工作台..." />}>
                {currentUser && <AdminHome onLogout={handleLogout} user={currentUser} />}
              </Suspense>
            </RequireRole>
          )}
          path="/admin/*"
        />
        <Route
          element={(
            currentUser
              ? <Navigate replace to={getDefaultPathForRole(currentUser.role)} />
              : <Navigate replace state={{ notice: '请先登录后访问该页面。' }} to="/" />
          )}
          path="*"
        />
      </Routes>
      <Suspense fallback={null}>
        {authModal === 'login' && (
          <LoginModal
            onClose={() => setAuthModal(null)}
            onLoginSuccess={(user) => {
              setCurrentUser(user)
              setAuthModal(null)
              navigate(getDefaultPathForRole(user.role), { replace: true })
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
              navigate(getDefaultPathForRole(user.role), { replace: true })
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
    navigate('/', { replace: true })
  }
}

function AppLoading({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-sm text-slate-500  dark:text-white/55">
      {text}
    </div>
  )
}

export default App
