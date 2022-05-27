This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
```


```docker
## Localhost
docker build --build-arg BC_POSITION=http://localhost:9500 --build-arg BC_DATA=http://localhost:9510 . -t monowai/bc-view
```
```docker
## Compose/DEMO
docker build --build-arg BC_POSITION=http://position:9500/api --build-arg BC_DATA=http://data:9510/api --build-arg KAFKA_URL=kafka:9092 . -t monowai/bc-view-demo  
```
```docker
# MiniKube
docker build --build-arg BC_POSITION=http://bc-position:9700/api --build-arg BC_DATA=http://bc-data:9710/api . -t monowai/bc-view
```
