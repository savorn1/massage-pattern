# Deployment Guide

Production deployment guide for the Messaging Patterns application covering Docker, Kubernetes, SSL/TLS, load balancing, clustering, monitoring, and security hardening.

## Table of Contents

1. [Environment Configuration](#environment-configuration)
2. [Docker Deployment](#docker-deployment)
3. [Kubernetes Deployment](#kubernetes-deployment)
4. [SSL/TLS Configuration](#ssltls-configuration)
5. [Load Balancing](#load-balancing)
6. [Redis Cluster Setup](#redis-cluster-setup)
7. [NATS Cluster Configuration](#nats-cluster-configuration)
8. [RabbitMQ Cluster Setup](#rabbitmq-cluster-setup)
9. [Monitoring and Logging](#monitoring-and-logging)
10. [Health Checks](#health-checks)
11. [Scaling Considerations](#scaling-considerations)
12. [Security Hardening](#security-hardening)

---

## Environment Configuration

### Environment Variables

Create a `.env` file for production configuration:

```bash
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
CORS_CREDENTIALS=true

# Redis Configuration
REDIS_HOST=redis-cluster
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
REDIS_TLS=true
REDIS_DB=0
REDIS_CONNECTION_TIMEOUT=10000
REDIS_MAX_RETRIES=3

# NATS Configuration
NATS_URL=nats://nats-cluster:4222
NATS_USER=nats_admin
NATS_PASSWORD=your-secure-password
NATS_TOKEN=your-secure-token
NATS_MAX_RECONNECT_ATTEMPTS=10
NATS_RECONNECT_TIME_WAIT=2000

# RabbitMQ Configuration
RABBITMQ_URL=amqp://rabbitmq-cluster:5672
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=your-secure-password
RABBITMQ_VHOST=/
RABBITMQ_HEARTBEAT=60
RABBITMQ_CONNECTION_TIMEOUT=10000

# SSL/TLS Configuration
SSL_ENABLED=true
SSL_CERT_PATH=/etc/ssl/certs/server.crt
SSL_KEY_PATH=/etc/ssl/private/server.key
SSL_CA_PATH=/etc/ssl/certs/ca.crt

# Authentication
JWT_SECRET=your-jwt-secret-key-change-in-production
JWT_EXPIRATION=24h
API_KEY=your-api-key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE_PATH=/var/log/messaging-patterns/app.log

# Monitoring
METRICS_ENABLED=true
METRICS_PORT=9090
HEALTH_CHECK_PATH=/health

# WebSocket Configuration
WS_PING_TIMEOUT=60000
WS_PING_INTERVAL=25000
WS_MAX_PAYLOAD=1048576
```

### Environment-specific Configurations

**Development:**
```bash
NODE_ENV=development
REDIS_HOST=localhost
NATS_URL=nats://localhost:4222
RABBITMQ_URL=amqp://localhost:5672
SSL_ENABLED=false
```

**Staging:**
```bash
NODE_ENV=staging
REDIS_HOST=redis-staging.internal
NATS_URL=nats://nats-staging.internal:4222
RABBITMQ_URL=amqp://rabbitmq-staging.internal:5672
SSL_ENABLED=true
```

**Production:**
```bash
NODE_ENV=production
REDIS_HOST=redis-prod.internal
NATS_URL=nats://nats-prod.internal:4222
RABBITMQ_URL=amqp://rabbitmq-prod.internal:5672
SSL_ENABLED=true
```

---

## Docker Deployment

### Dockerfile

Create a production-ready `Dockerfile`:

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code
COPY src ./src

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy dependencies and built application
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./

# Switch to non-root user
USER nestjs

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
```

### Docker Compose - Production

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    image: messaging-patterns:latest
    container_name: messaging-patterns-app
    restart: unless-stopped
    ports:
      - '3000:3000'
      - '9090:9090'  # Metrics
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - NATS_URL=nats://nats:4222
      - RABBITMQ_URL=amqp://rabbitmq:5672
    env_file:
      - .env.production
    depends_on:
      redis:
        condition: service_healthy
      nats:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    networks:
      - messaging-network
    volumes:
      - ./logs:/var/log/messaging-patterns
      - ./ssl:/etc/ssl
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '3'

  redis:
    image: redis:7-alpine
    container_name: messaging-patterns-redis
    restart: unless-stopped
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --appendonly yes
      --appendfsync everysec
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
      - ./redis.conf:/usr/local/etc/redis/redis.conf
    networks:
      - messaging-network
    healthcheck:
      test: ['CMD', 'redis-cli', '--raw', 'incr', 'ping']
      interval: 10s
      timeout: 3s
      retries: 5

  nats:
    image: nats:2-alpine
    container_name: messaging-patterns-nats
    restart: unless-stopped
    command:
      - '--http_port=8222'
      - '--user=${NATS_USER}'
      - '--pass=${NATS_PASSWORD}'
      - '--cluster_name=messaging-cluster'
      - '--max_payload=1048576'
    ports:
      - '4222:4222'
      - '8222:8222'
    networks:
      - messaging-network
    healthcheck:
      test: ['CMD', 'wget', '--quiet', '--tries=1', '--spider', 'http://localhost:8222/varz']
      interval: 10s
      timeout: 3s
      retries: 5

  rabbitmq:
    image: rabbitmq:3-management-alpine
    container_name: messaging-patterns-rabbitmq
    restart: unless-stopped
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
      RABBITMQ_DEFAULT_VHOST: /
      RABBITMQ_VM_MEMORY_HIGH_WATERMARK: 512MiB
    ports:
      - '5672:5672'
      - '15672:15672'
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
      - ./rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf
    networks:
      - messaging-network
    healthcheck:
      test: ['CMD', 'rabbitmq-diagnostics', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  # Nginx reverse proxy
  nginx:
    image: nginx:alpine
    container_name: messaging-patterns-nginx
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - nginx_logs:/var/log/nginx
    depends_on:
      - app
    networks:
      - messaging-network

volumes:
  redis_data:
    driver: local
  rabbitmq_data:
    driver: local
  nginx_logs:
    driver: local

networks:
  messaging-network:
    driver: bridge
```

### Docker Commands

```bash
# Build image
docker build -t messaging-patterns:latest .

# Run with docker-compose
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f app

# Scale application
docker-compose -f docker-compose.prod.yml up -d --scale app=3

# Stop services
docker-compose -f docker-compose.prod.yml down

# Clean up
docker-compose -f docker-compose.prod.yml down -v
```

---

## Kubernetes Deployment

### Namespace

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: messaging-patterns
  labels:
    name: messaging-patterns
    environment: production
```

### ConfigMap

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: messaging-patterns-config
  namespace: messaging-patterns
data:
  NODE_ENV: 'production'
  PORT: '3000'
  LOG_LEVEL: 'info'
  REDIS_HOST: 'redis-service'
  REDIS_PORT: '6379'
  NATS_URL: 'nats://nats-service:4222'
  RABBITMQ_URL: 'amqp://rabbitmq-service:5672'
  CORS_ORIGIN: 'https://yourdomain.com'
```

### Secrets

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: messaging-patterns-secrets
  namespace: messaging-patterns
type: Opaque
stringData:
  REDIS_PASSWORD: 'your-redis-password'
  NATS_PASSWORD: 'your-nats-password'
  RABBITMQ_PASSWORD: 'your-rabbitmq-password'
  JWT_SECRET: 'your-jwt-secret'
  API_KEY: 'your-api-key'
```

Create secrets from command line:
```bash
kubectl create secret generic messaging-patterns-secrets \
  --from-literal=REDIS_PASSWORD=your-redis-password \
  --from-literal=NATS_PASSWORD=your-nats-password \
  --from-literal=RABBITMQ_PASSWORD=your-rabbitmq-password \
  --from-literal=JWT_SECRET=your-jwt-secret \
  --from-literal=API_KEY=your-api-key \
  -n messaging-patterns
```

### Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: messaging-patterns-app
  namespace: messaging-patterns
  labels:
    app: messaging-patterns
    version: v1
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: messaging-patterns
  template:
    metadata:
      labels:
        app: messaging-patterns
        version: v1
    spec:
      containers:
      - name: messaging-patterns
        image: your-registry/messaging-patterns:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
          name: http
          protocol: TCP
        - containerPort: 9090
          name: metrics
          protocol: TCP
        envFrom:
        - configMapRef:
            name: messaging-patterns-config
        - secretRef:
            name: messaging-patterns-secrets
        resources:
          requests:
            memory: '256Mi'
            cpu: '250m'
          limits:
            memory: '512Mi'
            cpu: '500m'
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        volumeMounts:
        - name: logs
          mountPath: /var/log/messaging-patterns
      volumes:
      - name: logs
        emptyDir: {}
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - messaging-patterns
              topologyKey: kubernetes.io/hostname
```

### Service

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: messaging-patterns-service
  namespace: messaging-patterns
  labels:
    app: messaging-patterns
spec:
  type: ClusterIP
  selector:
    app: messaging-patterns
  ports:
  - name: http
    port: 80
    targetPort: 3000
    protocol: TCP
  - name: metrics
    port: 9090
    targetPort: 9090
    protocol: TCP
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800
```

### Ingress

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: messaging-patterns-ingress
  namespace: messaging-patterns
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: 'true'
    nginx.ingress.kubernetes.io/websocket-services: messaging-patterns-service
    nginx.ingress.kubernetes.io/proxy-read-timeout: '3600'
    nginx.ingress.kubernetes.io/proxy-send-timeout: '3600'
spec:
  tls:
  - hosts:
    - api.yourdomain.com
    secretName: messaging-patterns-tls
  rules:
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: messaging-patterns-service
            port:
              number: 80
```

### HorizontalPodAutoscaler

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: messaging-patterns-hpa
  namespace: messaging-patterns
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: messaging-patterns-app
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
```

### Apply Kubernetes Resources

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Apply configurations
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml

# Deploy Redis
kubectl apply -f k8s/redis/

# Deploy NATS
kubectl apply -f k8s/nats/

# Deploy RabbitMQ
kubectl apply -f k8s/rabbitmq/

# Deploy application
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml

# Check status
kubectl get all -n messaging-patterns

# View logs
kubectl logs -f deployment/messaging-patterns-app -n messaging-patterns

# Scale deployment
kubectl scale deployment messaging-patterns-app --replicas=5 -n messaging-patterns
```

---

## SSL/TLS Configuration

### Generate Self-Signed Certificate (Development)

```bash
# Generate private key
openssl genrsa -out server.key 2048

# Generate certificate signing request
openssl req -new -key server.key -out server.csr

# Generate self-signed certificate
openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt

# Copy to SSL directory
mkdir -p ssl
cp server.key ssl/
cp server.crt ssl/
```

### Let's Encrypt Certificate (Production)

Using cert-manager in Kubernetes:

```yaml
# k8s/cert-manager/cluster-issuer.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@yourdomain.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

### Nginx SSL Configuration

```nginx
# nginx.conf
events {
    worker_connections 4096;
}

http {
    upstream app_servers {
        least_conn;
        server app:3000 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;

        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;

        # SSL certificates
        ssl_certificate /etc/nginx/ssl/server.crt;
        ssl_certificate_key /etc/nginx/ssl/server.key;

        # SSL configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Security headers
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # WebSocket support
        location / {
            proxy_pass http://app_servers;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 3600s;
        }

        # Health check endpoint
        location /health {
            proxy_pass http://app_servers/health;
            access_log off;
        }
    }
}
```

---

## Load Balancing

### WebSocket Load Balancing

WebSocket connections require sticky sessions. Configure load balancer:

**AWS Application Load Balancer:**
```json
{
  "TargetGroups": [
    {
      "TargetGroupName": "messaging-patterns-tg",
      "Protocol": "HTTP",
      "Port": 3000,
      "VpcId": "vpc-xxxxx",
      "HealthCheckEnabled": true,
      "HealthCheckPath": "/health",
      "HealthCheckIntervalSeconds": 30,
      "HealthCheckTimeoutSeconds": 5,
      "HealthyThresholdCount": 2,
      "UnhealthyThresholdCount": 3,
      "Matcher": {
        "HttpCode": "200"
      },
      "TargetGroupAttributes": [
        {
          "Key": "stickiness.enabled",
          "Value": "true"
        },
        {
          "Key": "stickiness.type",
          "Value": "lb_cookie"
        },
        {
          "Key": "stickiness.lb_cookie.duration_seconds",
          "Value": "86400"
        }
      ]
    }
  ]
}
```

**Nginx Load Balancer:**
```nginx
upstream websocket_backend {
    ip_hash;  # Sticky sessions

    server app1:3000 max_fails=3 fail_timeout=30s;
    server app2:3000 max_fails=3 fail_timeout=30s;
    server app3:3000 max_fails=3 fail_timeout=30s;

    keepalive 64;
}

server {
    listen 443 ssl http2;

    location / {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Required for sticky sessions
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## Redis Cluster Setup

### Redis Cluster Configuration

```yaml
# k8s/redis/statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis-cluster
  namespace: messaging-patterns
spec:
  serviceName: redis-cluster
  replicas: 6
  selector:
    matchLabels:
      app: redis-cluster
  template:
    metadata:
      labels:
        app: redis-cluster
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        command:
          - redis-server
          - /conf/redis.conf
          - --cluster-enabled yes
          - --cluster-config-file /data/nodes.conf
          - --cluster-node-timeout 5000
          - --appendonly yes
          - --requirepass ${REDIS_PASSWORD}
        ports:
        - containerPort: 6379
          name: client
        - containerPort: 16379
          name: gossip
        volumeMounts:
        - name: conf
          mountPath: /conf
        - name: data
          mountPath: /data
        resources:
          requests:
            memory: '256Mi'
            cpu: '100m'
          limits:
            memory: '512Mi'
            cpu: '200m'
      volumes:
      - name: conf
        configMap:
          name: redis-cluster-config
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 10Gi
```

### Initialize Redis Cluster

```bash
# Create cluster
kubectl exec -it redis-cluster-0 -n messaging-patterns -- redis-cli \
  --cluster create \
  $(kubectl get pods -n messaging-patterns -l app=redis-cluster -o jsonpath='{range.items[*]}{.status.podIP}:6379 ') \
  --cluster-replicas 1 \
  -a your-redis-password

# Check cluster status
kubectl exec -it redis-cluster-0 -n messaging-patterns -- redis-cli -a your-redis-password cluster info
```

---

## NATS Cluster Configuration

### NATS Cluster Deployment

```yaml
# k8s/nats/statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: nats-cluster
  namespace: messaging-patterns
spec:
  serviceName: nats-cluster
  replicas: 3
  selector:
    matchLabels:
      app: nats-cluster
  template:
    metadata:
      labels:
        app: nats-cluster
    spec:
      containers:
      - name: nats
        image: nats:2-alpine
        ports:
        - containerPort: 4222
          name: client
        - containerPort: 6222
          name: cluster
        - containerPort: 8222
          name: monitor
        command:
          - nats-server
          - --config
          - /etc/nats/nats.conf
        volumeMounts:
        - name: config
          mountPath: /etc/nats
        resources:
          requests:
            memory: '128Mi'
            cpu: '100m'
          limits:
            memory: '256Mi'
            cpu: '200m'
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8222
          initialDelaySeconds: 10
          periodSeconds: 10
      volumes:
      - name: config
        configMap:
          name: nats-config
```

### NATS Configuration

```conf
# nats.conf
port: 4222
http_port: 8222

cluster {
  name: messaging-cluster
  port: 6222
  routes = [
    nats://nats-cluster-0.nats-cluster:6222
    nats://nats-cluster-1.nats-cluster:6222
    nats://nats-cluster-2.nats-cluster:6222
  ]
  cluster_advertise: $CLUSTER_ADVERTISE
  connect_retries: 30
}

authorization {
  user: $NATS_USER
  password: $NATS_PASSWORD
}

max_payload: 1048576
max_connections: 100000
```

---

## RabbitMQ Cluster Setup

### RabbitMQ Cluster Deployment

```yaml
# k8s/rabbitmq/statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: rabbitmq-cluster
  namespace: messaging-patterns
spec:
  serviceName: rabbitmq-cluster
  replicas: 3
  selector:
    matchLabels:
      app: rabbitmq-cluster
  template:
    metadata:
      labels:
        app: rabbitmq-cluster
    spec:
      containers:
      - name: rabbitmq
        image: rabbitmq:3-management-alpine
        ports:
        - containerPort: 5672
          name: amqp
        - containerPort: 15672
          name: management
        - containerPort: 4369
          name: epmd
        - containerPort: 25672
          name: dist
        env:
        - name: RABBITMQ_ERLANG_COOKIE
          valueFrom:
            secretKeyRef:
              name: rabbitmq-secret
              key: erlang-cookie
        - name: RABBITMQ_DEFAULT_USER
          value: admin
        - name: RABBITMQ_DEFAULT_PASS
          valueFrom:
            secretKeyRef:
              name: messaging-patterns-secrets
              key: RABBITMQ_PASSWORD
        - name: RABBITMQ_USE_LONGNAME
          value: 'true'
        volumeMounts:
        - name: config
          mountPath: /etc/rabbitmq
        - name: data
          mountPath: /var/lib/rabbitmq
        resources:
          requests:
            memory: '512Mi'
            cpu: '250m'
          limits:
            memory: '1Gi'
            cpu: '500m'
      volumes:
      - name: config
        configMap:
          name: rabbitmq-config
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 20Gi
```

### RabbitMQ Configuration

```conf
# rabbitmq.conf
cluster_formation.peer_discovery_backend = rabbit_peer_discovery_k8s
cluster_formation.k8s.host = kubernetes.default.svc.cluster.local
cluster_formation.k8s.address_type = hostname
cluster_formation.k8s.service_name = rabbitmq-cluster
cluster_formation.k8s.hostname_suffix = .rabbitmq-cluster.messaging-patterns.svc.cluster.local

cluster_partition_handling = autoheal
queue_master_locator = min-masters

vm_memory_high_watermark.relative = 0.6
disk_free_limit.absolute = 2GB
```

---

## Monitoring and Logging

### Prometheus Configuration

```yaml
# k8s/monitoring/prometheus-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: messaging-patterns
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s

    scrape_configs:
      - job_name: 'messaging-patterns'
        kubernetes_sd_configs:
          - role: pod
            namespaces:
              names:
                - messaging-patterns
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_label_app]
            action: keep
            regex: messaging-patterns
          - source_labels: [__meta_kubernetes_pod_container_port_number]
            action: keep
            regex: 9090
```

### Application Metrics Endpoint

Add to your NestJS application:

```typescript
// src/metrics/metrics.controller.ts
import { Controller, Get } from '@nestjs/common';
import { Counter, Histogram, register } from 'prom-client';

@Controller('metrics')
export class MetricsController {
  private readonly requestCounter = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'],
  });

  private readonly responseTime = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status'],
  });

  @Get()
  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Messaging Patterns Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "WebSocket Connections",
        "targets": [
          {
            "expr": "websocket_connections_total"
          }
        ]
      },
      {
        "title": "Redis Pub/Sub Messages",
        "targets": [
          {
            "expr": "rate(redis_pubsub_messages_total[5m])"
          }
        ]
      }
    ]
  }
}
```

### Logging with ELK Stack

```yaml
# k8s/logging/filebeat-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: filebeat-config
  namespace: messaging-patterns
data:
  filebeat.yml: |
    filebeat.inputs:
    - type: container
      paths:
        - /var/log/containers/*messaging-patterns*.log
      processors:
        - add_kubernetes_metadata:
            host: ${NODE_NAME}
            matchers:
            - logs_path:
                logs_path: "/var/log/containers/"

    output.elasticsearch:
      hosts: ['${ELASTICSEARCH_HOST}:${ELASTICSEARCH_PORT}']
      username: ${ELASTICSEARCH_USERNAME}
      password: ${ELASTICSEARCH_PASSWORD}

    setup.kibana:
      host: '${KIBANA_HOST}:${KIBANA_PORT}'
```

---

## Health Checks

### Application Health Check

```typescript
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private redis: RedisHealthIndicator,
    private nats: NatsHealthIndicator,
    private rabbitmq: RabbitMQHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.redis.isHealthy('redis'),
      () => this.nats.isHealthy('nats'),
      () => this.rabbitmq.isHealthy('rabbitmq'),
    ]);
  }

  @Get('liveness')
  liveness() {
    return { status: 'ok' };
  }

  @Get('readiness')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.redis.isHealthy('redis'),
      () => this.nats.isHealthy('nats'),
      () => this.rabbitmq.isHealthy('rabbitmq'),
    ]);
  }
}
```

---

## Scaling Considerations

### Horizontal Scaling

**Application Pods:**
- Use HPA (Horizontal Pod Autoscaler)
- Scale based on CPU, memory, and custom metrics
- Minimum 3 replicas for high availability

**Redis:**
- Use Redis Cluster with 6+ nodes
- 3 masters + 3 replicas minimum
- Sharding for data distribution

**NATS:**
- Cluster with 3+ nodes
- Queue groups for load distribution
- Automatic failover

**RabbitMQ:**
- Cluster with 3+ nodes
- Mirrored queues for HA
- Load balancing across nodes

### Vertical Scaling

**Resource Requests:**
```yaml
resources:
  requests:
    memory: '256Mi'
    cpu: '250m'
  limits:
    memory: '512Mi'
    cpu: '500m'
```

### Connection Pooling

```typescript
// Redis connection pool
const redisPool = new Redis.Cluster([
  { host: 'redis-0', port: 6379 },
  { host: 'redis-1', port: 6379 },
  { host: 'redis-2', port: 6379 },
], {
  redisOptions: {
    password: process.env.REDIS_PASSWORD,
  },
  clusterRetryStrategy: (times) => Math.min(times * 50, 2000),
});
```

---

## Security Hardening

### Network Security

**Network Policies:**
```yaml
# k8s/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: messaging-patterns-netpol
  namespace: messaging-patterns
spec:
  podSelector:
    matchLabels:
      app: messaging-patterns
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: redis-cluster
    ports:
    - protocol: TCP
      port: 6379
  - to:
    - podSelector:
        matchLabels:
          app: nats-cluster
    ports:
    - protocol: TCP
      port: 4222
  - to:
    - podSelector:
        matchLabels:
          app: rabbitmq-cluster
    ports:
    - protocol: TCP
      port: 5672
```

### Pod Security Policy

```yaml
# k8s/pod-security-policy.yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: messaging-patterns-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'secret'
    - 'persistentVolumeClaim'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
  readOnlyRootFilesystem: true
```

### Security Checklist

- [ ] Enable SSL/TLS for all connections
- [ ] Use strong passwords and rotate regularly
- [ ] Implement authentication for all services
- [ ] Enable network policies
- [ ] Run containers as non-root user
- [ ] Use read-only root filesystem
- [ ] Scan images for vulnerabilities
- [ ] Enable audit logging
- [ ] Implement rate limiting
- [ ] Use secrets management (Vault, AWS Secrets Manager)
- [ ] Enable CORS with specific origins
- [ ] Implement CSP headers
- [ ] Use RBAC in Kubernetes
- [ ] Regular security updates

---

## Backup and Disaster Recovery

### Redis Backup

```bash
# Manual backup
kubectl exec -it redis-cluster-0 -n messaging-patterns -- redis-cli -a password BGSAVE

# Scheduled backup with CronJob
kubectl apply -f k8s/backup/redis-backup-cronjob.yaml
```

### RabbitMQ Backup

```bash
# Export definitions
kubectl exec -it rabbitmq-cluster-0 -n messaging-patterns -- \
  rabbitmqctl export_definitions /tmp/definitions.json

# Copy to local
kubectl cp messaging-patterns/rabbitmq-cluster-0:/tmp/definitions.json ./definitions.json
```

### Disaster Recovery Plan

1. **Regular Backups:** Daily automated backups of all persistent data
2. **Off-site Storage:** Store backups in different region/cloud
3. **Testing:** Regular DR drills and recovery testing
4. **Documentation:** Maintain runbooks for recovery procedures
5. **Monitoring:** Alert on backup failures
6. **RTO/RPO:** Define Recovery Time and Point Objectives

---

## Troubleshooting

### Common Issues

**WebSocket Disconnections:**
```bash
# Check pod logs
kubectl logs -f deployment/messaging-patterns-app -n messaging-patterns

# Check load balancer settings
kubectl describe ingress messaging-patterns-ingress -n messaging-patterns
```

**Redis Connection Issues:**
```bash
# Test Redis connection
kubectl exec -it redis-cluster-0 -n messaging-patterns -- redis-cli -a password ping

# Check cluster status
kubectl exec -it redis-cluster-0 -n messaging-patterns -- redis-cli -a password cluster info
```

**NATS Connection Issues:**
```bash
# Check NATS status
kubectl exec -it nats-cluster-0 -n messaging-patterns -- nats-server --signal=stats

# View routes
kubectl exec -it nats-cluster-0 -n messaging-patterns -- nats-server --signal=routes
```

**RabbitMQ Connection Issues:**
```bash
# Check cluster status
kubectl exec -it rabbitmq-cluster-0 -n messaging-patterns -- rabbitmqctl cluster_status

# List queues
kubectl exec -it rabbitmq-cluster-0 -n messaging-patterns -- rabbitmqctl list_queues
```

---

## Production Checklist

### Pre-Deployment

- [ ] All environment variables configured
- [ ] Secrets created and secured
- [ ] SSL certificates generated and installed
- [ ] Database migrations completed
- [ ] Health checks implemented
- [ ] Monitoring and logging configured
- [ ] Backup strategy in place
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Documentation updated

### Post-Deployment

- [ ] Verify all pods are running
- [ ] Check health endpoints
- [ ] Verify SSL/TLS working
- [ ] Test WebSocket connections
- [ ] Monitor error rates
- [ ] Check resource utilization
- [ ] Verify backups running
- [ ] Test alerting
- [ ] Update DNS records
- [ ] Smoke tests passed

---

## Conclusion

This deployment guide provides comprehensive instructions for deploying the Messaging Patterns application in production. Follow best practices for security, monitoring, and scaling to ensure a robust and reliable deployment.

For additional support or questions, refer to:
- [Frontend Integration Guide](./FRONTEND_INTEGRATION.md)
- [API Reference](./API_REFERENCE.md)
- [Main README](../README.md)
