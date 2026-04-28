import { lazy, Suspense, useState } from 'react'
import { GuestHome } from './pages/guest/GuestHome'
import { AdminHome } from './pages/admin/AdminHome'
import { UserHome } from './pages/user/UserHome'
import { type AuthUser } from './services/auth'

const LoginModal = lazy(() =>
  import('./components/auth/LoginModal').then((module) => ({ default: module.LoginModal })),
)
const RegisterModal = lazy(() =>
  import('./components/auth/RegisterModal').then((module) => ({ default: module.RegisterModal })),
)

function App() {
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)

  return (
    <>
      {currentUser ? (
        currentUser.role === 'admin' ? (
          <AdminHome
            onLogout={() => {
              setCurrentUser(null)
              setAuthModal(null)
            }}
            user={currentUser}
          />
        ) : (
          <UserHome
            onLogout={() => {
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
