FROM n8nio/base:20

USER root
COPY company.pem /usr/local/share/ca-certificates
RUN update-ca-certificates

RUN apk add --no-cache --update openssh sudo shadow bash
RUN echo node ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/node && chmod 0440 /etc/sudoers.d/node
RUN mkdir /workspaces && chown node:node /workspaces
USER node
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
RUN mkdir -p ~/.pnpm-store && pnpm config set store-dir ~/.pnpm-store --global

