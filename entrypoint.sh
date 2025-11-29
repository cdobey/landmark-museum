#!/bin/sh

# Generate config.js
cat <<EOF > /usr/share/nginx/html/config.js
window.env = {
    VITE_GOOGLE_SEARCH_API_KEY: "${VITE_GOOGLE_SEARCH_API_KEY}",
    VITE_GOOGLE_SEARCH_CX: "${VITE_GOOGLE_SEARCH_CX}"
};
EOF

# Start Nginx
exec "$@"
