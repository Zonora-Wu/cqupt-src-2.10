import { useState } from 'react'
import { LoginModal } from './components/auth/LoginModal'
import { RegisterModal } from './components/auth/RegisterModal'
import { GuestHome } from './pages/guest/GuestHome'

function App() {
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null)

  return (
    <>
      <GuestHome onLogin={() => setAuthModal('login')} onRegister={() => setAuthModal('register')} />
      {authModal === 'login' && (
        <LoginModal
          onClose={() => setAuthModal(null)}
          onSwitchToRegister={() => setAuthModal('register')}
        />
      )}
      {authModal === 'register' && (
        <RegisterModal
          onClose={() => setAuthModal(null)}
          onSwitchToLogin={() => setAuthModal('login')}
        />
      )}
    </>
  )
}

export default App
