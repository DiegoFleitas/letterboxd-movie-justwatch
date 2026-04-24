FROM redis:7.4-bookworm

RUN apt-get update && apt-get install -y curl \
  && curl -L https://fly.io/install.sh | sh \
  && rm -rf /var/lib/apt/lists/*

ENV FLYCTL_INSTALL="/root/.fly"
ENV PATH="$FLYCTL_INSTALL/bin:$PATH"

EXPOSE 6379

COPY entrypoint.sh /
RUN chmod +x /entrypoint.sh

CMD [ "/entrypoint.sh" ]
