# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Inlined into the client bundle at build time (must be set when building the image).
ARG NEXT_PUBLIC_WHOP_APP_ID
ARG NEXT_PUBLIC_WHOP_AGENT_USER_ID
ARG NEXT_PUBLIC_WHOP_COMPANY_ID
ENV NEXT_PUBLIC_WHOP_APP_ID=app_79yMc74zrLaxsA
ENV NEXT_PUBLIC_WHOP_AGENT_USER_ID=user_sP64FudGJmHCO
ENV NEXT_PUBLIC_WHOP_COMPANY_ID=biz_jpoAczvrP8oUDT

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
	&& adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
