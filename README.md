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
docker build . -t monowai/bc-view
```
```docker
## Compose/DEMO
docker build --build-arg KAFKA_URL=kafka:9092 . -t monowai/bc-view-demo  
```
```docker
# MiniKube    
docker build --build-arg KAFKA_URL=host.minikube.internal:9092 . -t monowai/bc-view
```
