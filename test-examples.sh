#!/bin/bash

# Test script for messaging patterns examples
# Run this after starting the application with: npm run start:dev

echo "================================================"
echo "  Messaging Patterns - Live Examples Test"
echo "================================================"
echo ""

BASE_URL="http://localhost:3000"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Step 1: Setting up workers and subscribers...${NC}"
echo ""
curl -X POST "$BASE_URL/examples/setup"
echo ""
echo ""
sleep 2

echo -e "${BLUE}Step 2: Testing RabbitMQ Job Queue...${NC}"
echo -e "${YELLOW}Watch your console for worker logs!${NC}"
echo ""
curl -X POST "$BASE_URL/examples/rabbitmq"
echo ""
echo ""
sleep 3

echo -e "${BLUE}Step 3: Testing Redis Pub/Sub...${NC}"
echo -e "${YELLOW}Watch your console for subscriber logs!${NC}"
echo ""
curl -X POST "$BASE_URL/examples/redis"
echo ""
echo ""
sleep 2

echo -e "${BLUE}Step 4: Testing Combined Flow (User Registration)...${NC}"
echo -e "${YELLOW}Watch your console to see all three patterns working together!${NC}"
echo ""
curl -X POST "$BASE_URL/examples/combined?email=test@example.com"
echo ""
echo ""

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  All tests completed!${NC}"
echo -e "${GREEN}  Check your console logs for detailed output${NC}"
echo -e "${GREEN}================================================${NC}"
