#!/bin/bash
set -e

echo "Configuring container firewall..."

# Create ipset for allowed domains
ipset create allowed-domains hash:net 2>/dev/null || true

# Set default policies
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

# Allow localhost
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow DNS
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT

# Allow Git SSH
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTPS/HTTP
iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 80 -j ACCEPT

# Allow PostgreSQL/Supabase (postgres:// protocol)
iptables -A OUTPUT -p tcp --dport 5432 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 5433 -j ACCEPT  # Alternative PostgreSQL port

# Allow MongoDB connections
iptables -A OUTPUT -p tcp --dport 27017 -j ACCEPT

# Allow Redis
iptables -A OUTPUT -p tcp --dport 6379 -j ACCEPT

# Fetch and allow GitHub IPs
echo "Adding GitHub to allowed domains..."
GITHUB_META=$(curl -s https://api.github.com/meta || echo "{}")
echo "$GITHUB_META" | jq -r '.web[],.api[],.git[]' 2>/dev/null | while read -r range; do
    [ -n "$range" ] && ipset add allowed-domains "$range" 2>/dev/null || true
done

# Allow specific documentation and development domains
echo "Adding selected documentation and dev domains to allowed-domains ipset..."
for domain in \
    docs.anthropic.com \
    nextjs.org \
    reactjs.org \
    nodejs.org \
    developer.mozilla.org \
    stackoverflow.com \
    github.com \
    npmjs.com \
    typescript-eslint.io \
    eslint.org \
    prettier.io \
    vitejs.dev \
    webpack.js.org \
    supabase.com
do
    # Resolve all A and AAAA records for the domain and add to ipset
    for ip in $(dig +short A $domain) $(dig +short AAAA $domain); do
        [ -n "$ip" ] && ipset add allowed-domains "$ip" 2>/dev/null || true
    done
done

# Allow connections to whitelisted IPs
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT

# Allow development server ports
iptables -A INPUT -p tcp --dport 3000:3010 -j ACCEPT

# Allow SSH and Mosh for remote access
iptables -A INPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -p udp --dport 60000:60010 -j ACCEPT

echo "Firewall configured"
