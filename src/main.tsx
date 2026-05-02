import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { KindeProvider } from '@kinde-oss/kinde-auth-react'
import { DesignSystemProvider } from '@neutheria/design-system'
import './index.css'
import App from './App.tsx'

const origin = window.location.origin

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <KindeProvider
      clientId={import.meta.env.VITE_KINDE_CLIENT_ID!}
      domain={import.meta.env.VITE_KINDE_DOMAIN!}
      redirectUri={import.meta.env.VITE_KINDE_REDIRECT_URI || origin}
      logoutUri={import.meta.env.VITE_KINDE_LOGOUT_REDIRECT_URI || origin}
      audience={import.meta.env.VITE_KINDE_AUDIENCE}
    >
      <DesignSystemProvider theme={{ glowColor: 'rgba(59, 130, 246, 0.18)', accentColor: '#2563eb' }} background={false}>
        <App />
      </DesignSystemProvider>
    </KindeProvider>
  </StrictMode>,
)
