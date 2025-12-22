'use client';

// Minimal global error page to work around Next.js 16 + React 19 pre-rendering bug
export const dynamic = 'force-dynamic';

export default function GlobalError() {
  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          padding: '2rem'
        }}>
          <div style={{ textAlign: 'center', maxWidth: '500px' }}>
            <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>Application Error</h1>
            <p style={{ color: '#666', marginBottom: '2rem' }}>
              The application encountered a critical error.
            </p>
            <a
              href="/"
              style={{
                display: 'inline-block',
                padding: '0.75rem 2rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                borderRadius: '0.5rem',
                textDecoration: 'none'
              }}
            >
              Return Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
