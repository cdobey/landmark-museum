#!/bin/sh

# Generate config.js
cat <<EOF > /usr/share/nginx/html/config.js
window.env = {};
EOF

# Start Nginx
exec "$@"
