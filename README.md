# HospitalServices

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

HospitalServices is a multi-application monorepo built with **Nx**, **NestJS**, **Angular**, **Prisma (MongoDB)**, and **Redis**.

## Architecture & Documentation

- [Comprehensive Authentication Architecture & Lifecycle Documentation](docs/auth_implementation_docs.md): Explains HTTP-Only cookies, JWT token rotation, Progressive Google OAuth 2.0, progressive account linking, profile onboarding, and sequence diagrams.
- [API Client Guide](docs/api_client_guide.md): Reference guide for `@hospital-services/api-client` shared Angular signals library.
- [Redis Caching & Rate Limiting Guide](docs/redis_guide.md): Guide for Redis rate limiting and session caching.
- [UI Kit & Design System Guide](docs/ui-design-system.md): Web UI components and token design system.

## Key Run Tasks

```sh
# Serve all applications concurrently
pnpm dev

# Serve individual applications
pnpm serve:api
pnpm serve:admin
pnpm serve:patient

# Generate Prisma Client
pnpm prisma:generate
```

## Useful Links

- [Nx Documentation](https://nx.dev)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NestJS Documentation](https://docs.nestjs.com)
