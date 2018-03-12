FROM       node:8.11.0
LABEL maintainer="Automattic"

WORKDIR    /calypso


ENV        CONTAINER 'docker'
ENV        NODE_PATH=/calypso/server:/calypso/client

# Build a "base" layer
#
# This layer should never change unless env-config.sh
# changes. For local development this should always
# be an empty file and therefore this layer should
# cache well.
#
# env-config.sh
#   used by systems to overwrite some defaults
#   such as the apt and npm mirrors
COPY       ./env-config.sh /tmp/env-config.sh
RUN        bash /tmp/env-config.sh

# Build a "dependencies" layer
#
# This layer should include all required npm modules
# and should only change as often as the dependencies
# change. This layer should allow for final build times
# to be limited only by the Calypso build speed.
COPY       ./package.json ./npm-shrinkwrap.json /calypso/
RUN        npm install --production && rm -rf /root/.npm

# Build a "source" layer
#
# This layer is populated with up-to-date files from
# Calypso development.
#
# If package.json and npm-shrinkwrap are unchanged,
# `make node-modules` should require no action.
# However, since we are COPYing the files we are
# updating their modification times and we want to
# prevent the extra work by fake-updating node-modules
COPY       . /calypso/
RUN        touch node_modules

# Build the final layer
#
# This contains built environments of Calypso. It will
# change any time any of the Calypso source-code changes.
ARG        commit_sha="(unknown)"
ENV        COMMIT_SHA $commit_sha

RUN        CALYPSO_ENV=production npm run build

USER       nobody
CMD        NODE_ENV=production node build/bundle.js
