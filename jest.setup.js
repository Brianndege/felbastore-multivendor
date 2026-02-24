// jest.setup.js

// Set environment variables
process.env.API_URL = 'https://api.example.com'; // Example environment variable

// Mock for Next.js Image component
jest.mock('next/image', () => {
  return ({ src, alt }) => {
    return <img src={src} alt={alt} />;
  };
});

// Mock for Next.js Router
jest.mock('next/router', () => ({
  useRouter: () => ({
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
  }),
}));

// Set default timeout for tests
jest.setTimeout(30000); // 30 seconds