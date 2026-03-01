import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'

import { Auth0Provider } from '@auth0/auth0-react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000,   // 10 minutes — pipeline is expensive
      retry: 3,                     // retry up to 3 times
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      refetchOnWindowFocus: true,   // re-check when user tabs back
    },
  },
})

const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Auth0Provider
      domain={auth0Domain}
      clientId={auth0ClientId}
      authorizationParams={{ redirect_uri: window.location.origin }}
    >
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </Auth0Provider>
  </StrictMode>,
)
