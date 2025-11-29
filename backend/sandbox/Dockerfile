# Secure Sandbox Runner
# Lightweight Node.js environment for running untrusted code tests
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install minimal dependencies
# We only need typescript/ts-node for running tests
RUN npm install -g typescript ts-node

# Create a non-root user for security
RUN addgroup -S sandbox && adduser -S sandbox -G sandbox
USER sandbox

# Command to run the test file
# Expects the file to be mounted at /usr/src/app/test.ts
CMD ["ts-node", "test.ts"]
