# 🎨 Interactive Test Dashboard Guide

## Quick Access

Once your application is running, open this URL in your browser:

**[http://localhost:3000/examples-test.html](http://localhost:3000/examples-test.html)**

---

## 🚀 Getting Started

### Step 1: Start the Application

```bash
# Terminal 1: Start message brokers
docker-compose up -d

# Terminal 2: Start the NestJS application
npm run start:dev
```

Wait for the message: `Application is running on: http://localhost:3000`

### Step 2: Open the Test Dashboard

Open your browser and navigate to:
```
http://localhost:3000/examples-test.html
```

### Step 3: Setup Workers

1. Click the **"🚀 Setup Workers & Subscribers"** button
2. Wait for the success message
3. You'll see the status change to "✓ Ready to test!"

---

## 🧪 Testing Each Pattern

### 🐰 RabbitMQ - Job Queue

**What it does:**
- Sends 3 background jobs to different queues
- Workers process them one by one
- Jobs: Email sending, Image processing, Report generation

**How to test:**
1. Click **"📤 Send Jobs to Queue"**
2. Watch the console output in the web page
3. **Check your server terminal** to see workers processing jobs:
   ```
   [Email Worker] Processing: Send email to user@example.com
   [Email Worker] ✓ Email sent to user@example.com
   [Image Worker] Processing image img-123...
   ```

**What you'll learn:**
- Jobs are queued and processed in order
- Workers can process jobs independently
- Jobs are reliable and won't be lost

---

### 💾 Redis - Pub/Sub

**What it does:**
- Broadcasts events to multiple channels
- All subscribers receive messages instantly
- Channels: user-activity, system-alerts, cache-invalidation

**How to test:**
1. Click **"📡 Broadcast Events"**
2. Watch the console output
3. **Check your server terminal** to see subscribers receiving events:
   ```
   [User Events Listener] User Alice logged in
   [Alert System] 🚨 High CPU usage detected
   [Cache Manager] Invalidating: {"key":"user:123","action":"delete"}
   ```

**What you'll learn:**
- Events are broadcast to all subscribers instantly
- Multiple services can listen to the same channel
- Fire-and-forget pattern (no persistence)

---

### ⚡ NATS - RPC (Request/Response)

**What it does:**
- Sends requests to NATS server
- Waits for responses (5-second timeout)
- Demonstrates microservices communication

**How to test:**
1. Click **"🔄 Send RPC Request"**
2. Watch for timeout message (expected - no responder running)
3. This demonstrates what happens when microservices aren't available

**What you'll learn:**
- Request/response pattern requires both sender and receiver
- Timeout handling is important
- In production, separate microservices would respond

---

### 🎯 Combined Example - User Registration

**What it does:**
- Simulates complete user registration flow
- Uses all three messaging patterns together
- Steps:
  1. NATS: Create billing account (synchronous)
  2. RabbitMQ: Queue jobs (emails, analytics, notifications)
  3. Redis: Broadcast events (user registration, cache invalidation)

**How to test:**
1. Enter an email address (or use default)
2. Click **"🚀 Run Full Registration Flow"**
3. Watch the web console for step-by-step breakdown
4. **Check your server terminal** for detailed worker output

**What you'll learn:**
- How to combine messaging patterns effectively
- When to use sync vs async operations
- Real-world application architecture

---

## 📊 Understanding the Console Output

### Color Coding

- 🔵 **Blue (Info)**: General information and progress updates
- 🟢 **Green (Success)**: Operations completed successfully
- 🔴 **Red (Error)**: Errors and failures
- 🟡 **Yellow (Warning)**: Warnings and important notes
- ⚪ **Gray (Data)**: Detailed data output (JSON responses)

### Example Console Output

```
[14:30:45] 🔧 Setting up workers and subscribers...
[14:30:46] ✅ Setup completed successfully!
[14:30:46] ✓ RabbitMQ workers: emails, image-processing, reports, analytics, notifications
[14:30:46] ✓ Redis subscribers: user-events, system-alerts, cache-invalidation, user-activity
```

---

## 🎓 Learning Path

### Recommended Testing Order:

1. **Start with Setup** ⚙️
   - Click "Setup Workers & Subscribers"
   - Understand what workers and subscribers are

2. **Test RabbitMQ** 🐰
   - Click multiple times to queue many jobs
   - Watch workers process them
   - Learn about job queues

3. **Test Redis** 💾
   - Broadcast events
   - See instant delivery to subscribers
   - Understand pub/sub pattern

4. **Test Combined** 🎯
   - See all patterns working together
   - Understand real-world architecture
   - Try different email addresses

5. **Experiment!** 🧪
   - Click buttons multiple times
   - Watch the console logs
   - Compare server terminal with web console

---

## 💡 Pro Tips

### 1. Keep Server Terminal Visible
The server terminal shows detailed worker output:
```bash
# Split your terminal or use multiple windows:
Terminal 1: npm run start:dev  (watch this for worker logs)
Terminal 2: docker-compose logs -f  (optional: watch broker logs)
```

### 2. Test Multiple Times
- Click the same button multiple times to queue many jobs
- Watch how workers handle multiple tasks
- See the queue in action

### 3. Compare Web Console vs Server Console
- **Web console**: High-level API responses
- **Server console**: Detailed worker processing

### 4. Experiment with Email
Try different emails in the combined example:
- `alice@example.com`
- `bob@test.com`
- `admin@company.com`

### 5. Clear Console Regularly
Click "Clear" button to reset the console and start fresh

---

## 🐛 Troubleshooting

### Problem: "Setup failed"
**Solution:**
```bash
# Check if brokers are running
docker ps

# Restart brokers if needed
docker-compose restart
```

### Problem: "Connection refused"
**Solution:**
```bash
# Make sure the application is running
npm run start:dev

# Check it's on port 3000
curl http://localhost:3000
```

### Problem: "Not seeing worker logs"
**Solution:**
- Make sure you clicked "Setup Workers" first
- Check your server terminal (not the web console)
- Logs appear in the terminal running `npm run start:dev`

### Problem: Page not loading
**Solution:**
```bash
# Verify static file serving
ls public/examples-test.html

# Restart the application
# Ctrl+C, then: npm run start:dev
```

---

## 🎬 What to Watch For

### After Clicking "Send Jobs to Queue"
Look for in **server terminal**:
```
[Email Worker] Processing: Send email to user@example.com
[Email Worker] ✓ Email sent to user@example.com  (after 1 second)
[Image Worker] Processing image img-123...
[Image Worker] ✓ Image img-123 processed  (after 2 seconds)
[Report Worker] Generating monthly-sales report...
[Report Worker] ✓ Report rpt-456 generated  (after 3 seconds)
```

### After Clicking "Broadcast Events"
Look for in **server terminal**:
```
[User Events Listener] User Alice logged in
[Activity Tracker] User Alice logged in
[Alert System] 🚨 High CPU usage detected
[Cache Manager] Invalidating: {"key":"user:123","action":"delete"}
```

### After Clicking "Run Full Registration Flow"
Look for in **server terminal**:
```
=== Combined Example: User Registration ===
Step 1: Creating billing account (NATS RPC)...
Step 2: Queuing background jobs (RabbitMQ)...
✓ Queued: Send welcome email
✓ Queued: Track signup event
✓ Queued: Notify admins
Step 3: Broadcasting events (Redis Pub/Sub)...
✓ Broadcast to 2 subscriber(s)
✅ User registration completed successfully!

[Email Worker] Processing: Send email to test@example.com
[Analytics Worker] Tracking event: user_registered
[Notifications Worker] New user registered: test@example.com
[User Events Listener] {"event":"user_registered","email":"test@example.com"}
[Cache Manager] Invalidating: {"action":"clear","pattern":"users:*"}
```

---

## 📚 Next Steps

After testing in the dashboard:

1. ✅ Read the code in `src/examples/examples.service.ts`
2. ✅ Try the command-line examples in [EXAMPLES_GUIDE.md](./EXAMPLES_GUIDE.md)
3. ✅ Learn the theory in [HOW_THEY_WORK.md](./HOW_THEY_WORK.md)
4. ✅ Build your own messaging patterns!

---

## 🎉 Features

- ✅ **Beautiful UI** - Modern gradient design with animations
- ✅ **Real-time Console** - See API responses instantly
- ✅ **Color-coded Logs** - Easy to understand different message types
- ✅ **Auto-scroll** - Console automatically scrolls to latest message
- ✅ **One-click Testing** - No command line needed
- ✅ **Visual Feedback** - Status indicators show system state
- ✅ **Timestamps** - Every log entry has a timestamp
- ✅ **Clear Console** - Reset anytime with Clear button

---

## 🔗 Related Resources

- **Main README**: [README.md](./README.md)
- **Examples Guide**: [EXAMPLES_GUIDE.md](./EXAMPLES_GUIDE.md)
- **How They Work**: [HOW_THEY_WORK.md](./HOW_THEY_WORK.md)
- **Architecture Guide**: [CLAUDE.md](./CLAUDE.md)
- **WebSocket Test**: [http://localhost:3000/websocket-client.html](http://localhost:3000/websocket-client.html)
- **API Docs**: [http://localhost:3000/docs/](http://localhost:3000/docs/)

---

**Happy Testing!** 🚀

If you encounter any issues, check the server terminal for detailed error messages.
