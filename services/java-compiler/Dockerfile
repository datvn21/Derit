FROM eclipse-temurin:11.0.16_8-jdk-alpine

# Create non-root user for running untrusted code
RUN addgroup -S runner && adduser -S runner -G runner

WORKDIR /workspace
RUN chown -R runner:runner /workspace

USER runner

# Keep container alive for multiple exec calls from the Node.js host
# Network is disabled at container creation time (NetworkDisabled + NetworkMode=none)
CMD ["sleep", "infinity"]
